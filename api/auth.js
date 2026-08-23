import { readRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS } from "./_lib/model.js";
import {
  verifyPassword, hashPassword, createToken,
  sha256Hex, safeCompare, resetPin, passwordTemporal
} from "./_lib/auth.js";
import { limitar, ipCliente } from "./_lib/rate-limit.js";
import {
  currentUser, bootstrapOk, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD,
  SYNTH_EMPRESAS, SYNTH_PROYECTOS, esDesarrollador
} from "./_lib/session.js";

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

// Validacion en cascada para asignar usuarios: empresa activa > proyecto
// activo perteneciente a esa empresa.
async function destinoValido(empresa, proyecto) {
  const [empresas, proyectos] = await Promise.all([readRows("EMPRESAS"), readRows("PROYECTOS")]);
  const empOk = empresas.find((e) => e.CODIGO === empresa && String(e.ACTIVO).toUpperCase() === "SI");
  const proyOk = proyectos.find((p) => p.EMPRESA === empresa && p.CODIGO === proyecto && String(p.ACTIVO).toUpperCase() === "SI");
  return !!(empOk && proyOk);
}

// Torres reales del proyecto: union de NIVELES y UNIDADES (misma fuente del
// modulo de configuracion).
async function torresDeProyecto(proyecto) {
  const [niveles, unidades] = await Promise.all([readRows("NIVELES"), readRows("UNIDADES")]);
  return [...new Set([
    ...niveles.filter((n) => String(n.PROYECTO || "") === proyecto).map((n) => String(n.TORRE || "")),
    ...unidades.filter((x) => String(x.PROYECTO || "") === proyecto).map((x) => String(x.TORRE || ""))
  ])].filter(Boolean);
}

// Regla de torre por rol: "*" solo para ADMIN/VISUALIZADOR; RESIDENTE exige
// una torre real del proyecto.
function torreValida(torre, rol, torresProy) {
  const t = String(torre || "").trim();
  if (t === "*") return ["ADMIN", "VISUALIZADOR"].includes(String(rol)) ? { t } : null;
  if (!t) return null;
  return torresProy.includes(t) ? { t } : null;
}

