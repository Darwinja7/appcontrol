import { readRows, appendRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS, VALORES, habilitado, UNIDAD_NIVEL } from "./_lib/model.js";
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
export function calcularAvance(cfgRows, actividades, capitulos, registroRows, proyecto, unidadesRows = []) {
  const capPond = new Map(capitulos.map((c) => [String(c.CODIGO), num(c.PONDERACION)]));
  const actInfo = new Map(actividades.map((a) => [String(a.CODIGO), a]));

  // Ultimo estado por actividad|nivel|unidad
  const last = new Map();
  for (const r of registroRows) {
    if (proyecto && String(r.PROYECTO || "") !== String(proyecto)) continue;
    const k = r.ACTIVIDAD + "|" + r.NIVEL + "|" + r.UNIDAD;
    if (!last.has(k) || String(r.FECHA) > String(last.get(k).FECHA)) last.set(k, r);
  }
  const valDe = (l) => {
    if (!l) return 0;
    if (String(l.ESTADO) === "Manual") return num(l.VALOR);
    return VALORES[l.ESTADO] ?? 0;
  };
  const valOf = (a, n, u) => valDe(last.get(a + "|" + n + "|" + u));

  // Unidades activas por torre|nivel: para filas de configuracion por NIVEL el
  // valor es el promedio del nivel (todas sus unidades comparten avance).
  const unidadesPorNivel = new Map();
  for (const x of unidadesRows) {
    if (String(x.ACTIVO || "").toUpperCase() !== "SI") continue;
    const k = String(x.TORRE || "") + "|" + String(x.NIVEL || "");
    if (!unidadesPorNivel.has(k)) unidadesPorNivel.set(k, []);
    unidadesPorNivel.get(k).push(String(x.UNIDAD || ""));
  }
  const valFila = (r) => {
    if (String(r.UNIDAD) === UNIDAD_NIVEL) {
      const us = unidadesPorNivel.get(String(r.TORRE || "") + "|" + String(r.NIVEL || "")) || [];
      if (us.length) return us.reduce((s, un) => s + valOf(r.ACTIVIDAD, r.NIVEL, un), 0) / us.length;
      return valOf(r.ACTIVIDAD, r.NIVEL, UNIDAD_NIVEL);
    }
    return valOf(r.ACTIVIDAD, r.NIVEL, r.UNIDAD);
  };
  const habilitadas = cfgRows.filter((r) => String(r.PROYECTO || "") === String(proyecto) && habilitado(r));

  let general = 0;
  const porNivel = {};
  const porUnidad = {};
  for (const r of habilitadas) {
    const info = actInfo.get(String(r.ACTIVIDAD));
    if (!info) continue;
    const pond = num(info.PONDERACION) * (capPond.get(String(info.CAPITULO)) ?? 0);
    const v = valFila(r) * pond;
    general += v;
    const nk = String(r.NIVEL);
    (porNivel[nk] ||= { suma: 0, pond: 0 });
    porNivel[nk].suma += v;
    porNivel[nk].pond += pond;
    if (String(r.UNIDAD) === UNIDAD_NIVEL) {
      // La actividad de nivel aporta a cada unidad del nivel (mismo avance).
      for (const un of unidadesPorNivel.get(String(r.TORRE || "") + "|" + nk) || []) {
        (porUnidad[un] ||= { suma: 0, pond: 0 });
        porUnidad[un].suma += v;
        porUnidad[un].pond += pond;
      }
    } else {
      (porUnidad[String(r.UNIDAD)] ||= { suma: 0, pond: 0 });
      porUnidad[String(r.UNIDAD)].suma += v;
      porUnidad[String(r.UNIDAD)].pond += pond;
    }
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
    const [hist, cfg, acts, caps, registro, unidades] = await Promise.all([
      readRows("HISTORICO"), readRows("CONFIGURACION"), readRows("ACTIVIDADES"),
      readRows("CAPITULOS"), readRows("REGISTRO"), readRows("UNIDADES")
    ]);
    const hoy = new Date().toISOString().slice(0, 10);
    if (hist.some((h) => String(h.PROYECTO || "") === String(proyecto) && String(h.FECHA || "").slice(0, 10) === hoy)) return;
    const av = calcularAvance(cfg, acts, caps, registro, proyecto, unidades);
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
    let unidadesCache = null;
    for (const it of items) {
      // El proyecto SIEMPRE viene del token, nunca del cliente.
      // Dos modos: estado del catalogo o porcentaje manual 0-100.
      let estado, valor;
      if (it.pct !== undefined && it.pct !== null && String(it.pct).trim() !== "") {
        const p = num(it.pct);
        if (p < 0 || p > 100) continue;
        estado = "Manual";
        valor = String(Math.round(p) / 100);
      } else {
        if (!ESTADOS_VALIDOS.has(it.estado)) continue;
        estado = it.estado;
        valor = String(VALORES[it.estado] ?? 0);
      }
      // Actividad por NIVEL: se valida contra su fila de configuracion
      // ("NIVEL") pero se registra una fila por unidad activa del nivel —
      // todas heredan el mismo avance. Sin unidades aun, cae como fila NIVEL.
      let destinos = [it.unidad];
      if (String(it.unidad) === UNIDAD_NIVEL) {
        if (!unidadesCache) unidadesCache = await readRows("UNIDADES");
        const delNivel = unidadesCache.filter((x) =>
          String(x.PROYECTO || "") === u.PROYECTO && x.TORRE === it.torre &&
          String(x.NIVEL || "") === String(it.nivel) && String(x.ACTIVO || "").toUpperCase() === "SI"
        ).map((x) => x.UNIDAD);
        if (delNivel.length) destinos = delNivel;
      }
      for (const destino of destinos) {
        const row = map.get([it.torre, it.actividad, it.nivel, UNIDAD_NIVEL].join("|")) ||
          map.get([it.torre, it.actividad, it.nivel, it.unidad].join("|"));
        if (!row || !habilitado(row)) continue;
        rows.push([fecha, u.PROYECTO, it.torre, row.CAPITULO, it.actividad, String(it.nivel), destino,
          estado, valor, row.CONTRATISTA, u.SENDER_ID || u.EMAIL]);
      }
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
