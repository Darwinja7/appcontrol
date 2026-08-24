// Genera una variante del maestro con un contratista temporal de prueba.
import XLSX from "xlsx";
import fs from "fs";

const origen = process.argv[2], destino = process.argv[3];
const wb = XLSX.readFile(origen);
const hoja = wb.Sheets["CONTRATISTAS"];
const filas = XLSX.utils.sheet_to_json(hoja, { header: 1 });
console.log("CONTRATISTAS actual:", JSON.stringify(filas));
if (filas.some((r) => r[0] === "C999")) { console.log("C999 ya existe"); process.exit(1); }
filas.push(["C999", "PRUEBA-TEMPORAL", "NO"]);
wb.Sheets["CONTRATISTAS"] = XLSX.utils.aoa_to_sheet(filas);
XLSX.writeFile(wb, destino);
console.log("variante con C999 escrita en", destino);