// Combinacion final coherente en users-patch: un RESIDENTE nunca queda con "*".
function combinacionRolTorreOk(u) {
  const t = String(u.TORRE || "").trim();
  if (t !== "*") return true;
  return ["ADMIN", "VISUALIZADOR"].includes(String(u.ROL || "").toUpperCase());
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
      return res.json({ success: true, usuario: { id: c.u.ID_USUARIO, nombre: c.u.NOMBRE, email: c.u.EMAIL, rol: c.u.ROL, empresa: c.u.EMPRESA, proyecto: c.u.PROYECTO, torre: c.u.TORRE, esDesarrollador: esDesarrollador(c.u) } });
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
      usuarios[idx] = { ...usuarios[idx], PASSWORD_HASH: hashPassword(newPassword), MUST_CHANGE_PASSWORD: "NO", RESET_PIN_HASH: "", RESET_PIN: "", RESET_PIN_EXPIRES: "" };
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
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      usuarios[idx] = { ...usuarios[idx], RESET_PIN_HASH: sha256Hex(pin), RESET_PIN: pin, RESET_PIN_EXPIRES: expires };
      await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);
      // El PIN no viaja en la respuesta: queda visible solo para ADMIN en el
      // modulo de usuarios (accion "reset-pins"), quien lo comparte con el
      // usuario por el canal que prefiera. En desarrollo se permite verlo con
      // ALLOW_DEV_PIN=SI.
      const showPin = process.env.ALLOW_DEV_PIN === "SI";
      return res.json({ success: true, devPin: showPin ? pin : undefined });
    }

    // Lista de PINs de recuperacion pendientes (vigentes) para este proyecto.
    // Solo ADMIN; cualquier admin actual los ve porque se leen de la hoja.
    if (a === "reset-pins") {
      const c = await currentUser(req);
      if (!c || String(c.u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
      if (!limitar(`reset-pins:${c.u.EMAIL}`, 30, 60_000))
        return res.status(429).json({ success: false, codigo: "DEMASIADOS_INTENTOS" });
      const usuarios = await readRows("USUARIOS");
      const ahora = Date.now();
      const pendientes = usuarios
        .filter((u) => u.EMPRESA === c.u.EMPRESA && u.PROYECTO === c.u.PROYECTO && u.RESET_PIN && u.RESET_PIN_EXPIRES)
        .filter((u) => ahora <= new Date(u.RESET_PIN_EXPIRES).getTime())
        .map((u) => ({ NOMBRE: u.NOMBRE, EMAIL: u.EMAIL, ROL: u.ROL, PIN: u.RESET_PIN, EXPIRA: u.RESET_PIN_EXPIRES }));
      return res.json({ success: true, pendientes });
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
      usuarios[idx] = { ...u, PASSWORD_HASH: hashPassword(newPassword), MUST_CHANGE_PASSWORD: "NO", RESET_PIN_HASH: "", RESET_PIN: "", RESET_PIN_EXPIRES: "" };
      await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);
      return res.json({ success: true });
    }

    // Torres disponibles de un proyecto (selects de asignacion de usuarios).
    if (a === "torres-list") {
      const c = await currentUser(req);
      if (!c || String(c.u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
      const esDev = esDesarrollador(c.u);
      const emp = String(b.empresa || c.u.EMPRESA);
      const proy = String(b.proyecto || c.u.PROYECTO);
      if (!esDev && (emp !== c.u.EMPRESA || proy !== c.u.PROYECTO))
        return res.status(403).json({ success: false, codigo: "FUERA_DE_TU_PROYECTO" });
      if (!(await destinoValido(emp, proy))) return res.status(400).json({ success: false, codigo: "PROYECTO_INVALIDO" });
      return res.json({ success: true, torres: await torresDeProyecto(proy) });
    }

    // Organizaciones: solo el admin desarrollador crea o edita empresas y
    // proyectos. La lectura publica ya existe en la accion "options".
    if (a === "empresas-save" || a === "proyectos-save") {
      const c = await currentUser(req);
      if (!c || !esDesarrollador(c.u)) return res.status(403).json({ success: false, codigo: "SOLO_DESARROLLADOR" });

      if (a === "empresas-save") {
        const { codigo = "", nombre = "", activo = "SI", codigoOriginal } = b;
        if (!codigo || !nombre) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
        if (!["SI", "NO"].includes(String(activo).toUpperCase())) return res.status(400).json({ success: false, codigo: "VALOR_INVALIDO" });
        const empresas = await readRows("EMPRESAS");
        const idx = codigoOriginal ? empresas.findIndex((e) => e.CODIGO === codigoOriginal) : -1;
        const duplicado = empresas.some((e, i) => i !== idx && e.CODIGO === codigo);
        if (duplicado) return res.status(409).json({ success: false, codigo: "CODIGO_YA_EXISTE" });
        if (idx >= 0) empresas[idx] = { ...empresas[idx], CODIGO: codigo, NOMBRE: nombre, ACTIVO: String(activo).toUpperCase() };
        else empresas.push({ CODIGO: codigo, NOMBRE: nombre, ACTIVO: String(activo).toUpperCase() });
        await replaceRows("EMPRESAS", HEADERS.EMPRESAS, empresas.map((r) => HEADERS.EMPRESAS.map((h) => r[h] ?? "")), empresas.length);
        return res.json({ success: true });
      }

      if (a === "proyectos-save") {
        const { empresa = "", codigo = "", nombre = "", activo = "SI", demo = "NO", codigoOriginal } = b;
        if (!empresa || !codigo || !nombre) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
        if (!["SI", "NO"].includes(String(activo).toUpperCase()) || !["SI", "NO"].includes(String(demo).toUpperCase()))
          return res.status(400).json({ success: false, codigo: "VALOR_INVALIDO" });
        const empresas = await readRows("EMPRESAS");
        if (!empresas.find((e) => e.CODIGO === empresa && String(e.ACTIVO).toUpperCase() === "SI"))
          return res.status(400).json({ success: false, codigo: "EMPRESA_INVALIDA" });
        const proyectos = await readRows("PROYECTOS");
        const idx = codigoOriginal ? proyectos.findIndex((p) => p.CODIGO === codigoOriginal && p.EMPRESA === empresa) : -1;
        const duplicado = proyectos.some((p, i) => i !== idx && p.EMPRESA === empresa && p.CODIGO === codigo);
        if (duplicado) return res.status(409).json({ success: false, codigo: "CODIGO_YA_EXISTE" });
        if (idx >= 0) proyectos[idx] = { ...proyectos[idx], EMPRESA: empresa, CODIGO: codigo, NOMBRE: nombre, ACTIVO: String(activo).toUpperCase(), DEMO: String(demo).toUpperCase() };
        else proyectos.push({ EMPRESA: empresa, CODIGO: codigo, NOMBRE: nombre, ACTIVO: String(activo).toUpperCase(), DEMO: String(demo).toUpperCase() });
        await replaceRows("PROYECTOS", HEADERS.PROYECTOS, proyectos.map((r) => HEADERS.PROYECTOS.map((h) => r[h] ?? "")), proyectos.length);
        return res.json({ success: true });
      }
    }

    if (a === "users-list" || a === "users-create" || a === "users-patch") {
      const c = await currentUser(req);
      if (!c || String(c.u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
      const esDev = esDesarrollador(c.u);
      const usuarios = await readRows("USUARIOS");

      if (a === "users-list") {
        const rows = usuarios.filter((u) => u.EMPRESA === c.u.EMPRESA && u.PROYECTO === c.u.PROYECTO)
          .map((u) => ({ ID_USUARIO: u.ID_USUARIO, NOMBRE: u.NOMBRE, EMAIL: u.EMAIL, ROL: u.ROL, EMPRESA: u.EMPRESA, PROYECTO: u.PROYECTO, TORRE: u.TORRE, ACTIVO: u.ACTIVO }));
        return res.json({ success: true, usuarios: rows });
      }

      if (a === "users-create") {
        const { nombre = "", email = "", rol = "RESIDENTE", torre = "*", empresa, proyecto } = b;
        const empDestino = String(empresa || c.u.EMPRESA);
        const proyDestino = String(proyecto || c.u.PROYECTO);
        if (!nombre || !email) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
        // Aislamiento por tenant: salvo admin desarrollador, solo se crea
        // usuarios dentro de la empresa/proyecto propios.
        if (!esDev && (empDestino !== c.u.EMPRESA || proyDestino !== c.u.PROYECTO))
          return res.status(403).json({ success: false, codigo: "FUERA_DE_TU_PROYECTO" });
        if (!(await destinoValido(empDestino, proyDestino))) return res.status(400).json({ success: false, codigo: "PROYECTO_INVALIDO" });
        if (!ROLES_VALIDOS.includes(String(rol))) return res.status(400).json({ success: false, codigo: "ROL_INVALIDO" });
        const tv = torreValida(torre, rol, await torresDeProyecto(proyDestino));
        if (!tv) return res.status(400).json({ success: false, codigo: "TORRE_INVALIDA" });
        if (usuarios.some((u) => String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() && u.EMPRESA === empDestino && u.PROYECTO === proyDestino))
          return res.status(409).json({ success: false, codigo: "USUARIO_YA_EXISTE" });
        const id = siguienteIdUsuario(usuarios);
        const { randomBytes } = await import("crypto");
        const accessCode = "AC-" + randomBytes(12).toString("base64url").toUpperCase();
        const tempPass = passwordTemporal();
        usuarios.push({
          ID_USUARIO: id, NOMBRE: nombre, EMAIL: String(email).toLowerCase(), ROL: rol,
          EMPRESA: empDestino, PROYECTO: proyDestino, TORRE: tv.t,
          SENDER_ID: String(email).toLowerCase(), PASSWORD_HASH: hashPassword(tempPass),
          MUST_CHANGE_PASSWORD: "SI", ACCESS_CODE_HASH: sha256Hex(accessCode),
          RESET_PIN_HASH: "", RESET_PIN: "", RESET_PIN_EXPIRES: "", ACTIVO: "SI"
        });
        await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);
        return res.json({ success: true, usuario: { id, nombre, email, rol, torre: tv.t, passwordInicial: tempPass, accessCode } });
      }

      if (a === "users-patch") {
        const { email = "", rol, torre, activo, resetPassword, empresa, proyecto } = b;
        const reqEmp = String(empresa || c.u.EMPRESA);
        const reqProy = String(proyecto || c.u.PROYECTO);
        if (!esDev && (reqEmp !== c.u.EMPRESA || reqProy !== c.u.PROYECTO))
          return res.status(403).json({ success: false, codigo: "FUERA_DE_TU_PROYECTO" });
        const idx = usuarios.findIndex((u) => String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() && u.EMPRESA === reqEmp && u.PROYECTO === reqProy);
        if (idx < 0) return res.status(404).json({ success: false, codigo: "USUARIO_NO_EXISTE" });
        if (rol !== undefined && rol !== "") {
          if (!ROLES_VALIDOS.includes(String(rol))) return res.status(400).json({ success: false, codigo: "ROL_INVALIDO" });
          usuarios[idx].ROL = String(rol);
        }
        if (torre !== undefined && torre !== "") {
          const tv = torreValida(torre, usuarios[idx].ROL, await torresDeProyecto(usuarios[idx].PROYECTO));
          if (!tv) return res.status(400).json({ success: false, codigo: "TORRE_INVALIDA" });
          usuarios[idx].TORRE = tv.t;
        }
        // Combinacion final rol/torre siempre coherente ("*" no aplica a RESIDENTE).
        if (!(await combinacionRolTorreOk(usuarios[idx]))) return res.status(400).json({ success: false, codigo: "TORRE_INVALIDA" });
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