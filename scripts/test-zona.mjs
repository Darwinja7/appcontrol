// Tests del modelo de zonas: modos de aplicacion (UNIDAD/NIVEL/ZONA),
// normalizacion de configuracion y avance ponderado con registros normales.
//   node scripts/test-zona.mjs
import { HEADERS, MODOS, aplicacionDe, zonaDe, normalizarConfigPorModo } from "../api/_lib/model.js";
import { calcularAvance } from "../api/data.js";

let fallos = 0;
const assert = (cond, msg) => { if (!cond) { console.log("FALLO:", msg); fallos++; } };
const cerca = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

// ---------- Modos ----------
assert(MODOS.join(",") === "UNIDAD,NIVEL,ZONA", "modos vigentes");
assert(aplicacionDe({ APLICACION: "NIVEL" }) === "NIVEL", "modo NIVEL");
assert(aplicacionDe({ APLICACION: "zona" }) === "ZONA", "modo ZONA en minusculas");
assert(aplicacionDe({}) === "UNIDAD", "vacio = UNIDAD");
assert(aplicacionDe({ APLICACION: "OTRO" }) === "UNIDAD", "modo invalido cae a UNIDAD");
assert(zonaDe({ ZONA: "escalera" }) === "ESCALERA", "zona normalizada a mayusculas");
assert(zonaDe({ ZONA: " A|B " }) === "A B", "la zona nunca contiene |");
assert(zonaDe({}) === "PUNTO FIJO", "zona por defecto = PUNTO FIJO");
assert(HEADERS.ACTIVIDADES.includes("ZONA"), "el maestro tiene columna ZONA");

// ---------- Normalizacion de CONFIGURACION ----------
const actividades = [
  { CODIGO: "ACT01", NOMBRE: "Normal", CAPITULO: "CAP1", APLICACION: "UNIDAD", ZONA: "" },
  { CODIGO: "ACT02", NOMBRE: "Ascensor", CAPITULO: "CAP1", APLICACION: "ZONA", ZONA: "PUNTO FIJO" },
  { CODIGO: "ACT03", NOMBRE: "Losa", CAPITULO: "CAP2", APLICACION: "NIVEL", ZONA: "" }
];
const filaCfg = (act, niv, uni, extra = {}) => ({
  PROYECTO: "P", TORRE: "T", ACTIVIDAD: act, CAPITULO: "", NIVEL: String(niv), UNIDAD: uni,
  APLICA: "SI", ACTIVO: "SI", CONTRATISTA: "CT1", HABILITADO: "SI",
  FECHA_ACTIVACION: "2026-08-01", FECHA_DESACTIVACION: "", OBSERVACION: "", ...extra
});
const cfgBase = [
  filaCfg("ACT01", 2, "201"),
  filaCfg("ACT01", 2, "202"),
  // Zona vieja mezclada: un apartamento con contratista y otro sin
  filaCfg("ACT02", 2, "201"),
  filaCfg("ACT02", 2, "202", { CONTRATISTA: "Sin asignar" }),
  filaCfg("ACT02", 3, "201"),
  // Actividad especial con filas expandidas heredadas del modelo antiguo
  filaCfg("ACT03", 2, "201"),
  filaCfg("ACT03", 2, "202"),
  filaCfg("ACT03", 3, "201")
];
const out = normalizarConfigPorModo(cfgBase, actividades);
assert(out.length === 2 + 2 + 2, `colapso a una fila por nivel (${out.length} filas)`);
const zonaRows = out.filter((r) => r.ACTIVIDAD === "ACT02").sort((a, b) => +a.NIVEL - +b.NIVEL);
assert(zonaRows.length === 2 && zonaRows.every((r) => r.UNIDAD === "PUNTO FIJO"), "zona colapsada a PUNTO FIJO por nivel");
assert(zonaRows.every((r) => r.CONTRATISTA === "CT1"), "contratista conservado aunque otra fila estuviera sin asignar");
const nivelRows = out.filter((r) => r.ACTIVIDAD === "ACT03");
assert(nivelRows.length === 2 && nivelRows.every((r) => r.UNIDAD === "NIVEL"), "especial colapsada a NIVEL por nivel");
assert(out.filter((r) => r.ACTIVIDAD === "ACT01").length === 2, "las filas por apartamento quedan intactas");
assert(zonaRows.every((r) => r.HABILITADO === "SI"), "HABILITADO recalculado");
assert(normalizarConfigPorModo(out, actividades).length === out.length, "normalizar es estable en cantidad");

