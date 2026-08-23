import { readRows, appendRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS, VALORES, habilitado } from "./_lib/model.js";
import { parseCookies, verifyToken } from "./_lib/auth.js";

function cookieHeader(req) {
  if (req.headers && typeof req.headers.get === "function") return req.headers.get("cookie");
  return req.headers?.cookie || "";
}

async function current(req) {
  const cookies = parseCookies(cookieHeader(req));
  const p = verifyToken(cookies.appcontrol_session);
  if (!p || p.scope !== "web") return null;
  const usuarios = await readRows("USUARIOS");
  return usuarios.find((x) =>
    String(x.EMAIL || "").toLowerCase() === String(p.email || "").toLowerCase() &&
    String(x.EMPRESA || "") === String(p.empresa || "") &&
    String(x.PROYECTO || "") === String(p.proyecto || "")
  ) || null;
}

export default async function handler(req, res) {
  try {
    const u = await current(req);
    if (!u) return res.status(401).json({ error: "UNAUTHORIZED" });

    const a = (req.body || {}).action || (req.query || {}).action || "catalogos";

    if (a === "catalogos") {
      const [proyectos, capitulos, actividades, unidades, contratistas, configuracion, registro] = await Promise.all([
        readRows("PROYECTOS"), readRows("CAPITULOS"), readRows("ACTIVIDADES"),
        readRows("UNIDADES"), readRows("CONTRATISTAS"), readRows("CONFIGURACION"), readRows("REGISTRO")
      ]);
      return res.json({ proyectos, capitulos, actividades, unidades, contratistas, configuracion, registro,
        me: { rol: u.ROL, proyecto: u.PROYECTO, torre: u.TORRE, nombre: u.NOMBRE } });
    }

    if (a === "config-save") {
      if (String(u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
      const rows = (req.body || {}).rows || [];
      const normalized = rows.map((r) => ({ ...r, HABILITADO: habilitado(r) ? "SI" : "NO" }));
      await replaceRows("CONFIGURACION", HEADERS.CONFIGURACION, normalized.map((r) => HEADERS.CONFIGURACION.map((h) => r[h] ?? "")));
      return res.json({ success: true, guardadas: normalized.length });
    }

    if (a === "registro-save") {
      const items = (req.body || {}).items || [];
      if (!items.length) return res.status(400).json({ success: false });
      const cfg = await readRows("CONFIGURACION");
      const map = new Map(cfg.map((r) => [[r.TORRE, r.ACTIVIDAD, r.NIVEL, r.UNIDAD].join("|"), r]));
      const fecha = new Date().toISOString();
      const rows = [];
      for (const it of items) {
        const row = map.get([it.torre, it.actividad, it.nivel, it.unidad].join("|"));
        if (!row || !habilitado(row)) continue;
        rows.push([fecha, it.proyecto, it.torre, row.CAPITULO, it.actividad, String(it.nivel), it.unidad,
          it.estado, String(VALORES[it.estado] ?? 0), row.CONTRATISTA, u.SENDER_ID || u.EMAIL]);
      }
      if (rows.length) await appendRows("REGISTRO", HEADERS.REGISTRO, rows);
      return res.json({ success: true, registrados: rows.length });
    }

    res.status(400).json({ success: false, codigo: "ACCION_NO_VALIDA" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}