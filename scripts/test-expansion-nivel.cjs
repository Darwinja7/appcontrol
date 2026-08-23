const assert = (cond, msg) => { if (!cond) { console.log("FALLO:", msg); process.exitCode = 1; } };
const num = (v) => { const n = parseFloat(String(v ?? "0").replace(",", ".")); return isNaN(n) ? 0 : n; };

// Replica de la logica backend: valFila para UNIDAD=NIVEL promedia unidades
const VALORES = { "Sin empezar": 0, "En replanteo": 0.1, "En curso": 0.5, "En remate": 0.8, "Listo": 1 };
const last = new Map([
  ["ACT004|2|201", { ESTADO: "Listo", VALOR: "1" }],
  ["ACT004|2|202", { ESTADO: "Listo", VALOR: "1" }],
  ["ACT004|2|203", { ESTADO: "En curso", VALOR: "0.5" }],
  ["ACT004|3|NIVEL", { ESTADO: "Manual", VALOR: "0.65" }]
]);
const unidadesPorNivel = new Map([["T2|2", ["201", "202", "203"]], ["T2|4", []]]);
const valOf = (a, n, u) => { const l = last.get(a + "|" + n + "|" + u); if (!l) return 0; return String(l.ESTADO) === "Manual" ? num(l.VALOR) : (VALORES[l.ESTADO] ?? 0); };
const valFila = (r) => {
  if (String(r.UNIDAD) === "NIVEL") {
    const us = unidadesPorNivel.get(String(r.TORRE) + "|" + String(r.NIVEL)) || [];
    if (us.length) return us.reduce((s, un) => s + valOf(r.ACTIVIDAD, r.NIVEL, un), 0) / us.length;
    return valOf(r.ACTIVIDAD, r.NIVEL, "NIVEL");
  }
  return valOf(r.ACTIVIDAD, r.NIVEL, r.UNIDAD);
};

assert(Math.abs(valFila({ TORRE: "T2", ACTIVIDAD: "ACT004", NIVEL: "2", UNIDAD: "NIVEL" }) - 5 / 6) < 1e-9, "nivel 2 promedia sus 3 unidades");
assert(Math.abs(valFila({ TORRE: "T2", ACTIVIDAD: "ACT004", NIVEL: "3", UNIDAD: "NIVEL" }) - 0.65) < 1e-9, "nivel sin unidades usa fila NIVEL con Manual");
assert(valFila({ TORRE: "T2", ACTIVIDAD: "ACT004", NIVEL: "4", UNIDAD: "NIVEL" }) === 0, "sin datos = 0");

// Expansion registro-save: item unidad=NIVEL -> una fila por unidad activa
const unidadesHoja = [
  { PROYECTO: "P000", TORRE: "T2", NIVEL: "2", UNIDAD: "201", ACTIVO: "SI" },
  { PROYECTO: "P000", TORRE: "T2", NIVEL: "2", UNIDAD: "202", ACTIVO: "SI" },
  { PROYECTO: "P000", TORRE: "T2", NIVEL: "2", UNIDAD: "203", ACTIVO: "NO" }
];
const it = { torre: "T2", actividad: "ACT004", nivel: "2", unidad: "NIVEL", estado: "Listo" };
let destinos = [it.unidad];
if (String(it.unidad) === "NIVEL") {
  const delNivel = unidadesHoja.filter((x) =>
    x.PROYECTO === "P000" && x.TORRE === it.torre && String(x.NIVEL) === String(it.nivel) && String(x.ACTIVO).toUpperCase() === "SI"
  ).map((x) => x.UNIDAD);
  if (delNivel.length) destinos = delNivel;
}
assert(destinos.join(",") === "201,202", "expansion solo unidades ACTIVO=SI");

// pct manual -> estado Manual y valor fraccion
const p = 65; const estadoM = "Manual"; const valorM = String(Math.round(p) / 100);
assert(valorM === "0.65", "pct manual a fraccion");

console.log(process.exitCode ? "TESTS EXPANSION FALLARON" : "TESTS EXPANSION OK — promedio por nivel, expansion y pct manual");