// Renombrar la zona regenera las filas bajo el nuevo nombre
const actsRenombrada = structuredClone(actividades);
actsRenombrada[1].ZONA = "ASCENSOR";
assert(normalizarConfigPorModo(cfgBase, actsRenombrada)
  .filter((r) => r.ACTIVIDAD === "ACT02").every((r) => r.UNIDAD === "ASCENSOR"), "cambio de nombre de zona se propaga");

// Actividad desconocida se conserva tal cual (no revienta)
assert(normalizarConfigPorModo([filaCfg("NOPE", 1, "X")], actividades).length === 1, "actividad fuera del maestro se conserva");

// ---------- Avance ponderado con registro normal ----------
// CAP1 (pond 0.5): ACT01 apartamentos (pond 0.6) + ACT02 zona fija (pond 0.4)
// CAP2 (pond 0.5): ACT03 especial por nivel (pond 1.0)
const caps = [{ CODIGO: "CAP1", PONDERACION: "0.5" }, { CODIGO: "CAP2", PONDERACION: "0.5" }];
const actsAv = [
  { CODIGO: "ACT01", CAPITULO: "CAP1", PONDERACION: "0.6", APLICACION: "UNIDAD" },
  { CODIGO: "ACT02", CAPITULO: "CAP1", PONDERACION: "0.4", APLICACION: "ZONA", ZONA: "PUNTO FIJO" },
  { CODIGO: "ACT03", CAPITULO: "CAP2", PONDERACION: "1", APLICACION: "NIVEL" }
];
const unidadesAv = [
  { TORRE: "T", NIVEL: "2", UNIDAD: "201", ACTIVO: "SI" },
  { TORRE: "T", NIVEL: "2", UNIDAD: "202", ACTIVO: "SI" },
  { TORRE: "T", NIVEL: "3", UNIDAD: "301", ACTIVO: "SI" }
];
const cfgAv = [
  filaCfg("ACT01", 2, "201"), filaCfg("ACT01", 2, "202"),
  filaCfg("ACT02", 2, "PUNTO FIJO"),
  filaCfg("ACT03", 3, "NIVEL")
];
const registroAv = [
  { FECHA: "2026-08-20T10:00Z", PROYECTO: "P", ACTIVIDAD: "ACT01", NIVEL: "2", UNIDAD: "201", ESTADO: "Listo", VALOR: "1" },
  { FECHA: "2026-08-21T10:00Z", PROYECTO: "P", ACTIVIDAD: "ACT01", NIVEL: "2", UNIDAD: "202", ESTADO: "En curso", VALOR: "0.5" },
  { FECHA: "2026-08-22T10:00Z", PROYECTO: "P", ACTIVIDAD: "ACT02", NIVEL: "2", UNIDAD: "PUNTO FIJO", ESTADO: "Listo", VALOR: "1" },
  { FECHA: "2026-08-23T10:00Z", PROYECTO: "P", ACTIVIDAD: "ACT03", NIVEL: "3", UNIDAD: "NIVEL", ESTADO: "Manual", VALOR: "0.65" }
];
const av = calcularAvance(cfgAv, actsAv, caps, registroAv, "P", unidadesAv);
// Esperado (cada fila de configuracion pesa su actividad x capitulo):
//   ACT01: (1*.3) + (.5*.3) = .45 ; ACT02: 1*.2 = .2 ; ACT03: .65*.5 = .325
assert(cerca(av.general, 97.5), `avance general 97.5% (dio ${av.general.toFixed(2)}%)`);
const n2 = av.niveles.find((x) => x.n === "2"), n3 = av.niveles.find((x) => x.n === "3");
assert(n2 && cerca(n2.pct, (.45 + .2) / .8 * 100), `nivel 2 ponderado (dio ${n2 ? n2.pct.toFixed(1) : "?"}%)`);
assert(n3 && cerca(n3.pct, 65), `nivel 3 lee su fila NIVEL directa (dio ${n3 ? n3.pct.toFixed(1) : "?"}%)`);
const pf = av.unidades.find((u) => u.u === "PUNTO FIJO");
assert(pf && cerca(pf.pct, 100), "la zona punto fijo aparece como unidad propia al 100%");
const u201 = av.unidades.find((u) => u.u === "201");
assert(u201 && cerca(u201.pct, 100), "apartamento 201 al 100%");
const u301 = av.unidades.find((u) => u.u === "301");
assert(u301 && cerca(u301.pct, 65), "el nivel especial reparte su avance a cada unidad para la vista por unidad");

console.log(fallos ? `TESTS ZONA FALLARON (${fallos})` : "TESTS ZONA OK — modos, normalizacion y avance ponderado correctos");
process.exit(fallos ? 1 : 0);
