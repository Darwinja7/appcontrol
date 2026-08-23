// Enriquece el proyecto DEMO (P000) con la torre T2 completa para poder probar
// las relaciones de configuracion y el registro movil:
//   - piso 1: LOBBY y ZONA ADMINISTRATIVA
//   - pisos 2-3: parqueaderos (6 por piso, tipo PARQUEADERO)
//   - pisos 4-21: apartamentos 6 por piso (401..2106)
//   - piso 22: GYM, SAUNA, TURCO (amenidades)
//   - piso 23: AMENIDADES, TERRAZA
// Idempotente: solo agrega filas que no existan. No toca CONFIGURACION,
// REGISTRO ni ningun otro proyecto.
//
//   $env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content ruta\service-account.json -Raw)
//   $env:SPREADSHEET_ID = "<id>"
//   node scripts/enriquecer-demo.mjs
import { readRows, appendRows } from "../api/_lib/sheets.js";
import { HEADERS } from "../api/_lib/model.js";

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID) {
  console.error("Faltan GOOGLE_SERVICE_ACCOUNT_JSON o SPREADSHEET_ID.");
  process.exit(1);
}

const DEMO = "P000";
const TORRE = "T2";

const nivelesPlaneados = [];
for (let p = 1; p <= 23; p++) nivelesPlaneados.push([DEMO, TORRE, String(p), "NO"]);

const unidadesPlaneadas = [];
unidadesPlaneadas.push([DEMO, TORRE, "1", "LOBBY", "LOBBY", "SI"]);
unidadesPlaneadas.push([DEMO, TORRE, "1", "ZONA ADM", "ZONA ADMINISTRATIVA", "SI"]);
for (const piso of [2, 3]) {
  for (let i = 1; i <= 6; i++) unidadesPlaneadas.push([DEMO, TORRE, String(piso), `${piso}0${i}`, "PARQUEADERO", "SI"]);
}
for (let piso = 4; piso <= 21; piso++) {
  for (let i = 1; i <= 6; i++) unidadesPlaneadas.push([DEMO, TORRE, String(piso), `${piso}0${i}`, "APARTAMENTO", "SI"]);
}
unidadesPlaneadas.push([DEMO, TORRE, "22", "GYM", "GYM", "SI"]);
unidadesPlaneadas.push([DEMO, TORRE, "22", "SAUNA", "SAUNA", "SI"]);
unidadesPlaneadas.push([DEMO, TORRE, "22", "TURCO", "TURCO", "SI"]);
unidadesPlaneadas.push([DEMO, TORRE, "23", "AMENIDADES", "AMENIDADES", "SI"]);
unidadesPlaneadas.push([DEMO, TORRE, "23", "TERRAZA", "TERRAZA", "SI"]);

const claveNivel = (r) => [r.PROYECTO, r.TORRE, r.NIVEL].join("|");
const claveUnidad = (r) => [r.PROYECTO, r.TORRE, r.NIVEL, r.UNIDAD].join("|");

const nivelesActuales = new Set((await readRows("NIVELES")).map(claveNivel));
const faltantesNiveles = nivelesPlaneados.filter((f) => !nivelesActuales.has(claveNivel({ PROYECTO: f[0], TORRE: f[1], NIVEL: f[2] })));

const unidadesActuales = new Set((await readRows("UNIDADES")).map(claveUnidad));
const faltantesUnidades = unidadesPlaneadas.filter((f) => !unidadesActuales.has(claveUnidad({ PROYECTO: f[0], TORRE: f[1], NIVEL: f[2], UNIDAD: f[3] })));

if (faltantesNiveles.length) await appendRows("NIVELES", HEADERS.NIVELES, faltantesNiveles);
if (faltantesUnidades.length) await appendRows("UNIDADES", HEADERS.UNIDADES, faltantesUnidades);

console.log(JSON.stringify({
  success: true,
  nivelesAgregados: faltantesNiveles.length,
  unidadesAgregadas: faltantesUnidades.length,
  totalNivelesProyecto: (await readRows("NIVELES")).filter((n) => n.PROYECTO === DEMO).length,
  totalUnidadesProyecto: (await readRows("UNIDADES")).filter((u) => u.PROYECTO === DEMO).length
}, null, 2));
