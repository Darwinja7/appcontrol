// Reinicio completo de los datos del proyecto DEMO (P000/T2):
//  1. Borra TODAS las filas de REGISTRO y HISTORICO (eran ejemplos).
//  2. Marca los modos de aplicacion: Losa/Mov. tierras -> NIVEL,
//     Escaleras -> ZONA "PUNTO FIJO"; crea Ascensor, Barandas metalicas y
//     Puertas cortafuego como actividades de zona, rebalanceando las
//     ponderaciones para que cada capitulo sume 1.0.
//  3. Reconstruye CONFIGURACION del demo sin filas mixtas viejas.
//  4. Genera registros nuevos coherentes (fechas repartidas en 14 dias).
//  5. Rellena HISTORICO con snapshots interpolados para la grafica.
//
// Idempotente: correrlo dos veces deja el mismo estado final.
//
//   $env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content ... -Raw)
//   $env:SPREADSHEET_ID = "<id>"
//   node scripts/reiniciar-demo.mjs
import { readRows, replaceRows, appendRows } from "../api/_lib/sheets.js";
import { HEADERS, habilitado, aplicacionDe, zonaDe } from "../api/_lib/model.js";
import { calcularAvance } from "../api/data.js";

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID) {
  console.error("Faltan GOOGLE_SERVICE_ACCOUNT_JSON o SPREADSHEET_ID.");
  process.exit(1);
}

const PROY = "P000", TORRE = "T2", ZONA_PF = "PUNTO FIJO";
const VALORES = { "Sin empezar": 0, "En replanteo": 0.1, "En curso": 0.5, "En remate": 0.8, "Listo": 1 };
const diasAtras = (d) => new Date(Date.now() - d * 864e5).toISOString();
const num = (v) => { const n = parseFloat(String(v ?? "0").replace(",", ".")); return isNaN(n) ? 0 : n; };

console.log("== 1. Borrando REGISTRO e HISTORICO (datos de ejemplo) ==");
for (const hoja of ["REGISTRO", "HISTORICO"]) {
  const previas = (await readRows(hoja)).length;
  await replaceRows(hoja, HEADERS[hoja], [], previas);
  console.log(`   ${hoja}: ${previas} filas eliminadas.`);
}

console.log("== 2. Modos de aplicacion y actividades de zona ==");
const acts = await readRows("ACTIVIDADES");
const upsert = (codigo, nombre, capitulo, pond, modo, zona) => {
  let a = acts.find((x) => x.CODIGO === codigo);
  if (!a) { a = { CODIGO: codigo, NOMBRE: "", CAPITULO: "", PONDERACION: "", ACTIVO: "SI", APLICACION: "", ZONA: "" }; acts.push(a); }
  Object.assign(a, { NOMBRE: nombre, CAPITULO: capitulo, APLICACION: modo, ZONA: modo === "ZONA" ? zona : "" });
  if (pond !== null) a.PONDERACION = String(pond);
};
upsert("ACT001", "Vaciado de losa", "CAP01", null, "NIVEL", "");
upsert("ACT004", "Movimiento de tierras", "CAP01", null, "NIVEL", "");
upsert("ACT003", "Escaleras", "CAP01", null, "ZONA", ZONA_PF);
upsert("ACT005", "Ascensor", "CAP01", null, "ZONA", ZONA_PF);
upsert("ACT006", "Barandas metalicas", "CAP03", null, "ZONA", ZONA_PF);
upsert("ACT007", "Puertas cortafuego", "CAP04", null, "ZONA", ZONA_PF);

// Rebalanceo: la actividad nueva entra con su peso y las demas se escalan
// para que el capitulo siga sumando 1.0 (con correccion de redondeo).
const balancear = (capitulo, codigoNuevo, pondNueva) => {
  const resto = acts.filter((a) => a.CAPITULO === capitulo && a.CODIGO !== codigoNuevo);
  const suma = resto.reduce((s, a) => s + num(a.PONDERACION), 0) || 1;
  for (const a of resto) a.PONDERACION = (num(a.PONDERACION) * (1 - pondNueva) / suma).toFixed(3);
  const nuevo = acts.find((a) => a.CODIGO === codigoNuevo);
  nuevo.PONDERACION = String(pondNueva);
  const deriva = 1 - resto.reduce((s, a) => s + num(a.PONDERACION), 0) - pondNueva;
  if (Math.abs(deriva) > 0) resto[resto.length - 1].PONDERACION = (num(resto[resto.length - 1].PONDERACION) + deriva).toFixed(3);
};
balancear("CAP01", "ACT005", 0.2);   // ascensor pesa 20% de estructura
balancear("CAP03", "ACT006", 0.1);   // barandas 10% de acabados
balancear("CAP04", "ACT007", 0.1);   // cortafuego 10% de carpinteria

await replaceRows("ACTIVIDADES", HEADERS.ACTIVIDADES,
  acts.map((r) => HEADERS.ACTIVIDADES.map((h) => r[h] ?? "")), acts.length);
