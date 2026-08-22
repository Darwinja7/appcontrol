import { replaceRows } from "./_lib/sheets.js";
import { requireUser } from "./_lib/auth.js";
import { HEADERS, habilitado } from "./_lib/model.js";
export default async function handler(req, res) {
  const u = await requireUser(req);
  if (!u) return res.status(401).json({ success: false });
  if (String(u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
  const rows = (req.body || {}).rows || [];
  const normalized = rows.map((r) => ({ ...r, HABILITADO: habilitado(r) ? "SI" : "NO" }));
  await replaceRows("CONFIGURACION", HEADERS.CONFIGURACION,
    normalized.map((r) => HEADERS.CONFIGURACION.map((h) => r[h] ?? "")));
  res.json({ success: true, guardadas: normalized.length });
}
