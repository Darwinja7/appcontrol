import { readRows, appendRows } from "./_lib/sheets.js";
import { requireUser } from "./_lib/auth.js";
import { HEADERS, VALORES, habilitado, keyCfg } from "./_lib/model.js";
export default async function handler(req, res) {
  const u = await requireUser(req);
  if (!u) return res.status(401).json({ success: false });
  const items = (req.body || {}).items || [];
  if (!items.length) return res.status(400).json({ success: false });
  const cfg = await readRows("CONFIGURACION");
  const map = new Map(cfg.map((r) => [keyCfg(r), r]));
  const fecha = new Date().toISOString();
  const rows = [];
  for (const it of items) {
    const row = map.get([it.torre, it.actividad, it.nivel, it.unidad].join("|"));
    if (!row || !habilitado(row)) continue; // regla de oro: solo habilitados
    rows.push([fecha, it.proyecto, it.torre, row.CAPITULO, it.actividad, String(it.nivel), it.unidad,
      it.estado, String(VALORES[it.estado] ?? 0), row.CONTRATISTA, u.SENDER_ID || u.ID_USUARIO]);
  }
  if (rows.length) await appendRows("REGISTRO", HEADERS.REGISTRO, rows);
  res.json({ success: true, registrados: rows.length });
}
