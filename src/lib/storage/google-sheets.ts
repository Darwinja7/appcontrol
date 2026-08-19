import { google } from "googleapis";
import { getEnv, requiredEnv } from "../env";
import type { RegistroInput, StorageAdapter, StorageHealth } from "./types";

const HEADERS = [
  "ID",
  "FECHA_HORA",
  "USUARIO",
  "PROYECTO",
  "TORRE",
  "NIVEL",
  "ZONA",
  "ACTIVIDAD",
  "AVANCE",
  "OBSERVACION",
  "FUENTE",
  "ESTADO",
  "IDEMPOTENCY_KEY",
  "HASH",
];

type SheetsClient = ReturnType<typeof google.sheets>;

function getSheetsClient(): SheetsClient {
  const keyFile = requiredEnv("GOOGLE_APPLICATION_CREDENTIALS");
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];

  const auth = new google.auth.JWT({
    keyFile,
    scopes,
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

function getSpreadsheetId(): string {
  return requiredEnv("SPREADSHEET_ID");
}

function getRegistrosSheet(): string {
  return getEnv("SHEET_REGISTROS", "REGISTROS");
}

async function ensureSheetExists(
  sheets: SheetsClient,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  const ss = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const exists = ss.data.sheets?.some(
    (sheet) => sheet.properties?.title === sheetName
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
  }
}

async function ensureHeader(
  sheets: SheetsClient,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  const range = `${sheetName}!A1:N1`;

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const firstRow = current.data.values?.[0];

  if (!firstRow || firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADERS],
      },
    });
  }
}

async function findRegistroByIdempotencyKey(
  key: string
): Promise<string | null> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getRegistrosSheet();

  await ensureSheetExists(sheets, spreadsheetId, sheetName);
  await ensureHeader(sheets, spreadsheetId, sheetName);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:M`,
  });

  const rows = res.data.values ?? [];

  for (const row of rows) {
    if (row[12] === key) {
      return row[0] ? String(row[0]) : null;
    }
  }

  return null;
}

async function appendRegistro(registro: RegistroInput): Promise<string> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getRegistrosSheet();

  await ensureSheetExists(sheets, spreadsheetId, sheetName);
  await ensureHeader(sheets, spreadsheetId, sheetName);

  const existing = await findRegistroByIdempotencyKey(registro.idempotencyKey);
  if (existing) {
    return existing;
  }

  const currentIds = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:A`,
  });

  const count = currentIds.data.values?.length ?? 0;
  const id = `OB-${String(count + 1).padStart(6, "0")}`;

  const row = [
    id,
    registro.fechaHora,
    registro.usuario,
    registro.proyecto,
    registro.torre,
    registro.nivel,
    registro.zona,
    registro.actividad,
    registro.avance,
    registro.observacion,
    registro.fuente,
    registro.estado,
    registro.idempotencyKey,
    registro.hash,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:N`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });

  return id;
}

async function healthCheck(): Promise<StorageHealth> {
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const sheetName = getRegistrosSheet();

    await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title",
    });

    await ensureSheetExists(sheets, spreadsheetId, sheetName);
    await ensureHeader(sheets, spreadsheetId, sheetName);

    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1`,
    });

    return {
      connected: true,
      readable: true,
      writable: false,
      message:
        "Read access verified. Write access must be verified with a real capture/test-write.",
    };
  } catch (error) {
    return {
      connected: false,
      readable: false,
      writable: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export const googleSheetsStorage: StorageAdapter = {
  name: "google_sheets",
  healthCheck,
  findRegistroByIdempotencyKey,
  appendRegistro,
};

export async function readSheetRows(
  sheetName: string
): Promise<Record<string, string>[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await ensureSheetExists(sheets, spreadsheetId, sheetName);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`,
  });

  const values = res.data.values ?? [];
  if (values.length === 0) return [];

  const [header, ...rows] = values;

  return rows.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[String(h).trim()] = String(row[i] ?? "").trim();
    });
    return obj;
  });
}
