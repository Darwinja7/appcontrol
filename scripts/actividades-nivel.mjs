// Agrega soporte demo de actividades por nivel:
//  - Columna APLICACION en ACTIVIDADES ("UNIDAD" por defecto, "NIVEL" para
//    actividades que se ejecutan por piso completo).
//  - Nueva ACT004 "Movimiento de tierras" (CAP01) y reajuste de ponderaciones
//    del capitulo para mantener la suma en 1.0.
//  - CONFIGURACION de ejemplo de ACT004 en T2 niveles 1-3 con contratista.
// Idempotente: puede ejecutarse varias veces.
//
//   $env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content ruta\service-account.json -Raw)
//   $env:SPREADSHEET_ID = "<id>"
//   node scripts/actividades-nivel.mjs
import { readRows, replaceRows, appendRows } from "../api/_lib/sheets.js";
import { HEADERS } from "../api/_lib/model.js";

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID) {
  console.error("Faltan GOOGLE_SERVICE_ACCOUNT_JSON o SPREADSHEET_ID.");
  process.exit(1);
}

const DEMO = "P000";
const TORRE = "T2";

const act = await readRows("ACTIVIDADES");
const yaExisteAct004 = act.some((a) => a.CODIGO === "ACT004");
const faltaColumna = act.some((a) => String(a.APLICACION || "").trim() === "");

const pesosCap01 = yaExisteAct004
  ? null
  : { ACT001: "0.3", ACT002: "0.25", ACT003: "0.25" };

let salidaActividades = "sin cambios";
if (faltaColumna || !yaExisteAct004) {
  const filas = act.map((r) => ({
    ...r,
    APLICACION: String(r.APLICACION || "").trim() || "UNIDAD",
    PONDERACION: pesosCap01 && pesosCap01[r.CODIGO] ? pesosCap01[r.CODIGO] : r.PONDERACION
  }));
  if (!yaExisteAct004) {
    filas.push({ CODIGO: "ACT004", NOMBRE: "Movimiento de tierras", CAPITULO: "CAP01", PONDERACION: "0.2", ACTIVO: "SI", APLICACION: "NIVEL" });
  }
  await replaceRows("ACTIVIDADES", HEADERS.ACTIVIDADES, filas.map((r) => HEADERS.ACTIVIDADES.map((h) => r[h] ?? "")), filas.length);
  salidaActividades = `actualizadas (${filas.length})`;
}

const cfg = await readRows("CONFIGURACION");
const existeCfg = (nivel) => cfg.some((r) => r.PROYECTO === DEMO && r.TORRE === TORRE && r.ACTIVIDAD === "ACT004" && r.NIVEL === String(nivel) && r.UNIDAD === "NIVEL");
const nuevas = [];
for (const nivel of [1, 2, 3]) {
  if (!existeCfg(nivel)) {
    nuevas.push([DEMO, TORRE, "ACT004", "CAP01", String(nivel), "NIVEL", "SI", "SI", "CT01", "SI", "2026-08-23", "", "Demo actividad por nivel"]);
  }
}
if (nuevas.length) await appendRows("CONFIGURACION", HEADERS.CONFIGURACION, nuevas);

console.log(JSON.stringify({
  success: true,
  actividades: salidaActividades,
  configuracionAgregada: nuevas.length,
  nota: "ACT004 es por NIVEL; config demo en T2 niveles 1-3 habilitada con CT01"
}, null, 2));
