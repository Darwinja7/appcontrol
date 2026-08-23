import { readRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS } from "./_lib/model.js";
import {
  verifyPassword, hashPassword, createToken,
  sha256Hex, safeCompare, resetPin, passwordTemporal
} from "./_lib/auth.js";
import { limitar, ipCliente } from "./_lib/rate-limit.js";
import {
  currentUser, bootstrapOk, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD,
  SYNTH_EMPRESAS, SYNTH_PROYECTOS
} from "./_lib/session.js";
import { sendResetPin } from "./_lib/mail.js";

const ROLES_VALIDOS = ["ADMIN", "RESIDENTE", "VISUALIZADOR"];

// ID sin colisiones: máximo numérico existente + 1 (no length+1, que colisiona
// si alguna fila se elimina manualmente de la hoja).
function siguienteIdUsuario(usuarios) {
  const max = usuarios.reduce((m, u) => {
    const n = parseInt(String(u.ID_USUARIO || "").replace(/^U/, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return "U" + String(max + 1).padStart(4, "0");
}

function setSession(res, email, empresa, proyecto, rol, boot = false) {
  const token = createToken({ email, empresa, proyecto, rol, boot, scope: "web" }, 8 * 3600);
  res.setHeader("Set-Cookie", `appcontrol_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800; Secure`);
}

export default async function handler(req, res) {
  try {
    const b = req.body || {};
    const a = b.action || "";

    if (a === "options") {
      let empresas = (await readRows("EMPRESAS")).filter((e) => String(e.ACTIVO).toUpperCase() === "SI");
      let proyectos = (await readRows("PROYECTOS")).filter((p) => String(p.ACTIVO).toUpperCase() === "SI");
      if (bootstrapOk) {
        if (!empresas.length) empresas = SYNTH_EMPRESAS;
        if (!proyectos.length) proyectos = SYNTH_PROYECTOS;
      }
      return res.json({ success: true, empresas, proyectos });
    }

    if (a === "login") {
      const { empresa = "", proyecto = "", email = "", password = "" } = b;
      if (!empresa || !proyecto || !email || !password) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
      const ip = ipCliente(req);
      const claveEmail = `login-em:${empresa}|${proyecto}|${String(email).toLowerCase()}`;
      if (!limitar(`login-ip:${ip}`, 20, 60_000) || !limitar(claveEmail, 10, 60_000))
        return res.status(429).json({ success: false, codigo: "DEMASIADOS_INTENTOS" });

      const [empresas, proyectos, usuarios] = await Promise.all([readRows("EMPRESAS"), readRows("PROYECTOS"), readRows("USUARIOS")]);
      const empOk = empresas.find((e) => e.CODIGO === empresa && String(e.ACTIVO).toUpperCase() === "SI") ||
        (bootstrapOk && SYNTH_EMPRESAS.find((e) => e.CODIGO === empresa));
      if (!empOk) return res.status(401).json({ success: false, codigo: "EMPRESA_INVALIDA" });
      const proyOk = proyectos.find((p) => p.EMPRESA === empresa && p.CODIGO === proyecto && String(p.ACTIVO).toUpperCase() === "SI") ||
        (bootstrapOk && SYNTH_PROYECTOS.find((p) => p.EMPRESA === empresa && p.CODIGO === proyecto));
      if (!proyOk) return res.status(401).json({ success: false, codigo: "PROYECTO_INVALIDO" });

      let u = usuarios.find((x) =>
        String(x.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
        x.EMPRESA === empresa && x.PROYECTO === proyecto
      );
      let boot = false;

      if (!u || String(u.ACTIVO).toUpperCase() !== "SI") {
        if (bootstrapOk && String(email).toLowerCase() === BOOTSTRAP_EMAIL && password === BOOTSTRAP_PASSWORD) {
          boot = true;
        } else {
          return res.status(401).json({ success: false, codigo: "USUARIO_INACTIVO_O_INVALIDO" });
        }
      } else if (!verifyPassword(password, u.PASSWORD_HASH)) {
        return res.status(401).json({ success: false, codigo: "CREDENCIALES_INVALIDAS" });
      }

      if (!boot && String(u.MUST_CHANGE_PASSWORD).toUpperCase() === "SI") {
        return res.json({ success: true, mustChangePassword: true, email: u.EMAIL, empresa, proyecto });
      }

      if (boot) {
        setSession(res, BOOTSTRAP_EMAIL, empresa, proyecto, "ADMIN", true);
        return res.json({ success: true, mustChangePassword: false, boot: true,
          usuario: { nombre: "Admin (pruebas)", email: BOOTSTRAP_EMAIL, rol: "ADMIN", empresa, proyecto } });
      }

      setSession(res, u.EMAIL, empresa, proyecto, u.ROL);
      return res.json({ success: true, mustChangePassword: false,
        usuario: { nombre: u.NOMBRE, email: u.EMAIL, rol: u.ROL, empresa, proyecto } });
    }

    if (a === "logout") {
      res.setHeader("Set-Cookie", "appcontrol_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
      return res.json({ success: true });
    }

    if (a === "me") {
      const c = await currentUser(req);
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
      await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);
      setSession(res, usuarios[idx].EMAIL, empresa, proyecto, usuarios[idx].ROL);
      return res.json({ success: true });
    }

    if (a === "forgot-start") {
      const { empresa = "", proyecto = "", email = "" } = b;
      if (!empresa || !proyecto || !email) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
      if (!limitar(`forgot-start:${ipCliente(req)}`, 5, 15 * 60_000))
        return res.status(429).json({ success: false, codigo: "DEMASIADOS_INTENTOS" });
      const usuarios = await readRows("USUARIOS");
      const idx = usuarios.findIndex((u) =>
        String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
        u.EMPRESA === empresa && u.PROYECTO === proyecto && String(u.ACTIVO).toUpperCase() === "SI"
      );
      if (idx < 0) return res.json({ success: true });
      const pin = resetPin();
      const expires = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      usuarios[idx] = { ...usuarios[idx], RESET_PIN_HASH: sha256Hex(pin), RESET_PIN_EXPIRES: expires };
      await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);
      const mail = await sendResetPin({ to: usuarios[idx].EMAIL, pin, nombre: usuarios[idx].NOMBRE });
      // El PIN JAMÁS viaja en la respuesta salvo que ALLOW_DEV_PIN=SI esté
      // definido explícitamente en el entorno (entornos de desarrollo only).
      const showPin = process.env.ALLOW_DEV_PIN === "SI";
      return res.json({ success: true, sent: mail.sent, devPin: showPin ? pin : undefined });
    }

    if (a === "forgot-confirm") {
      const { empresa = "", proyecto = "", email = "", pin = "", newPassword = "" } = b;
      if (!empresa || !proyecto || !email || !pin || !newPassword) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
      if (String(newPassword).length < 6) return res.status(400).json({ success: false, codigo: "PASSWORD_CORTA" });
      if (!limitar(`forgot-confirm:${ipCliente(req)}|${String(email).toLowerCase()}`, 10, 15 * 60_000))
        return res.status(429).json({ success: false, codigo: "DEMASIADOS_INTENTOS" });
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
      await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);
      return res.json({ success: true });
    }

    if (a === "users-list" || a === "users-create" || a === "users-patch") {
      const c = await currentUser(req);
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
        if (!ROLES_VALIDOS.includes(String(rol))) return res.status(400).json({ success: false, codigo: "ROL_INVALIDO" });
        if (usuarios.some((u) => String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() && u.EMPRESA === c.u.EMPRESA && u.PROYECTO === c.u.PROYECTO))
          return res.status(409).json({ success: false, codigo: "USUARIO_YA_EXISTE" });
        const id = siguienteIdUsuario(usuarios);
        const { randomBytes } = await import("crypto");
        const accessCode = "AC-" + randomBytes(12).toString("base64url").toUpperCase();
        const tempPass = passwordTemporal();
        usuarios.push({
          ID_USUARIO: id, NOMBRE: nombre, EMAIL: String(email).toLowerCase(), ROL: rol,
          EMPRESA: c.u.EMPRESA, PROYECTO: c.u.PROYECTO, TORRE: torre,
          SENDER_ID: String(email).toLowerCase(), PASSWORD_HASH: hashPassword(tempPass),
          MUST_CHANGE_PASSWORD: "SI", ACCESS_CODE_HASH: sha256Hex(accessCode),
          RESET_PIN_HASH: "", RESET_PIN_EXPIRES: "", ACTIVO: "SI"
        });
        await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);
        return res.json({ success: true, usuario: { id, nombre, email, rol, torre, passwordInicial: tempPass, accessCode } });
      }

      if (a === "users-patch") {
        const { email = "", rol, torre, activo, resetPassword } = b;
        const idx = usuarios.findIndex((u) => String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() && u.EMPRESA === c.u.EMPRESA && u.PROYECTO === c.u.PROYECTO);
        if (idx < 0) return res.status(404).json({ success: false, codigo: "USUARIO_NO_EXISTE" });
        if (rol !== undefined && rol !== "") {
          if (!ROLES_VALIDOS.includes(String(rol))) return res.status(400).json({ success: false, codigo: "ROL_INVALIDO" });
          usuarios[idx].ROL = String(rol);
        }
        if (torre !== undefined) usuarios[idx].TORRE = String(torre).trim() || "*";
        if (activo !== undefined && activo !== "") {
          const v = String(activo).toUpperCase();
          if (!["SI", "NO"].includes(v)) return res.status(400).json({ success: false, codigo: "VALOR_INVALIDO" });
          usuarios[idx].ACTIVO = v;
        }
        if (resetPassword === true) {
          const tempPass = passwordTemporal();
          usuarios[idx].PASSWORD_HASH = hashPassword(tempPass);
          usuarios[idx].MUST_CHANGE_PASSWORD = "SI";
          await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);
          return res.json({ success: true, passwordTemporal: tempPass });
        }
        await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);
        return res.json({ success: true });
      }
    }

    res.status(400).json({ success: false, codigo: "ACCION_NO_VALIDA" });
  } catch (e) {
    console.error("[api/auth]", e);
    res.status(500).json({ success: false, codigo: "ERROR_INTERNO" });
  }
}