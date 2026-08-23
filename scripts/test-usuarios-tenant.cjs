const assert = (cond, msg) => { if (!cond) { console.log("FALLO:", msg); process.exitCode = 1; } };

function torreValida(torre, rol, torresProy) {
  const t = String(torre || "").trim();
  if (t === "*") return ["ADMIN", "VISUALIZADOR"].includes(String(rol)) ? { t } : null;
  if (!t) return null;
  return torresProy.includes(t) ? { t } : null;
}
function combinacionRolTorreOk(u) {
  const t = String(u.TORRE || "").trim();
  if (t !== "*") return true;
  return ["ADMIN", "VISUALIZADOR"].includes(String(u.ROL || "").toUpperCase());
}
function esDesarrollador(u, lista) {
  const set = new Set(lista.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
  return String(u?.ROL || "").toUpperCase() === "ADMIN" && set.has(String(u?.EMAIL || "").toLowerCase());
}

const torres = ["T1", "T2"];

assert(torreValida("T1", "RESIDENTE", torres).t === "T1", "residente con torre real ok");
assert(torreValida("*", "RESIDENTE", torres) === null, "residente sin * rechazado");
assert(torreValida("*", "VISUALIZADOR", torres).t === "*", "visualizador con * ok");
assert(torreValida("T9", "RESIDENTE", torres) === null, "torre inexistente rechazada");
assert(torreValida("", "RESIDENTE", torres) === null, "torre vacia rechazada");

assert(combinacionRolTorreOk({ TORRE: "*", ROL: "ADMIN" }), "admin puede conservar *");
assert(!combinacionRolTorreOk({ TORRE: "*", ROL: "RESIDENTE" }), "residente no queda con * tras patch");
assert(combinacionRolTorreOk({ TORRE: "T2", ROL: "RESIDENTE" }), "residente con T2 ok");

const dev = esDesarrollador({ ROL: "ADMIN", EMAIL: "darwin@x.com" }, "Darwin@X.com, otro@y.com");
const normal = esDesarrollador({ ROL: "ADMIN", EMAIL: "otro@y.com" }, "darwin@x.com");
const residente = esDesarrollador({ ROL: "RESIDENTE", EMAIL: "darwin@x.com" }, "darwin@x.com");
assert(dev && !normal && !residente, "esDesarrollador distingue bien (case-insensitive)");

const empresas = [{ CODIGO: "E001", ACTIVO: "SI" }, { CODIGO: "E002", ACTIVO: "NO" }];
const proyectos = [
  { EMPRESA: "E001", CODIGO: "P001", ACTIVO: "SI" },
  { EMPRESA: "E001", CODIGO: "P000", ACTIVO: "SI" },
  { EMPRESA: "E002", CODIGO: "P002", ACTIVO: "SI" },
  { EMPRESA: "E001", CODIGO: "P003", ACTIVO: "NO" }
];
function destinoValido(empresa, proyecto) {
  const empOk = empresas.find((e) => e.CODIGO === empresa && String(e.ACTIVO).toUpperCase() === "SI");
  const proyOk = proyectos.find((p) => p.EMPRESA === empresa && p.CODIGO === proyecto && String(p.ACTIVO).toUpperCase() === "SI");
  return !!(empOk && proyOk);
}
assert(destinoValido("E001", "P001"), "destino activo ok");
assert(!destinoValido("E002", "P002"), "empresa inactiva rechazada");
assert(!destinoValido("E001", "P003"), "proyecto inactivo rechazado");
assert(!destinoValido("E001", "P999"), "proyecto inexistente rechazado");

console.log(process.exitCode ? "TESTS A2/A3 FALLARON" : "TESTS A2/A3 OK — torres por rol, combinacion final, dev-admin y destino valido");
