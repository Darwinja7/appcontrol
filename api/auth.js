import { readRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS } from "./_lib/model.js";
import {
  verifyPassword, hashPassword, createToken, verifyToken,
  parseCookies, sha256Hex, safeCompare, resetPin
} from "./_lib/auth.js";
import { sendResetPin } from "./_lib/mail.js";

function cookieHeader(req) {
  if (req.headers && typeof req.headers.get === "function") return req.headers.get("cookie");
  return req.headers?.cookie || "";
}

async function current(req) {
  const cookies = parseCookies(cookieHeader(req));
  const p = verifyToken(cookies.appcontrol_session);
  if (!p || p.scope !== "web") return null;
  const usuarios = await readRows("USUARIOS");
  const u = usuarios.find((x) =>
    String(x.EMAIL || "").toLowerCase() === String(p.email || "").toLowerCase() &&
    String(x.EMPRESA || "") === String(p.empresa || "") &&
    String(x.PROYECTO || "") === String(p.proyecto || "")
  );
  if (!u || String(u.ACTIVO).toUpperCase() !== "SI") return null;
  return { p, u };
}

function setSession(res, email, empresa, proyecto, rol) {
  const token = createToken({ email, empresa, proyecto, rol, scope: "web" }, 8 * 3600);
  res.setHeader("Set-Cookie", `appcontrol_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800; Secure`);
}

