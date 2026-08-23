// Inicializador de la base de datos (Google Sheets) de AppControl.
//
// Crea la estructura MÍNIMA para ejecutar el código: las 10 pestañas definidas
// en api/_lib/model.js con su fila de cabecera exacta. Es idempotente: puede
// correrse cuantas veces quieras sin tocar datos existentes.
//
// USO (PowerShell):
//   $env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content ruta\service-account.json -Raw)
//   $env:SPREADSHEET_ID = "<id>"          # si ya tienes la hoja creada
//   node scripts/init-db.mjs
//
// Opciones:
//   --admin=tu@correo.com     Crea un usuario ADMIN (contraseña temporal se
//                             muestra UNA vez por pantalla).
//   --create                  Crea la hoja de cálculo nueva vía API (queda en
//                             propiedad de la cuenta de servicio; imprime el
//                             SPREADSHEET_ID para configurar en Vercel).
//
// Flujo recomendado (sin --create):
//   1. Crea una hoja vacía en tu Drive llamada "AppControl DB".
//   2. Compártela como Editor con el correo de la cuenta de servicio.
//   3. Pon su ID en SPREADSHEET_ID y corre este script.
import fs from "fs";
import crypto from "crypto";
import { GoogleAuth } from "google-auth-library";
import { HEADERS } from "../api/_lib/model.js";
import { hashPassword } from "../api/_lib/auth.js";

const args = process.argv.slice(2);
const opt = {};
for (const a of args) {
  const m = a.match(/^--([a-z]+)(?:=(.*))?$/);
  if (m) opt[m[1]] = m[2] === undefined ? true : m[2];
}

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error("Falta GOOGLE_SERVICE_ACCOUNT_JSON. Ejemplo:\n  $env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content ruta\\service-account.json -Raw)");
  process.exit(1);
}

const HOJAS = Object.keys(HEADERS); // 10 pestañas, única fuente: model.js

const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const client = await auth.getClient();
const call = async (method, path, body) =>
  (await client.request({ method, url: "https://sheets.googleapis.com/v4/spreadsheets" + path, data: body })).data;

let ssId = process.env.SPREADSHEET_ID || "";

if (!ssId && opt.create) {
  console.log("Creando hoja de cálculo nueva...");
  const nuevo = await call("POST", "", {
    properties: { title: "AppControl DB" },
    sheets: HOJAS.map((t) => ({ properties: { title: t } })),
  });
  ssId = nuevo.spreadsheetId;
  console.log("SPREADSHEET_ID =", ssId);
  console.log("-> Configura esta variable en Vercel.");
} else if (!ssId) {
  console.error([
    "Falta SPREADSHEET_ID. Dos opciones:",
    "  A) Crea la hoja manualmente y corre:",
    "     $env:SPREADSHEET_ID=\"<id>\"; node scripts/init-db.mjs",
    "  B) Deja que el script la cree:  node scripts/init-db.mjs --create",
  ].join("\n"));
  process.exit(1);
}

// Verifica acceso y pestañas existentes.
const meta = await call("GET", `/${ssId}?fields=properties.title,sheets.properties.title`);
console.log(`Conectado a: "${meta.properties.title}"`);
const existentes = new Set((meta.sheets || []).map((s) => s.properties.title));

const faltantes = HOJAS.filter((t) => !existentes.has(t));
if (faltantes.length) {
  await call("POST", `/${ssId}:batchUpdate`, {
    requests: faltantes.map((t) => ({ addSheet: { properties: { title: t } } })),
  });
  console.log(`Pestañas creadas: ${faltantes.join(", ")}`);
} else {
  console.log("Todas las pestañas ya existen.");
}

// Cabeceras solo si la fila 1 está vacía (nunca sobrescribe datos).
for (const t of HOJAS) {
  const d = await call("GET", `/${ssId}/values/${encodeURIComponent(t)}!A1:${HEADERS[t].length}`);
  const actual = (d.values || [])[0] || [];
  const coincide = actual.length > 0 &&
    HEADERS[t].every((h, i) => String(actual[i] ?? "").trim() === h);
  if (!actual.length) {
    await call("PUT", `/${ssId}/values/${encodeURIComponent(t)}!A1?valueInputOption=RAW`, { values: [HEADERS[t]] });
    console.log(`  ${t}: cabeceras escritas (${HEADERS[t].length} columnas)`);
  } else if (!coincide) {
    console.warn(`  ${t}: ATENCIÓN — las cabeceras existentes NO coinciden con model.js. Revisar manualmente.`);
  } else {
    console.log(`  ${t}: OK`);
  }
}

// Administrador inicial opcional.
if (opt.admin) {
  const rango = `/${ssId}/values/${encodeURIComponent("USUARIOS")}!A:ZZ`;
  const d = await call("GET", rango);
  const v = d.values || [];
  const h = v[0] || HEADERS.USUARIOS;
  const filas = v.slice(1);
  const idx = (k) => h.indexOf(k);
  const yaExiste = filas.some((f) => String(f[idx("EMAIL")] || "").toLowerCase() === String(opt.admin).toLowerCase());
  if (yaExiste) {
    console.log("ADMIN: ese correo ya existe en USUARIOS; no se creó nada.");
  } else {
    // Empresa/proyecto: primera fila de cada catálogo o default E001/P001.
    const leerPrimera = async (hoja, col) => {
      const dd = await call("GET", `/${ssId}/values/${encodeURIComponent(hoja)}!A2:2`);
      return ((dd.values || [])[0] || [])[col] || "";
    };
    let emp = await leerPrimera("EMPRESAS", 0);
    let proy = await leerPrimera("PROYECTOS", 1);
    if (!emp || !proy) {
      emp = emp || "E001"; proy = proy || "P001";
      console.warn(`Nota: catálogos vacíos; ADMIN creado con empresa=${emp} proyecto=${proy}. Ajusta o corre scripts/seed.mjs.`);
    }
    const max = filas.reduce((m, f) => Math.max(m, parseInt(String(f[idx("ID_USUARIO")] || "").replace(/^U/, ""), 10) || 0), 0);
    const tempPass = crypto.randomBytes(6).toString("base64url");
    const fila = HEADERS.USUARIOS.map((campo) => ({
      ID_USUARIO: "U" + String(max + 1).padStart(4, "0"),
      NOMBRE: "Administrador", EMAIL: String(opt.admin).toLowerCase(), ROL: "ADMIN",
      EMPRESA: emp, PROYECTO: proy, TORRE: "*", SENDER_ID: String(opt.admin).toLowerCase(),
      PASSWORD_HASH: hashPassword(tempPass), MUST_CHANGE_PASSWORD: "SI",
      ACCESS_CODE_HASH: "", RESET_PIN_HASH: "", RESET_PIN_EXPIRES: "", ACTIVO: "SI"
    })[campo] ?? "");
    await call("POST", `/${ssId}/values/${encodeURIComponent("USUARIOS")}!A1?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { values: [fila] });
    console.log("\n========================================================");
    console.log("ADMIN creado:");
    console.log("  Correo:    ", opt.admin);
    console.log("  Contraseña:", tempPass, " (cópiala AHORA — no se vuelve a mostrar)");
    console.log("  Deberá cambiarla en el primer inicio de sesión.");
    console.log("========================================================\n");
  }
}
