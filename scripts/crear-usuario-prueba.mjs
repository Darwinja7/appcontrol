// Crea un usuario temporal de prueba para validar flujos en produccion.
//
//   node scripts/crear-usuario-prueba.mjs <correo> [nombre] [rol] [torre]
//
// Inserta en USUARIOS de E001/P000 (por defecto RESIDENTE, torre T2,
// MUST_CHANGE_PASSWORD=NO). Con rol ADMIN usa torre * (todas).
// Idempotente: si el correo ya existe, no hace nada. La contrasena inicial
// se muestra UNA vez.
import { readRows, replaceRows } from "../api/_lib/sheets.js";
import { HEADERS } from "../api/_lib/model.js";
import { hashPassword, passwordTemporal } from "../api/_lib/auth.js";

const EMPRESA = "E001", PROYECTO = "P000";

const [emailArg, nombreArg, rolArg, torreArg] = process.argv.slice(2);
if (!emailArg || !emailArg.includes("@")) {
  console.error("Uso: node scripts/crear-usuario-prueba.mjs <correo> [nombre] [rol=RESIDENTE|ADMIN|VISUALIZADOR] [torre=T2|*]");
  process.exit(1);
}
const ROL = ["ADMIN", "RESIDENTE", "VISUALIZADOR"].includes(String(rolArg || "").toUpperCase()) ? String(rolArg).toUpperCase() : "RESIDENTE";
const TORRE = ROL === "ADMIN" ? (torreArg || "*") : (torreArg || "T2");
if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID) {
  console.error("Faltan GOOGLE_SERVICE_ACCOUNT_JSON o SPREADSHEET_ID en el entorno.");
  process.exit(1);
}
const { randomBytes } = await import("crypto");

const usuarios = await readRows("USUARIOS");
const existente = usuarios.find((u) => String(u.EMAIL || "").toLowerCase() === emailArg.toLowerCase() && u.EMPRESA === EMPRESA && u.PROYECTO === PROYECTO);
if (existente) {
  console.log(`El usuario ${existente.EMAIL} ya existe (${existente.ROL}, ACTIVO=${existente.ACTIVO}). Nada por hacer.`);
  process.exit(0);
}

const max = usuarios.reduce((m, u) => {
  const n = parseInt(String(u.ID_USUARIO || "").replace(/^U/, ""), 10);
  return Number.isFinite(n) && n > m ? n : m;
}, 0);
const id = "U" + String(max + 1).padStart(4, "0");
const tempPass = passwordTemporal();
const accessCode = "AC-" + randomBytes(12).toString("base64url").toUpperCase();
const { sha256Hex } = await import("../api/_lib/auth.js");

usuarios.push({
  ID_USUARIO: id,
  NOMBRE: nombreArg || "Usuario Prueba PIN",
  EMAIL: String(emailArg).toLowerCase(),
  ROL,
  EMPRESA,
  PROYECTO,
  TORRE,
  SENDER_ID: String(emailArg).toLowerCase(),
  PASSWORD_HASH: hashPassword(tempPass),
  MUST_CHANGE_PASSWORD: "NO",
  ACCESS_CODE_HASH: sha256Hex(accessCode),
  RESET_PIN_HASH: "",
  RESET_PIN: "",
  RESET_PIN_EXPIRES: "",
  ACTIVO: "SI"
});
await replaceRows("USUARIOS", HEADERS.USUARIOS, usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length - 1);

const verificacion = await readRows("USUARIOS");
const fila = verificacion.find((u) => String(u.EMAIL || "").toLowerCase() === emailArg.toLowerCase());
console.log("========================================================");
console.log(`Creado: ${fila.EMAIL} (${fila.ID_USUARIO}, ${fila.ROL} en ${fila.EMPRESA}/${fila.PROYECTO}/${fila.TORRE})`);
console.log("Contrasena inicial:", tempPass, "(solo para referencia; la definitiva se fija con el PIN)");
console.log("Filas totales en USUARIOS:", verificacion.length);
console.log("========================================================");