export default async function handler(req, res) {
  try {
    const b = req.body || {};
    const a = b.action || "";

    if (a === "options") {
      const [empresas, proyectos] = await Promise.all([readRows("EMPRESAS"), readRows("PROYECTOS")]);
      return res.json({
        success: true,
        empresas: empresas.filter((e) => String(e.ACTIVO).toUpperCase() === "SI"),
        proyectos: proyectos.filter((p) => String(p.ACTIVO).toUpperCase() === "SI")
      });
    }

    if (a === "login") {
      const { empresa = "", proyecto = "", email = "", password = "" } = b;
      if (!empresa || !proyecto || !email || !password) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });

      const [empresas, proyectos, usuarios] = await Promise.all([readRows("EMPRESAS"), readRows("PROYECTOS"), readRows("USUARIOS")]);
      if (!empresas.find((e) => e.CODIGO === empresa && String(e.ACTIVO).toUpperCase() === "SI"))
        return res.status(401).json({ success: false, codigo: "EMPRESA_INVALIDA" });
      if (!proyectos.find((p) => p.EMPRESA === empresa && p.CODIGO === proyecto && String(p.ACTIVO).toUpperCase() === "SI"))
        return res.status(401).json({ success: false, codigo: "PROYECTO_INVALIDO" });

      const u = usuarios.find((x) =>
        String(x.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
        x.EMPRESA === empresa && x.PROYECTO === proyecto
      );
      if (!u || String(u.ACTIVO).toUpperCase() !== "SI")
        return res.status(401).json({ success: false, codigo: "USUARIO_INACTIVO_O_INVALIDO" });
      if (!verifyPassword(password, u.PASSWORD_HASH))
        return res.status(401).json({ success: false, codigo: "CREDENCIALES_INVALIDAS" });

      if (String(u.MUST_CHANGE_PASSWORD).toUpperCase() === "SI") {
        return res.json({ success: true, mustChangePassword: true, email: u.EMAIL, empresa, proyecto });
      }

      setSession(res, u.EMAIL, empresa, proyecto, u.ROL);
      return res.json({ success: true, mustChangePassword: false, usuario: { nombre: u.NOMBRE, email: u.EMAIL, rol: u.ROL, empresa, proyecto } });
    }

    if (a === "logout") {
      res.setHeader("Set-Cookie", "appcontrol_session=; Path=/; HttpOnly; Max-Age=0");
      return res.json({ success: true });
    }

    if (a === "me") {
      const c = await current(req);
      if (!c) return res.status(401).json({ success: false });
      return res.json({ success: true, usuario: { id: c.u.ID_USUARIO, nombre: c.u.NOMBRE, email: c.u.EMAIL, rol: c.u.ROL, empresa: c.u.EMPRESA, proyecto: c.u.PROYECTO, torre: c.u.TORRE } });
    }

    if (a === "change-password") {
      const { empresa = "", proyecto = "", email = "", currentPassword = "", newPassword = "" } = b;
      if (!empresa || !proyecto || !email || !currentPassword || !newPassword) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
      if (String(newPassword).length < 6) return res.status(400).json({ success: false, codigo: "PASSWORD_CORTA" });
      const usuarios = await readRows("USUARIOS");
      const idx = usuarios.findIndex((u) =>
        String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
        u.EMPRESA === empresa && u.PROYECTO === proyecto && String(u.ACTIVO).toUpperCase() === "SI"
      );
      if (idx < 0) return res.status(404).json({ success: false, codigo: "USUARIO_NO_EXISTE" });
      if (!verifyPassword(currentPassword, usuarios[idx].PASSWORD_HASH))
        return res.status(401).json({ success: false, codigo: "PASSWORD_ACTUAL_INVALIDA" });
      usuarios[idx] = { ...usuarios[idx], PASSWORD_HASH: hashPassword(newPassword), MUST_CHANGE_PASSWORD: "NO", RESET_PIN_HASH: "", RESET_PIN_EXPIRES: "" };
      await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")));
      setSession(res, usuarios[idx].EMAIL, empresa, proyecto, usuarios[idx].ROL);
      return res.json({ success: true });
    }

    if (a === "forgot-start") {
      const { empresa = "", proyecto = "", email = "" } = b;
      if (!empresa || !proyecto || !email) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
      const usuarios = await readRows("USUARIOS");
      const idx = usuarios.findIndex((u) =>
        String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
        u.EMPRESA === empresa && u.PROYECTO === proyecto && String(u.ACTIVO).toUpperCase() === "SI"
      );
      if (idx < 0) return res.json({ success: true });
      const pin = resetPin();
      const expires = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      usuarios[idx] = { ...usuarios[idx], RESET_PIN_HASH: sha256Hex(pin), RESET_PIN_EXPIRES: expires };
      await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")));
      const mail = await sendResetPin({ to: usuarios[idx].EMAIL, pin, nombre: usuarios[idx].NOMBRE });
      const showPin = process.env.ALLOW_DEV_PIN === "SI" || !mail.sent; return res.json({ success: true, sent: mail.sent, devPin: showPin ? pin : undefined });
    }

    if (a === "forgot-confirm") {
      const { empresa = "", proyecto = "", email = "", pin = "", newPassword = "" } = b;
      if (!empresa || !proyecto || !email || !pin || !newPassword) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
      if (String(newPassword).length < 6) return res.status(400).json({ success: false, codigo: "PASSWORD_CORTA" });
      const usuarios = await readRows("USUARIOS");
      const idx = usuarios.findIndex((u) =>
        String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
        u.EMPRESA === empresa && u.PROYECTO === proyecto && String(u.ACTIVO).toUpperCase() === "SI"
      );
      if (idx < 0) return res.status(401).json({ success: false, codigo: "PIN_INVALIDO" });
      const u = usuarios[idx];
      if (!u.RESET_PIN_HASH || !u.RESET_PIN_EXPIRES) return res.status(401).json({ success: false, codigo: "PIN_INVALIDO" });
      if (Date.now() > new Date(u.RESET_PIN_EXPIRES).getTime()) return res.status(401).json({ success: false, codigo: "PIN_EXPIRADO" });
      if (!safeCompare(u.RESET_PIN_HASH, sha256Hex(pin))) return res.status(401).json({ success: false, codigo: "PIN_INVALIDO" });
      usuarios[idx] = { ...u, PASSWORD_HASH: hashPassword(newPassword), MUST_CHANGE_PASSWORD: "NO", RESET_PIN_HASH: "", RESET_PIN_EXPIRES: "" };
      await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")));
      return res.json({ success: true });
    }

    if (a === "users-list" || a === "users-create" || a === "users-patch") {
      const c = await current(req);
      if (!c || String(c.u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
      const usuarios = await readRows("USUARIOS");

      if (a === "users-list") {
        const rows = usuarios.filter((u) => u.EMPRESA === c.u.EMPRESA && u.PROYECTO === c.u.PROYECTO)
          .map((u) => ({ ID_USUARIO: u.ID_USUARIO, NOMBRE: u.NOMBRE, EMAIL: u.EMAIL, ROL: u.ROL, TORRE: u.TORRE, ACTIVO: u.ACTIVO }));
        return res.json({ success: true, usuarios: rows });
      }

      if (a === "users-create") {
        const { nombre = "", email = "", rol = "RESIDENTE", torre = "*" } = b;
        if (!nombre || !email) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
        if (usuarios.some((u) => String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() && u.EMPRESA === c.u.EMPRESA && u.PROYECTO === c.u.PROYECTO))
          return res.status(409).json({ success: false, codigo: "USUARIO_YA_EXISTE" });
        const id = "U" + String(usuarios.length + 1).padStart(4, "0");
        const { randomBytes } = await import("crypto");
        const accessCode = "AC-" + randomBytes(12).toString("base64url").toUpperCase();
        const DEFAULT = "123456";
        usuarios.push({
          ID_USUARIO: id, NOMBRE: nombre, EMAIL: String(email).toLowerCase(), ROL: rol,
          EMPRESA: c.u.EMPRESA, PROYECTO: c.u.PROYECTO, TORRE: torre,
          SENDER_ID: String(email).toLowerCase(), PASSWORD_HASH: hashPassword(DEFAULT),
          MUST_CHANGE_PASSWORD: "SI", ACCESS_CODE_HASH: sha256Hex(accessCode),
          RESET_PIN_HASH: "", RESET_PIN_EXPIRES: "", ACTIVO: "SI"
        });
        await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")));
        return res.json({ success: true, usuario: { id, nombre, email, rol, torre, passwordInicial: DEFAULT, accessCode } });
      }

      if (a === "users-patch") {
        const { email = "", rol, torre, activo, resetPassword } = b;
        const idx = usuarios.findIndex((u) => String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() && u.EMPRESA === c.u.EMPRESA && u.PROYECTO === c.u.PROYECTO);
        if (idx < 0) return res.status(404).json({ success: false, codigo: "USUARIO_NO_EXISTE" });
        if (rol) usuarios[idx].ROL = rol;
        if (torre !== undefined) usuarios[idx].TORRE = torre;
        if (activo) usuarios[idx].ACTIVO = activo;
        if (resetPassword === true) { usuarios[idx].PASSWORD_HASH = hashPassword("123456"); usuarios[idx].MUST_CHANGE_PASSWORD = "SI"; }
        await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")));
        return res.json({ success: true });
      }
    }

    res.status(400).json({ success: false, codigo: "ACCION_NO_VALIDA" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}