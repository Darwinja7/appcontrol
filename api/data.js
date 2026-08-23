import { readRows, appendRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS, VALORES, habilitado } from "./_lib/model.js";
import { currentUser } from "./_lib/session.js";

// Tope de filas de REGISTRO enviadas al cliente en cada catálogo:
// el histórico crece sin límite y el payload no debería.
const MAX_REGISTRO = 2000;

const ESTADOS_VALIDOS = new Set(Object.keys(VALORES));

export default async function handler(req, res) {
  try {
    const c = await currentUser(req);
    if (!c) return res.status(401).json({ error: "UNAUTHORIZED" });
    const u = c.u;

    const a = (req.body || {}).action || (req.query || {}).action || "catalogos";

    if (a === "catalogos") {
      const [proyectos, capitulos, actividades, unidades, contratistas, configuracion, registro] = await Promise.all([
        readRows("PROYECTOS"), readRows("CAPITULOS"), readRows("ACTIVIDADES"),
        readRows("UNIDADES"), readRows("CONTRATISTAS"), readRows("CONFIGURACION"), readRows("REGISTRO")
      ]);

      // Aislamiento por tenant: cada usuario solo ve su empresa, su proyecto
      // y —si su TORRE no es "*"— únicamente su torre.
      const emp = String(u.EMPRESA || "");
      const proy = String(u.PROYECTO || "");
      const torre = String(u.TORRE || "*");
      const enTorre = (r) => torre === "*" || String(r.TORRE || "") === torre;

      return res.json({
        proyectos: proyectos.filter((p) => String(p.EMPRESA || "") === emp && String(p.CODIGO || "") === proy),
        capitulos: capitulos.filter((x) => String(x.PROYECTO || "") === proy),
        actividades,
        unidades: unidades.filter((x) => String(x.PROYECTO || "") === proy && enTorre(x)),
        contratistas,
        configuracion: configuracion.filter((r) => String(r.PROYECTO || "") === proy && enTorre(r)),
        registro: registro.filter((r) => String(r.PROYECTO || "") === proy && enTorre(r)).slice(-MAX_REGISTRO),
        me: { rol: u.ROL, proyecto: u.PROYECTO, torre: u.TORRE, nombre: u.NOMBRE, empresa: u.EMPRESA }
      });
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
        // El proyecto SIEMPRE viene del token, nunca del cliente.
        // Estados fuera del catálogo se descartan.
        if (!ESTADOS_VALIDOS.has(it.estado)) continue;
        const row = map.get([it.torre, it.actividad, it.nivel, it.unidad].join("|"));
        if (!row || !habilitado(row)) continue;
        rows.push([fecha, u.PROYECTO, it.torre, row.CAPITULO, it.actividad, String(it.nivel), it.unidad,
          it.estado, String(VALORES[it.estado] ?? 0), row.CONTRATISTA, u.SENDER_ID || u.EMAIL]);
      }
      if (rows.length) await appendRows("REGISTRO", HEADERS.REGISTRO, rows);
      return res.json({ success: true, registrados: rows.length });
    }

    res.status(400).json({ success: false, codigo: "ACCION_NO_VALIDA" });
  } catch (e) {
    console.error("[api/data]", e);
    res.status(500).json({ success: false, codigo: "ERROR_INTERNO" });
  }
}