for (const cap of ["CAP01", "CAP02", "CAP03", "CAP04", "CAP05", "CAP06"]) {
  const s = acts.filter((a) => a.CAPITULO === cap).reduce((x, a) => x + num(a.PONDERACION), 0);
  console.log(`   ${cap}: suma=${s.toFixed(3)} ${Math.abs(s - 1) < 0.001 ? "OK" : "¡AJUSTAR!"}`);
}

console.log("== 3. Reconstruyendo CONFIGURACION del demo ==");
const unidades = (await readRows("UNIDADES")).filter((u) => u.PROYECTO === PROY && u.TORRE === TORRE && u.ACTIVO === "SI");
const nivelesConAptos = [...new Set(unidades.filter((u) => u.TIPO === "APARTAMENTO").map((u) => String(u.NIVEL)))].sort((a, b) => +a - +b);
const zonasComunes = unidades.filter((u) => !["APARTAMENTO", "PARQUEADERO"].includes(u.TIPO));
const rango = (desde, hasta) => nivelesConAptos.map(String).filter((n) => +n >= desde && +n <= hasta);
const hoyIso = new Date().toISOString().slice(0, 10);

const infoAct = new Map(acts.map((a) => [a.CODIGO, a]));
const cfgNuevas = [];
const filaCfg = (act, nivel, unidad, ct) => {
  const info = infoAct.get(act);
  const row = { PROYECTO: PROY, TORRE: TORRE, ACTIVIDAD: act, CAPITULO: info ? info.CAPITULO : "",
    NIVEL: String(nivel), UNIDAD: unidad, APLICA: "SI", ACTIVO: "SI", CONTRATISTA: ct,
    HABILITADO: "NO", FECHA_ACTIVACION: hoyIso, FECHA_DESACTIVACION: "", OBSERVACION: "" };
  row.HABILITADO = habilitado(row) ? "SI" : "NO";
  return row;
};

// Especiales por nivel completo
for (const n of [1, 2, 3, 4]) cfgNuevas.push(filaCfg("ACT004", n, "NIVEL", "CT01"));
for (const n of [5, 6, 7, 8, 9, 10]) cfgNuevas.push(filaCfg("ACT001", n, "NIVEL", "CT01"));
// Zona punto fijo presente en todos los niveles
for (const n of [...new Set(unidades.map((u) => String(u.NIVEL)))].sort((a, b) => +a - +b)) {
  cfgNuevas.push(filaCfg("ACT003", n, ZONA_PF, "CT01"));
  cfgNuevas.push(filaCfg("ACT005", n, ZONA_PF, "CT02"));
  if (+n >= 6) cfgNuevas.push(filaCfg("ACT006", n, ZONA_PF, "CT03"));
  if (+n >= 8) cfgNuevas.push(filaCfg("ACT007", n, ZONA_PF, "CT02"));
}
// Por apartamento
for (const n of rango(4, 9)) for (const u of unidades.filter((x) => x.TIPO === "APARTAMENTO" && String(x.NIVEL) === n)) {
  cfgNuevas.push(filaCfg("ACT010", n, u.UNIDAD, "CT02"));
  cfgNuevas.push(filaCfg("ACT011", n, u.UNIDAD, "CT02"));
}
for (const n of rango(4, 7)) for (const u of unidades.filter((x) => x.TIPO === "APARTAMENTO" && String(x.NIVEL) === n)) {
  cfgNuevas.push(filaCfg("ACT020", n, u.UNIDAD, "CT03"));
}
for (const n of rango(4, 5)) for (const u of unidades.filter((x) => x.TIPO === "APARTAMENTO" && String(x.NIVEL) === n)) {
  cfgNuevas.push(filaCfg("ACT041", n, u.UNIDAD, "CT03"));
}
// Aseo de zonas comunes (lobby, gym, amenidades...)
for (const u of zonasComunes) cfgNuevas.push(filaCfg("ACT090", u.NIVEL, u.UNIDAD, "CT03"));

const cfgTodas = await readRows("CONFIGURACION");
const otras = cfgTodas.filter((r) => !(r.PROYECTO === PROY && r.TORRE === TORRE));
await replaceRows("CONFIGURACION", HEADERS.CONFIGURACION,
  [...otras, ...cfgNuevas].map((r) => HEADERS.CONFIGURACION.map((h) => r[h] ?? "")), cfgTodas.length);
console.log(`   CONFIGURACION: ${cfgTodas.length} -> ${otras.length + cfgNuevas.length} filas (${cfgNuevas.length} nuevas del demo).`);

