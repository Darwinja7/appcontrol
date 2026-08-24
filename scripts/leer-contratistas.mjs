// Lectura directa de CONTRATISTAS para diagnosticar el estado real de la hoja.
import { readRows } from "../api/_lib/sheets.js";

const filas = await readRows("CONTRATISTAS");
console.log(JSON.stringify(filas, null, 2));
