import { readRows, appendRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS, VALORES, habilitado } from "./_lib/model.js";
import { currentUser } from "./_lib/session.js";

// Tope de filas de REGISTRO enviadas al cliente en cada catálogo:
// el histórico crece sin límite y el payload no debería.
const MAX_REGISTRO = 2000;

const ESTADOS_VALIDOS = new Set(Object.keys(VALORES));

const num = (v) => { const n = parseFloat(String(v ?? "0").replace(",", ".")); return isNaN(n) ? 0 : n; };

/**
 * Calcula el avance ponderado de un proyecto a partir de los datos crudos.
 * Misma matemática que el dashboard: actividad -> capitulo -> proyecto.
 * Devuelve { general, niveles:[{n,pct}], unidades:[{u,pct}] } en porcentaje 0-100.
 */
export function calcularAvance(cfgRows, actividades, capitulos, registroRows, proyecto) {
  const capPond = new Map(capitulos.map((c) => [String(c.CODIGO), num(c.PONDERACION)]));
  const actInfo = new Map(actividades.map((a) => [String(a.CODIGO), a]));

  // Ultimo estado por actividad|nivel|unidad
  const last = new Map();
  for (const r of registroRows) {
    if (proyecto && String(r.PROYECTO || "") !== String(proyecto)) continue;
    const k = r.ACTIVIDAD + "|" + r.NIVEL + "|" + r.UNIDAD;
    if (!last.has(k) || String(r.FECHA) > String(last.get(k).FECHA)) last.set(k, r);
  }
  const valOf = (r) => {
    const l = last.get(r.ACTIVIDAD + "|" + r.NIVEL + "|" + r.UNIDAD);
    return l ? (VALORES[l.ESTADO] ?? 0) : 0;
  };
  const habilitadas = cfgRows.filter((r) => String(r.PROYECTO || "") === String(proyecto) && habilitado(r));

  let general = 0;
  const porNivel = {};
  const porUnidad = {};
  for (const r of habilitadas) {
    const info = actInfo.get(String(r.ACTIVIDAD));
    if (!info) continue;
    const pond = num(info.PONDERACION) * (capPond.get(String(info.CAPITULO)) ?? 0);
    const v = valOf(r) * pond;
    general += v;
    const nk = String(r.NIVEL);
    (porNivel[nk] ||= { suma: 0, pond: 0 });
    porNivel[nk].suma += v;
    porNivel[nk].pond += pond;
    const uk = String(r.UNIDAD);
    (porUnidad[uk] ||= { suma: 0, pond: 0 });
    porUnidad[uk].suma += v;
    porUnidad[uk].pond += pond;
  }
  return {
    general: Math.min(100, general * 100),
    niveles: Object.entries(porNivel).map(([n, d]) => ({ n, pct: Math.min(100, d.pond ? (d.suma / d.pond) * 100 : 0) })).sort((x, y) => +x.n - +y.n),
    unidades: Object.entries(porUnidad).map(([u, d]) => ({ u, pct: Math.min(100, d.pond ? (d.suma / d.pond) * 100 : 0) })).sort((x, y) => x.u.localeCompare(y.u))
  };
}

/**
 * Snapshot diario: guarda GENERAL + NIVELES + UNIDADES en HISTORICO si hoy
 * aun no hay snapshot para el proyecto. Falla en silencio (log) para no
 * romper el registro de avance.
 */
async function snapshotDiaria(proyecto) {
  try {
    const [hist, cfg, acts, caps, registro] = await Promise.all([
      readRows("HISTORICO"), readRows("CONFIGURACION"), readRows("ACTIVIDADES"),
      readRows("CAPITULOS"), readRows("REGISTRO")
    ]);
    const hoy = new Date().toISOString().slice(0, 10);
    if (hist.some((h) => String(h.PROYECTO || "") === String(proyecto) && String(h.FECHA || "").slice(0, 10) === hoy)) return;
    const av = calcularAvance(cfg, acts, caps, registro, proyecto);
    const fecha = new Date().toISOString();
    const filas = [[fecha, proyecto, "GENERAL", av.general.toFixed(1)]];
    for (const n of av.niveles) filas.push([fecha, proyecto, "NIVEL:" + n.n, n.pct.toFixed(1)]);
    for (const un of av.unidades) filas.push([fecha, proyecto, "UNIDAD:" + un.u, un.pct.toFixed(1)]);
    await appendRows("HISTORICO", HEADERS.HISTORICO, filas);
  } catch (e) {
    console.error("[historico] snapshot fallo (no bloquea registro):", e?.message || e);
  }
}

export default async function handler(req, res) {
  try {
    const c = await currentUser(req);
    if (!c) return res.status(401).json({ error: "UNAUTHORIZED" });
    const u = c.u;

    const a = (req.body || {}).action || (req.query || {}).action || "catalogos";

    if (a === "catalogos") {
      const [proyectos, capitulos, actividades, niveles, unidades, contratistas, configuracion, registro] = await Promise.all([
        readRows("PROYECTOS"), readRows("CAPITULOS"), readRows("ACTIVIDADES"),
        readRows("NIVELES"), readRows("UNIDADES"), readRows("CONTRATISTAS"),
        readRows("CONFIGURACION"), readRows("REGISTRO")
      ]);

      // Aislamiento por tenant: cada usuario solo ve su empresa, su proyecto
      // y —si su TORRE no es "*"— únicamente su torre.
      const emp = String(u.EMPRESA || "");
      const proy = String(u.PROYECTO || "");
      const torre = String(u.TORRE || "*");
      const enTorre = (r) => torre === "*" || String(r.TORRE || "") === torre;

      // Relacion actividad<->proyecto: ACTIVIDADES no tiene columna PROYECTO,
      // se resuelve via su capitulo. Solo actividades activas cuyo capitulo
      // pertenece al proyecto actual.
      const capsProy = new Set(
        capitulos
          .filter((x) => String(x.PROYECTO || "") === proy && String(x.ACTIVO || "").toUpperCase() === "SI")
          .map((x) => String(x.CODIGO || ""))
      );
      const actsProy = actividades.filter(
        (x) => String(x.ACTIVO || "").toUpperCase() === "SI" && capsProy.has(String(x.CAPITULO || ""))
      );

      return res.json({
        proyectos: proyectos.filter((p) => String(p.EMPRESA || "") === emp && String(p.CODIGO || "") === proy),
        capitulos: capitulos.filter((x) => String(x.PROYECTO || "") === proy),
        actividades: actsProy,
        niveles: niveles.filter((x) => String(x.PROYECTO || "") === proy && enTorre(x)),
        unidades: unidades.filter((x) => String(x.PROYECTO || "") === proy && enTorre(x)),
        contratistas: contratistas.filter((ct) => String(ct.ACTIVO || "").toUpperCase() === "SI"),
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
      if (rows.length) {
        await appendRows("REGISTRO", HEADERS.REGISTRO, rows);
        await snapshotDiaria(u.PROYECTO);
      }
      return res.json({ success: true, registrados: rows.length });
    }

    if (a === "historico") {
      const hist = await readRows("HISTORICO");
      const puntos = hist
        .filter((h) => String(h.PROYECTO || "") === String(u.PROYECTO || ""))
        .map((h) => ({ fecha: h.FECHA, ambito: h.AMBITO, avance: num(h.AVANCE) }));
      return res.json({ success: true, puntos });
    }

    res.status(400).json({ success: false, codigo: "ACCION_NO_VALIDA" });
  } catch (e) {
    console.error("[api/data]", e);
    res.status(500).json({ success: false, codigo: "ERROR_INTERNO" });
  }
}