console.log("== 4. Registros nuevos ==");
const ctDe = new Map(cfgNuevas.map((r) => [r.ACTIVIDAD + "|" + r.NIVEL + "|" + r.UNIDAD, r.CONTRATISTA]));
const registros = [];
const reg = (dias, act, nivel, unidad, estado) => {
  registros.push([diasAtras(dias), PROY, TORRE, infoAct.get(act)?.CAPITULO || "", act, String(nivel), String(unidad),
    estado, String(VALORES[estado]), ctDe.get(act + "|" + nivel + "|" + unidad) || "Sin asignar", "demo@appcontrol"]);
};
// Estructura: movimiento de tierras y losa avanzados
reg(14, "ACT004", 1, "NIVEL", "Listo"); reg(13, "ACT004", 2, "NIVEL", "Listo");
reg(10, "ACT004", 3, "NIVEL", "Listo"); reg(6, "ACT004", 4, "NIVEL", "En curso");
reg(9, "ACT001", 5, "NIVEL", "Listo"); reg(8, "ACT001", 6, "NIVEL", "Listo"); reg(4, "ACT001", 7, "NIVEL", "En curso");
// Punto fijo: escalera muy adelantada, ascensor arrancando
reg(12, "ACT003", 1, ZONA_PF, "Listo"); reg(12, "ACT003", 2, ZONA_PF, "Listo");
reg(11, "ACT003", 3, ZONA_PF, "Listo"); reg(11, "ACT003", 4, ZONA_PF, "Listo");
reg(9, "ACT003", 5, ZONA_PF, "Listo"); reg(3, "ACT003", 6, ZONA_PF, "En curso"); reg(3, "ACT003", 7, ZONA_PF, "En replanteo");
reg(7, "ACT005", 1, ZONA_PF, "Listo"); reg(7, "ACT005", 2, ZONA_PF, "Listo");
reg(2, "ACT006", 6, ZONA_PF, "En curso");
reg(1, "ACT007", 8, ZONA_PF, "En replanteo");
// Apartamentos: mamposteria al dia, acabados empezando
for (const n of [4, 5]) {
  const dias = n === 4 ? 5 : 4;
  for (const u of unidades.filter((x) => x.TIPO === "APARTAMENTO" && String(x.NIVEL) === String(n))) {
    reg(dias, "ACT010", n, u.UNIDAD, "Listo");
    reg(dias, "ACT011", n, u.UNIDAD, n === 4 ? "Listo" : "En curso");
  }
}
for (const u of unidades.filter((x) => x.TIPO === "APARTAMENTO" && String(x.NIVEL) === "6")) reg(2, "ACT010", 6, u.UNIDAD, "En curso");
for (const u of unidades.filter((x) => x.TIPO === "APARTAMENTO" && String(x.NIVEL) === "4")) reg(2, "ACT020", 4, u.UNIDAD, "En replanteo");
// Zonas comunes aseadas
for (const u of zonasComunes.filter((z) => String(z.NIVEL) === "1")) reg(6, "ACT090", 1, u.UNIDAD, "Listo");

await appendRows("REGISTRO", HEADERS.REGISTRO, registros);
console.log(`   REGISTRO: ${registros.length} filas nuevas.`);

console.log("== 5. Historico interpolado ==");
const [cfgFin, actsFin, capsFin, regFin] = await Promise.all([
  readRows("CONFIGURACION"), readRows("ACTIVIDADES"), readRows("CAPITULOS"), readRows("REGISTRO")
]);
const av = calcularAvance(cfgFin, actsFin, capsFin, regFin, PROY, unidades);
const filasHist = [];
for (const p of [{ d: 28, f: 0.15 }, { d: 21, f: 0.4 }, { d: 14, f: 0.65 }, { d: 7, f: 0.85 }]) {
  const fecha = diasAtras(p.d);
  filasHist.push([fecha, PROY, "GENERAL", (av.general * p.f).toFixed(1)]);
  for (const n of av.niveles) filasHist.push([fecha, PROY, "NIVEL:" + n.n, (n.pct * p.f).toFixed(1)]);
  for (const un of av.unidades) filasHist.push([fecha, PROY, "UNIDAD:" + un.u, (un.pct * p.f).toFixed(1)]);
}
const hoy = new Date().toISOString();
filasHist.push([hoy, PROY, "GENERAL", av.general.toFixed(1)]);
for (const n of av.niveles) filasHist.push([hoy, PROY, "NIVEL:" + n.n, n.pct.toFixed(1)]);
for (const un of av.unidades) filasHist.push([hoy, PROY, "UNIDAD:" + un.u, un.pct.toFixed(1)]);
await appendRows("HISTORICO", HEADERS.HISTORICO, filasHist);
console.log(`   HISTORICO: ${filasHist.length} puntos.`);

console.log("\n== Resumen del demo ==");
console.log(`   Avance general: ${av.general.toFixed(1)}%`);
console.log("   Modos:", acts.filter((a) => a.ACTIVO === "SI").map((a) => `${a.CODIGO}:${aplicacionDe(a)}${aplicacionDe(a) === "ZONA" ? "(" + zonaDe(a) + ")" : ""}`).join(" "));
console.log("Reinicio del demo terminado.");
