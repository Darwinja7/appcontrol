const capitulos = [
  { CODIGO: "CAP01", PROYECTO: "P001", ACTIVO: "SI" },
  { CODIGO: "CAP02", PROYECTO: "P001", ACTIVO: "NO" },
  { CODIGO: "CAP03", PROYECTO: "P000", ACTIVO: "SI" }
];
const actividades = [
  { CODIGO: "ACT1", CAPITULO: "CAP01", ACTIVO: "SI" },
  { CODIGO: "ACT2", CAPITULO: "CAP02", ACTIVO: "SI" },
  { CODIGO: "ACT3", CAPITULO: "CAP01", ACTIVO: "NO" },
  { CODIGO: "ACT4", CAPITULO: "CAP09", ACTIVO: "SI" },
  { CODIGO: "ACT5", CAPITULO: "", ACTIVO: "SI" }
];
const contratistas = [{ CODIGO: "CT1", ACTIVO: "SI" }, { CODIGO: "CT2", ACTIVO: "NO" }];
const proy = "P001";

const capsProy = new Set(
  capitulos.filter((x) => String(x.PROYECTO || "") === proy && String(x.ACTIVO || "").toUpperCase() === "SI")
    .map((x) => String(x.CODIGO || ""))
);
const actsProy = actividades.filter(
  (x) => String(x.ACTIVO || "").toUpperCase() === "SI" && capsProy.has(String(x.CAPITULO || ""))
);
const cts = contratistas.filter((ct) => String(ct.ACTIVO || "").toUpperCase() === "SI");

console.assert(actsProy.length === 1 && actsProy[0].CODIGO === "ACT1", "FALLO actividades");
console.assert(cts.length === 1 && cts[0].CODIGO === "CT1", "FALLO contratistas");

const niveles = [{ PROYECTO: "P001", TORRE: "T2" }];
const unidades = [{ PROYECTO: "P001", TORRE: "T1" }];
const unionTorres = [...new Set([
  ...unidades.filter((u) => u.PROYECTO === proy).map((u) => u.TORRE),
  ...niveles.filter((n) => n.PROYECTO === proy).map((n) => n.TORRE)
])].sort();
console.assert(unionTorres.join(",") === "T1,T2", "FALLO union de torres");

if (!actsProy.length || actsProy[0].CODIGO !== "ACT1") process.exit(1);
console.log("TESTS A1 OK — filtros de relaciones correctos");
