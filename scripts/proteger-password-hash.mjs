// Protege la columna PASSWORD_HASH de USUARIOS contra edicion manual desde la
// interfaz de Google Sheets. Usa un rango protegido (addProtectedRange) que
// solo deja escribir a la cuenta de servicio: asi el hash nunca se rompe a mano.
//
//   node scripts/proteger-password-hash.mjs
//
// Requiere SPREADSHEET_ID y (GOOGLE_APPLICATION_CREDENTIALS o el archivo
// ../appcontrol-service-account.json respecto al repo). Idempotente: si la
// proteccion ya existe, no hace nada.
import { GoogleAuth } from "google-auth-library";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SID = process.env.SPREADSHEET_ID;
if (!SID) {
  console.error("Falta SPREADSHEET_ID en el entorno.");
  process.exit(1);
}
const saDefault = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "appcontrol-service-account.json");
const candidatas = [process.env.GOOGLE_APPLICATION_CREDENTIALS, saDefault].filter(Boolean);
const keyFile = candidatas.find((c) => existsSync(c));
if (!keyFile) {
  console.error("No se encontro la cuenta de servicio. Probé:", candidatas.join(" | "));
  process.exit(1);
}

// Columna 9 de USUARIOS segun model.js -> indice 0-based 8 (columna I).
const COL_INICIO = 8;
const COL_FIN = 9;
const DESCRIPCION = "PASSWORD_HASH — escritura solo por la API (service account). No editar a mano.";

const auth = new GoogleAuth({ keyFile, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const client = await auth.getClient();
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SID}`;

function colLetra(n) {
  let s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const meta = (await client.request({ method: "GET", url: `${BASE}?fields=sheets.properties,sheets.protectedRanges` })).data;
const hoja = (meta.sheets || []).find((s) => s.properties.title === "USUARIOS");
if (!hoja) {
  console.error("La pestana USUARIOS no existe en la hoja de calculo.");
  process.exit(1);
}
const sheetId = hoja.properties.sheetId;

const yaExiste = (hoja.protectedRanges || []).some((p) => {
  const r = p.range || {};
  return r.sheetId === sheetId && r.startColumnIndex === COL_INICIO && r.endColumnIndex === COL_FIN;
});

if (yaExiste) {
  console.log("La columna PASSWORD_HASH ya esta protegida. Nada por hacer.");
} else {
  await client.request({
    method: "POST",
    url: `${BASE}:batchUpdate`,
    data: {
      requests: [{
        addProtectedRange: {
          protectedRange: {
            range: { sheetId, startColumnIndex: COL_INICIO, endColumnIndex: COL_FIN },
            description: DESCRIPCION,
            warningOnly: false
          }
        }
      }]
    }
  });
  console.log(`Proteccion creada sobre USUARIOS!${colLetra(COL_INICIO + 1)}:${colLetra(COL_FIN)} (solo la service account puede escribir).`);
}

// Verificacion: releer y mostrar las protecciones vigentes de USUARIOS.
const post = (await client.request({ method: "GET", url: `${BASE}?fields=sheets.properties.title,sheets.protectedRanges` })).data;
const hojaPost = (post.sheets || []).find((s) => s.properties.title === "USUARIOS");
const prot = (hojaPost.protectedRanges || []).map((p) => ({
  columnas: `${colLetra((p.range.startColumnIndex ?? 0) + 1)}-${colLetra(p.range.endColumnIndex ?? 0)}`,
  descripcion: p.description || "(sin descripcion)",
  soloAdvertencia: Boolean(p.warningOnly)
}));
console.log("Protecciones vigentes en USUARIOS:", JSON.stringify(prot, null, 2));
