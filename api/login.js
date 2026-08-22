import { readRows } from "./_lib/sheets.js";
import { sha256Hex, safeCompare, createToken } from "./_lib/auth.js";
export default async function handler(req, res) {
  try {
    const { usuario = "", pin = "" } = req.body || {};
    if (!usuario || !pin) return res.status(400).json({ success: false });
    const usuarios = await readRows("USUARIOS");
    const u = usuarios.find((x) => x.SENDER_ID === usuario || x.ID_USUARIO === usuario);
    if (!u || String(u.ACTIVO).toUpperCase() !== "SI" || !safeCompare(u.PIN_HASH, sha256Hex(pin)))
      return res.status(401).json({ success: false, codigo: "CREDENCIALES_INVALIDAS" });
    const token = createToken({ sub: u.SENDER_ID || u.ID_USUARIO, scope: "web" }, 8 * 3600);
    res.setHeader("Set-Cookie", `appcontrol_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800; Secure`);
    res.json({ success: true, nombre: u.NOMBRE });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}
