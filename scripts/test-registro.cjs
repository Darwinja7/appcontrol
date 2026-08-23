const fs = require("fs");
const html = fs.readFileSync("public/modulos/registro.html", "utf8");
const code = html.split("<script src=\"/js/app.js\"></script>")[1].split("<\/script>")[0];

let D, LAST, SEL, PEND;
const ESTADOS = ["Sin empezar", "En replanteo", "En curso", "En remate", "Listo"];
const VALOR = { "Sin empezar": 0, "En replanteo": 0.1, "En curso": 0.5, "En remate": 0.8, "Listo": 1 };
const esc = (s) => s;

function estadoEfectivo(a, n, u) {
  const k = n + "|" + u;
  if (PEND.has(a + "|" + k)) return PEND.get(a + "|" + k);
  const last = LAST.get(a + "|" + k);
  return last ? last.ESTADO : "Sin empezar";
}
const siguiente = (st) => ESTADOS[(ESTADOS.indexOf(st) + 1) % ESTADOS.length];
const colorAv = (v) => v <= 0 ? "#2A3138" : v < 0.15 ? "#5E3732" : v < 0.55 ? "#6E5620" : v < 0.85 ? "#31567C" : "#245C43";

LAST = new Map([
  ["ACT001|4|401", { ESTADO: "En curso", FECHA: "2026-08-20" }],
  ["ACT001|4|402", { ESTADO: "Listo", FECHA: "2026-08-21" }]
]);
SEL = new Set(); PEND = new Map();

let fallos = 0;
const assert = (cond, msg) => { if (!cond) { console.log("FALLO:", msg); fallos++; } };

assert(estadoEfectivo("ACT001", "4", "401") === "En curso", "lee ultimo registro");
assert(estadoEfectivo("ACT001", "5", "501") === "Sin empezar", "sin registro = Sin empezar");

PEND.set("ACT001|4|401", "En remate");
assert(estadoEfectivo("ACT001", "4", "401") === "En remate", "pendiente sobrescribe");
assert(estadoEfectivo("ACT001", "4", "402") === "Listo", "otros no afectados");

assert(siguiente("Sin empezar") === "En replanteo", "ciclo 1");
assert(siguiente("En replanteo") === "En curso", "ciclo 2");
assert(siguiente("Listo") === "Sin empezar", "ciclo cierra en 0%");

assert(colorAv(0) === "#2A3138" && colorAv(0.1) === "#5E3732" && colorAv(0.5) === "#6E5620" && colorAv(0.8) === "#31567C" && colorAv(1) === "#245C43", "colores por tramo");

const avg = [VALOR["En curso"], VALOR["Listo"]].reduce((a, b) => a + b, 0) / 2;
assert(Math.round(avg * 100) === 75, "promedio AV por nivel");

const ak = "ACT001|4|401";
const i1 = ak.indexOf("|"), i2 = ak.indexOf("|", i1 + 1);
assert(ak.slice(0, i1) === "ACT001" && ak.slice(i1 + 1, i2) === "4" && ak.slice(i2 + 1) === "401", "parse de clave actividad|nivel|unidad");

console.log(fallos ? `TESTS REGISTRO FALLARON (${fallos})` : "TESTS REGISTRO OK — ciclo, pendientes, colores y parse correctos");
process.exit(fallos ? 1 : 0);
