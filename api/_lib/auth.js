import crypto from "crypto";
import { readRows } from "./sheets.js";

// Secreto de sesión: obligatorio en producción (fail-closed).
// Si falta SESSION_SECRET en producción, la app se niega a firmar tokens
// en lugar de usar un secreto conocido públicamente en el repo.
const SECRET = (() => {
  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (isProd) throw new Error("SESSION_SECRET no definida: configúrala en Vercel antes de desplegar.");
    return "appcontrol-dev-secret-temporal";
  }
  if (isProd && s.length < 32) throw new Error("SESSION_SECRET demasiado corta: usa 32+ caracteres aleatorios.");
  return s;
})();

export const sha256Hex = (i) =>
  crypto.createHash("sha256").update(String(i)).digest("hex");

export function safeCompare(a, b) {
  const aa = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  if (aa.length !== bb.length) {
    crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1));
    return false;
  }
  return crypto.timingSafeEqual(aa, bb);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 120000;
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const s = String(stored || "");
  if (/^[a-f0-9]{64}$/i.test(s)) {
    return safeCompare(sha256Hex(password), s);
  }
  const parts = s.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const [, iterations, salt, hash] = parts;
  const calc = crypto.pbkdf2Sync(String(password), salt, Number(iterations), 32, "sha256").toString("hex");
  return safeCompare(calc, hash);
}

function b64url(x) {
  return Buffer.from(x).toString("base64url");
}

export function createToken(payload, ttl) {
  const now = Math.floor(Date.now() / 1000);
  const data = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttl }));
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return data + "." + sig;
}

export function verifyToken(token) {
  try {
    const [data, sig] = String(token || "").split(".");
    if (!data || !sig) return null;
    const exp = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
    if (!safeCompare(exp, sig)) return null;
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (Math.floor(Date.now() / 1000) > (p.exp || 0)) return null;
    return p;
  } catch {
    return null;
  }
}

export function parseCookies(h) {
  const o = {};
  String(h || "").split(";").forEach((p) => {
    const [k, ...v] = p.trim().split("=");
    if (k) o[k] = decodeURIComponent(v.join("="));
  });
  return o;
}

export function resetPin() {
  // Criptográficamente aleatorio (Math.random es predecible).
  return String(crypto.randomInt(100000, 1000000));
}

// Contraseña temporal de 8 caracteres para usuarios creados o reseteados.
// Se muestra UNA vez al administrador y obliga a cambio en el primer login.
export function passwordTemporal() {
  return crypto.randomBytes(6).toString("base64url");
}