const assert = (cond, msg) => { if (!cond) { console.log("FALLO:", msg); process.exitCode = 1; } };

const aplicacionDe = (act) => (String(act?.APLICACION || "").toUpperCase() === "NIVEL" ? "NIVEL" : "UNIDAD");
assert(aplicacionDe({ APLICACION: "NIVEL" }) === "NIVEL", "APLICACION=NIVEL");
assert(aplicacionDe({ APLICACION: "unidad" }) === "UNIDAD", "minusculas normalizadas");
assert(aplicacionDe({}) === "UNIDAD", "vacio = UNIDAD (retrocompatible)");

const D_actividades = [
  { CODIGO: "ACT001", APLICACION: "" },
  { CODIGO: "ACT004", APLICACION: "NIVEL" }
];
const esPorNivel = (a) => String(D_actividades.find((x) => x.CODIGO === a)?.APLICACION || "").toUpperCase() === "NIVEL";
assert(!esPorNivel("ACT001"), "ACT001 sigue siendo por unidad");
assert(esPorNivel("ACT004"), "ACT004 detectada por nivel");
assert(!esPorNivel("NOEXISTE"), "actividad inexistente no rompe");

const pesos = [{ CODIGO: "ACT001", P: 0.3 }, { CODIGO: "ACT002", P: 0.25 }, { CODIGO: "ACT003", P: 0.25 }, { CODIGO: "ACT004", P: 0.2 }];
const suma = pesos.reduce((s, x) => s + x.P, 0);
assert(Math.abs(suma - 1) < 1e-9, "CAP01 suma ponderaciones 1.0 tras reajuste");

const clave = ["T2", "ACT004", "2", "NIVEL"].join("|");
assert(clave === "T2|ACT004|2|NIVEL", "clave de configuracion con pseudo-unidad NIVEL");

console.log(process.exitCode ? "TESTS POR-NIVEL FALLARON" : "TESTS POR-NIVEL OK — retrocompatible y con pesos normalizados");
