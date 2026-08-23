// Backfill de historico para el proyecto DEMO (P000).
// Genera snapshots semanales pasados interpolando hacia el avance actual,
// para que la grafica del dashboard tenga curva desde el primer dia.
// El proyecto de produccion (P001) NO se toca: su historico crece solo.
//
//   $env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content ... -Raw)
//   $env:SPREADSHEET_ID = "<id>"
//   node scripts/backfill-historico.mjs
import { readRows, appendRows } from "../api/_lib/sheets.js";
import { HEADERS } from "../api/_lib/model.js";
import { calcularAvance } from "../api/data.js";

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID) {
  console.error("Faltan GOOGLE_SERVICE_ACCOUNT_JSON o SPREADSHEET_ID.");
  process.exit(1);
}

const PROYECTO = "P000"; // solo DEMO
const [cfg, acts, caps, registro] = await Promise.all([
  readRows("CONFIGURACION"), readRows("ACTIVIDADES"), readRows("CAPITULOS"), readRows("REGISTRO")
]);
const av = calcularAvance(cfg, acts, caps, registro, PROYECTO);
console.log("Avance actual del demo:", av.general.toFixed(1) + "%", "| niveles:", av.niveles.map((n) => n.n + ":" + n.pct.toFixed(0) + "%").join(" "));

const hist = await readRows("HISTORICO");
if (hist.some((h) => h.PROYECTO === PROYECTO)) {
  console.log("El historico del demo ya tiene puntos; no se duplica nada.");
  process.exit(0);
}

// Semanas pasadas -> fraccion del avance actual
const pasos = [
  { dias: 28, f: 0.15 },
  { dias: 21, f: 0.40 },
  { dias: 14, f: 0.65 },
  { dias: 7, f: 0.85 }
];
const filas = [];
for (const p of pasos) {
  const fecha = new Date(Date.now() - p.dias * 864e5).toISOString();
  filas.push([fecha, PROYECTO, "GENERAL", (av.general * p.f).toFixed(1)]);
  for (const n of av.niveles) filas.push([fecha, PROYECTO, "NIVEL:" + n.n, (n.pct * p.f).toFixed(1)]);
  for (const un of av.unidades) filas.push([fecha, PROYECTO, "UNIDAD:" + un.u, (un.pct * p.f).toFixed(1)]);
}
// Hoy: valores reales
const fechaHoy = new Date().toISOString();
filas.push([fechaHoy, PROYECTO, "GENERAL", av.general.toFixed(1)]);
for (const n of av.niveles) filas.push([fechaHoy, PROYECTO, "NIVEL:" + n.n, n.pct.toFixed(1)]);
for (const un of av.unidades) filas.push([fechaHoy, PROYECTO, "UNIDAD:" + un.u, un.pct.toFixed(1)]);

await appendRows("HISTORICO", HEADERS.HISTORICO, filas);
console.log("Backfill escrito:", filas.length, "filas en HISTORICO (proyecto demo P000).");
