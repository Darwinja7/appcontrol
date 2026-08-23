const assert = (cond, msg) => { if (!cond) { console.log("FALLO:", msg); process.exitCode = 1; } };

function normalizarHoja(headers, filas) {
  return filas.map((f) => { const o = {}; for (const h of headers) o[h] = String(f[h] ?? "").trim(); return o; });
}
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

const H = ["CODIGO", "NOMBRE", "ACTIVO"];
const actuales = normalizarHoja(H, [
  { CODIGO: "CT01", NOMBRE: "ABC", ACTIVO: "SI" },
  { CODIGO: "CT02", NOMBRE: "VIDRIOS", ACTIVO: "SI" }
]);
const importadas = normalizarHoja(H, [
  { CODIGO: "CT01", NOMBRE: "ABC CONSTRUCCIONES", ACTIVO: "SI" },
  { CODIGO: "CT03", NOMBRE: "PINTURAS", ACTIVO: "SI" },
  { CODIGO: "CT03", NOMBRE: "PINTURAS DUP", ACTIVO: "SI" }
]);
const d = diffHoja(actuales, importadas, (r) => r.CODIGO);
assert(d.nuevos === 1, "1 nuevo");
assert(d.modificados === 1, "1 modificado");
assert(d.eliminados === 1, "1 eliminado");
assert(d.clavesDuplicadas === 1, "duplicado detectado");

// normalizacion: numeros de xlsx a string
const norm = normalizarHoja(H, [{ CODIGO: 5, NOMBRE: null }]);
assert(norm[0].CODIGO === "5" && norm[0].NOMBRE === "", "normaliza tipos del xlsx");

console.log(process.exitCode ? "TESTS MAESTRO FALLARON" : "TESTS MAESTRO OK — diff y normalizacion correctos");
