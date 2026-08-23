import { verifyToken, parseCookies } from "./auth.js";
import { readRows } from "./sheets.js";

// Bootstrap admin: SOLO con ENABLE_BOOTSTRAP=SI en el entorno (Vercel).
// Credenciales por variables de entorno, nunca embebidas en el código.
export const ENABLE_BOOTSTRAP = process.env.ENABLE_BOOTSTRAP === "SI";
export const BOOTSTRAP_EMAIL = (process.env.BOOTSTRAP_EMAIL || "").toLowerCase();
export const BOOTSTRAP_PASSWORD = process.env.BOOTSTRAP_PASSWORD || "";
export const bootstrapOk = ENABLE_BOOTSTRAP && !!BOOTSTRAP_EMAIL && !!BOOTSTRAP_PASSWORD;

export const SYNTH_EMPRESAS = [{ CODIGO: "E001", NOMBRE: "URBANIZADORA JIMENEZ", ACTIVO: "SI" }];
export const SYNTH_PROYECTOS = [
  { EMPRESA: "E001", CODIGO: "P000", NOMBRE: "SALGUERO ELITE 1", ACTIVO: "SI", DEMO: "SI" },
  { EMPRESA: "E001", CODIGO: "P001", NOMBRE: "SALGUERO ELITE 2", ACTIVO: "SI", DEMO: "NO" }
];

function bootUser(p) {
  return {
    ID_USUARIO: "BOOT", NOMBRE: "Admin (pruebas)", EMAIL: p.email,
    ROL: p.rol || "ADMIN", EMPRESA: p.empresa, PROYECTO: p.proyecto, TORRE: "*",
    ACTIVO: "SI", SENDER_ID: p.email
  };
}

function cookieHeader(req) {
  if (req.headers && typeof req.headers.get === "function") return req.headers.get("cookie");
  return req.headers?.cookie || "";
}

/**
 * Resuelve el usuario autenticado desde la cookie de sesión.
 * Devuelve { p, u } donde u es la fila de USUARIOS (o el usuario boot),
 * o null si no hay sesión válida y activa.
 * Compartido por /api/auth y /api/data.
 */
export async function currentUser(req) {
  const cookies = parseCookies(cookieHeader(req));
  const p = verifyToken(cookies.appcontrol_session);
  if (!p || p.scope !== "web") return null;
  const usuarios = await readRows("USUARIOS");
  const u = usuarios.find((x) =>
    String(x.EMAIL || "").toLowerCase() === String(p.email || "").toLowerCase() &&
    String(x.EMPRESA || "") === String(p.empresa || "") &&
    String(x.PROYECTO || "") === String(p.proyecto || "")
  );
  if (u && String(u.ACTIVO).toUpperCase() === "SI") return { p, u };
  if (bootstrapOk && p.boot === true) return { p, u: bootUser(p) };
  return null;
}
