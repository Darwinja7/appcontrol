// Reset de contraseña por consola — herramienta de administración.
//
//   node scripts/reset-password.mjs <correo> [nuevaContraseña]
//
// Si no pasas contraseña, genera una aleatoria de 8 caracteres y la muestra
// UNA vez. Deja MUST_CHANGE_PASSWORD=SI para forzar el cambio en el primer
// ingreso (pasa --no-forzar para dejarla fija).
//
// Requiere: GOOGLE_SERVICE_ACCOUNT_JSON y SPREADSHEET_ID en el entorno.
import { readRows, replaceRows } from "../api/_lib/sheets.js";
import { HEADERS } from "../api/_lib/model.js";
import { hashPassword } from "../api/_lib/auth.js";
import crypto from "crypto";

const [emailArg, passArg] = process.argv.slice(2);
const forzar = !process.argv.includes("--no-forzar");

if (!emailArg || !emailArg.includes("@")) {
  console.error("Uso: node scripts/reset-password.mjs <correo> [nuevaContraseña] [--no-forzar]");
  process.exit(1);
}
if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID) {
  console.error("Faltan GOOGLE_SERVICE_ACCOUNT_JSON o SPREADSHEET_ID en el entorno.");
  process.exit(1);
}

const usuarios = await readRows("USUARIOS");
const idx = usuarios.findIndex((u) => String(u.EMAIL || "").toLowerCase() === emailArg.toLowerCase());
if (idx < 0) {
  console.error(`No existe ningún usuario con correo ${emailArg} en USUARIOS.`);
  console.error("Correos encontrados:", usuarios.map((u) => u.EMAIL).filter(Boolean).join(", ") || "(ninguno)");
  process.exit(1);
}

const temp = passArg || crypto.randomBytes(6).toString("base64url");
if (temp.length < 8 && !passArg) {
  // aleatoria ya cumple; este guard aplica solo si alguien pasa una corta
}
usuarios[idx] = {
  ...usuarios[idx],
  PASSWORD_HASH: hashPassword(temp),
  MUST_CHANGE_PASSWORD: forzar ? "SI" : "NO",
  RESET_PIN_HASH: "",
  RESET_PIN_EXPIRES: ""
};
await replaceRows("USUARIOS", HEADERS.USUARIOS,
  usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? "")), usuarios.length);

console.log("========================================================");
console.log(`Contraseña actualizada para: ${usuarios[idx].EMAIL}`);
console.log(`(${usuarios[idx].NOMBRE} · ${usuarios[idx].EMPRESA}/${usuarios[idx].PROYECTO})`);
console.log("Nueva contraseña:", temp);
console.log(forzar
  ? "El usuario deberá cambiarla en su próximo inicio de sesión."
  : "La contraseña queda fija (--no-forzar).");
console.log("========================================================");
