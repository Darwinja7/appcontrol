import crypto from "crypto";
import { readRows } from "./sheets.js";
export const sha256Hex = (i) => crypto.createHash("sha256").update(String(i)).digest("hex");
export function safeCompare(a, b) {
  const ab = Buffer.from(String(a ?? "")), bb = Buffer.from(String(b ?? ""));
  if (ab.length !== bb.length) { crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1)); return false; }
  return crypto.timingSafeEqual(ab, bb);
}
function b64url(x) { return Buffer.from(x).toString("base64url"); }
export function createToken(payload, ttl) {
  const now = Math.floor(Date.now() / 1000);
  const data = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttl }));
  const sig = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(data).digest("base64url");
  return data + "." + sig;
}
export function verifyToken(token) {
  try {
    const [data, sig] = String(token || "").split(".");
    if (!data || !sig) return null;
    const exp = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(data).digest("base64url");
    if (!safeCompare(exp, sig)) return null;
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (Math.floor(Date.now() / 1000) > (p.exp || 0)) return null;
    return p;
  } catch { return null; }
}
export function parseCookies(h) {
  const o = {};
  (h || "").split(";").forEach((p) => { const [k, ...v] = p.trim().split("="); if (k) o[k] = decodeURIComponent(v.join("=")); });
  return o;
}
export async function requireUser(req) {
  const cookies = parseCookies(req.headers.get("cookie"));
  const p = verifyToken(cookies.appcontrol_session);
  if (!p || p.scope !== "web") return null;
  const usuarios = await readRows("USUARIOS");
  return usuarios.find((u) => u.SENDER_ID === p.sub || u.ID_USUARIO === p.sub) || null;
}
