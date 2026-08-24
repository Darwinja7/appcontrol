import { readRows, appendRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS, VALORES, habilitado, UNIDAD_NIVEL, MODOS, aplicacionDe, zonaDe, normalizarConfigPorModo } from "./_lib/model.js";
import { currentUser, esDesarrollador } from "./_lib/session.js";
import * as XLSX from "xlsx";

// Tope de filas de REGISTRO enviadas al cliente en cada catálogo:
// el histórico crece sin límite y el payload no debería.
const MAX_REGISTRO = 2000;

const ESTADOS_VALIDOS = new Set(Object.keys(VALORES));

// Hojas del maestro y su clave unica por fila (para diff de importacion).
const MAESTRO = {
  EMPRESAS: { clave: (r) => r.CODIGO, soloDesarrollador: true },
  PROYECTOS: { clave: (r) => r.EMPRESA + "|" + r.CODIGO, soloDesarrollador: true },
  CAPITULOS: { clave: (r) => r.PROYECTO + "|" + r.CODIGO },
  ACTIVIDADES: { clave: (r) => r.CODIGO },
  NIVELES: { clave: (r) => r.PROYECTO + "|" + r.TORRE + "|" + r.NIVEL },
  UNIDADES: { clave: (r) => r.PROYECTO + "|" + r.TORRE + "|" + r.NIVEL + "|" + r.UNIDAD },
  CONTRATISTAS: { clave: (r) => r.CODIGO },
  CONFIGURACION: { clave: (r) => r.PROYECTO + "|" + r.TORRE + "|" + r.ACTIVIDAD + "|" + r.NIVEL + "|" + r.UNIDAD }
};

function normalizarHoja(nombre, filas) {
  const headers = HEADERS[nombre];
  return filas.map((f) => {
    const o = {};
    for (const h of headers) o[h] = String(f[h] ?? "").trim();
    return o;
  });
}

// Huella de una fila de configuracion para comparar antes/después de la
// normalizacion sin importar el orden de las claves del objeto.
const filaCfg = (r) => HEADERS.CONFIGURACION.map((h) => String(r[h] ?? ""));

function diffHoja(actuales, importadas, claveFn) {
  const mapAct = new Map(actuales.map((r) => [claveFn(r), r]));
  const mapImp = new Map(importadas.map((r) => [claveFn(r), r]));
  let nuevos = 0, modificados = 0, iguales = 0;
  const clavesDuplicadas = importadas.length - mapImp.size;
  for (const [k, r] of mapImp) {
    const a = mapAct.get(k);
    if (!a) nuevos++;
    else if (JSON.stringify(a) !== JSON.stringify(r)) modificados++;
    else iguales++;
  }
  const eliminados = [...mapAct.keys()].filter((k) => !mapImp.has(k)).length;
  return { nuevos, modificados, iguales, eliminados, clavesDuplicadas };
}

function leerLibro(base64) {
  const wb = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" });
  const hojas = {};
  for (const nombre of Object.keys(MAESTRO)) {
    if (!wb.SheetNames.includes(nombre)) continue;
    const json = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { defval: "" });
    hojas[nombre] = normalizarHoja(nombre, json);
  }
  return hojas;
}

const num = (v) => { const n = parseFloat(String(v ?? "0").replace(",", ".")); return isNaN(n) ? 0 : n; };

/**
 * Calcula el avance ponderado de un proyecto a partir de los datos crudos.
 * Misma matemática que el dashboard: actividad -> capitulo -> proyecto.
 * Devuelve { general, niveles:[{n,pct}], unidades:[{u,pct}] } en porcentaje 0-100.
 */
