import pkg from "googleapis";
const { google } = pkg;

const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const spreadsheetId = process.env.SPREADSHEET_ID;

if (!keyFile || !spreadsheetId) {
  console.error("Faltan GOOGLE_APPLICATION_CREDENTIALS o SPREADSHEET_ID");
  process.exit(1);
}

const auth = new google.auth.JWT({
  keyFile,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const DATA = {
  PROYECTOS: {
    header: ["PROYECTO", "NOMBRE", "TORRES", "ACTIVO"],
    rows: [["P001", "Proyecto Uno", "T1,T2", "SI"]],
  },
  ZONAS: {
    header: ["PROYECTO", "TORRE", "NIVEL", "ZONA", "ACTIVA"],
    rows: [
      ["P001", "T2", "18", "A1803", "SI"],
      ["P001", "T2", "17", "A1703", "SI"],
      ["P001", "T1", "5", "A1501", "SI"],
    ],
  },
  ACTIVIDADES: {
    header: ["ACTIVIDAD", "DESCRIPCION", "ACTIVA"],
    rows: [
      ["A001", "Vaciado de concreto", "SI"],
      ["A002", "Enchape y acabados", "SI"],
    ],
  },
  USUARIOS: {
    header: [
      "ID_USUARIO",
      "NOMBRE",
      "ROL",
      "PROYECTO",
      "TORRE",
      "SENDER_ID",
      "ACTIVO",
      "PIN_HASH",
    ],
    rows: [
      [
        "U001",
        "Darwin",
        "RESIDENTE",
        "P001",
        "T2",
        "999000111",
        "SI",
        "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
      ],
    ],
  },
};

async function ensureSheet(title) {
  const ss = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const exists = (ss.data.sheets || []).some(
    (s) => s.properties && s.properties.title === title
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
  }
}

async function replaceRows(title, header, rows) {
  await ensureSheet(title);
  try {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: title });
  } catch {}
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [header, ...rows] },
  });
  console.log(`OK ${title} (${rows.length} filas)`);
}

for (const [title, def] of Object.entries(DATA)) {
  await replaceRows(title, def.header, def.rows);
}

console.log("SEED COMPLETO");