export function calcularAvance(cfgRows, actividades, capitulos, registroRows, proyecto, unidadesRows = []) {
  const capPond = new Map(capitulos.map((c) => [String(c.CODIGO), num(c.PONDERACION)]));
  const actInfo = new Map(actividades.map((a) => [String(a.CODIGO), a]));

  // Ultimo estado por actividad|nivel|unidad. El registro es normal: cada
  // fila guarda exactamente la clave que se marco (apartamento, zona fija o
  // el pseudo-valor "NIVEL" de las actividades especiales), asi que la lectura
  // es directa sin promediar.
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

  const unidadesPorNivel = new Map();
  for (const x of unidadesRows) {
    if (String(x.ACTIVO || "").toUpperCase() !== "SI") continue;
    const k = String(x.TORRE || "") + "|" + String(x.NIVEL || "");
    if (!unidadesPorNivel.has(k)) unidadesPorNivel.set(k, []);
    unidadesPorNivel.get(k).push(String(x.UNIDAD || ""));
  }
  const valFila = (r) => valOf(r.ACTIVIDAD, r.NIVEL, r.UNIDAD);
  const habilitadas = cfgRows.filter((r) => String(r.PROYECTO || "") === String(proyecto) && habilitado(r));

  // Avance general: cada actividad aporta SU PROMEDIO entre las filas donde
  // esta habilitada (mismas matematicas que el dashboard). Sin ese promedio,
  // habilitar una actividad en muchos niveles multiplicaria su peso.
  const filasPorAct = new Map();
  for (const r of habilitadas) {
    const k = String(r.ACTIVIDAD);
    if (!filasPorAct.has(k)) filasPorAct.set(k, []);
    filasPorAct.get(k).push(r);
  }

  let general = 0;
  const porNivel = {};
  const porUnidad = {};
  for (const [actId, filas] of filasPorAct) {
    const info = actInfo.get(actId);
    if (!info) continue;
    const pond = num(info.PONDERACION) * (capPond.get(String(info.CAPITULO)) ?? 0);
    const promedio = filas.reduce((s, r) => s + valFila(r), 0) / filas.length;
    general += promedio * pond;
  }
  // Detalle por nivel y por unidad: acumulan ponderacion fila a fila y se
  // normalizan solas al dividir (cada nivel/unidad compara sus propias filas).
  for (const r of habilitadas) {
    const info = actInfo.get(String(r.ACTIVIDAD));
    if (!info) continue;
    const pond = num(info.PONDERACION) * (capPond.get(String(info.CAPITULO)) ?? 0);
    const v = valFila(r) * pond;
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
      // Registro normal: una fila con la clave exacta que llego (apartamento,
      // zona fija o "NIVEL"). Se valida contra su fila de configuracion,
      // aceptando la fila especial del nivel como alternativa.
      const row = map.get([it.torre, it.actividad, it.nivel, UNIDAD_NIVEL].join("|")) ||
        map.get([it.torre, it.actividad, it.nivel, String(it.unidad ?? "")].join("|"));
      if (!row || !habilitado(row)) continue;
      rows.push([fecha, u.PROYECTO, it.torre, row.CAPITULO, it.actividad, String(it.nivel), String(it.unidad ?? ""),
        estado, valor, row.CONTRATISTA, u.SENDER_ID || u.EMAIL]);
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

    // Modo de aplicacion de las actividades: apartamento, nivel completo o
    // zona fija. Al cambiar el modo se normaliza CONFIGURACION (colapso de
    // filas por apartamento en una fila por nivel) conservando contratista.
    if (a === "actividades-save") {
      if (String(u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
      const cambios = Array.isArray((req.body || {}).cambios) ? req.body.cambios : [];
      if (!cambios.length) return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
      const acts = await readRows("ACTIVIDADES");
      let actualizadas = 0;
      for (const c of cambios) {
        const act = acts.find((x) => String(x.CODIGO) === String(c.codigo || ""));
        if (!act) continue;
        const modo = String(c.aplicacion || "").toUpperCase();
        if (!MODOS.includes(modo)) continue;
        const zonaNueva = String(c.zona || "").replace(/\|/g, " ").trim().toUpperCase() || "PUNTO FIJO";
        const sinCambio = aplicacionDe(act) === modo && (modo !== "ZONA" || zonaDe(act) === zonaNueva);
        if (sinCambio) continue;
        act.APLICACION = modo;
        act.ZONA = modo === "ZONA" ? zonaNueva : "";
        actualizadas++;
      }
      let filasConfig = null;
      if (actualizadas) {
        await replaceRows("ACTIVIDADES", HEADERS.ACTIVIDADES,
          acts.map((r) => HEADERS.ACTIVIDADES.map((h) => r[h] ?? "")), acts.length);
        const cfgActual = await readRows("CONFIGURACION");
        const normalizada = normalizarConfigPorModo(cfgActual, acts);
        if (JSON.stringify(normalizada.map(filaCfg)) !== JSON.stringify(cfgActual.map(filaCfg))) {
          await replaceRows("CONFIGURACION", HEADERS.CONFIGURACION,
            normalizada.map((r) => HEADERS.CONFIGURACION.map((h) => r[h] ?? "")), cfgActual.length);
          filasConfig = normalizada.length;
        }
      }
      return res.json({ success: true, actualizadas, filasConfig });
    }

    // ===== MAESTRO: exportar / previsualizar / importar =====
    if (a === "maestro-export") {
      if (String(u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
      const wb = XLSX.utils.book_new();
      for (const nombre of Object.keys(MAESTRO)) {
        const filas = await readRows(nombre);
        const data = [HEADERS[nombre], ...filas.map((r) => HEADERS[nombre].map((h) => r[h] ?? ""))];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), nombre);
      }
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="appcontrol-maestro.xlsx"');
      return res.status(200).send(buf);
    }

    if (a === "maestro-preview" || a === "maestro-import") {
      if (String(u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
      const esDev = esDesarrollador(u);
      let hojas;
      try { hojas = leerLibro(String((req.body || {}).dataBase64 || "")); }
      catch { return res.status(400).json({ success: false, codigo: "ARCHIVO_INVALIDO" }); }
      if (!Object.keys(hojas).length) return res.status(400).json({ success: false, codigo: "SIN_HOJAS_RECONOCIDAS" });

      const resumen = {};
      for (const [nombre, meta] of Object.entries(MAESTRO)) {
        if (!hojas[nombre]) continue;
        if (meta.soloDesarrollador && !esDev) { resumen[nombre] = { omitida: true }; continue; }
        resumen[nombre] = diffHoja(await readRows(nombre), hojas[nombre], meta.clave);
      }

      if (a === "maestro-preview") return res.json({ success: true, resumen });

      let tocadas = 0;
      for (const [nombre, meta] of Object.entries(MAESTRO)) {
        if (!hojas[nombre] || (meta.soloDesarrollador && !esDev)) continue;
        const actuales = await readRows(nombre);
        const d = resumen[nombre];
        if (!d.nuevos && !d.modificados && !d.eliminados) continue;
        const previas = actuales.length;
        await replaceRows(nombre, HEADERS[nombre], hojas[nombre].map((r) => HEADERS[nombre].map((h) => r[h] ?? "")), previas);
        tocadas++;
      }
      return res.json({ success: true, hojasActualizadas: tocadas, resumen });
    }

    res.status(400).json({ success: false, codigo: "ACCION_NO_VALIDA" });
  } catch (e) {
    console.error("[api/data]", e);
    res.status(500).json({ success: false, codigo: "ERROR_INTERNO" });
  }
}
