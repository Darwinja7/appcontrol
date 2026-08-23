import { GoogleAuth } from "google-auth-library";

let clientP = null;
async function client() {
  if (!clientP) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no definida en el entorno.");
    const auth = new GoogleAuth({
      credentials: JSON.parse(raw),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    clientP = auth.getClient();
  }
  return clientP;
}

const SID = () => process.env.SPREADSHEET_ID;
const BASE = "https://sheets.googleapis.com/v4/spreadsheets/";

// Reintentos con backoff ante 429 (cuota) y 5xx transitorios de la API.
async function req(method, path, body, intento = 0) {
  const c = await client();
  let res;
  try {
    res = await c.request({ method, url: BASE + SID() + path, data: body });
    return res.data;
  } catch (e) {
    const status = e?.response?.status ?? e?.code ?? 0;
    const reintentable = status === 429 || status === 500 || status === 502 || status === 503 || status === "ETIMEDOUT";
    if (reintentable && intento < 3) {
      const espera = Math.min(2000 * 2 ** intento, 8000) + Math.floor(Math.random() * 300);
      await new Promise((r) => setTimeout(r, espera));
      return req(method, path, body, intento + 1);
    }
    throw e;
  }
}

// Letra(s) de columna para índices 1-based: 1->A, 26->Z, 27->AA, 28->AB...
function colLetter(n) {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function ensureSheet(t) {
  const ss = await req("GET", "?fields=sheets.properties");
  if (!(ss.sheets || []).some((s) => s.properties.title === t))
    await req("POST", ":batchUpdate", { requests: [{ addSheet: { properties: { title: t } } }] });
}

export async function readRows(sheet) {
  await ensureSheet(sheet);
  const d = await req("GET", `/values/${encodeURIComponent(sheet)}!A:ZZ`);
  const v = d.values || [];
  if (!v.length) return [];
  const [h, ...rows] = v;
  return rows.map((r) => { const o = {}; h.forEach((k, i) => { o[String(k).trim()] = String(r[i] ?? "").trim(); }); return o; });
}

// Escribe la hoja completa. Si se pasa `filasPrevias` (conteo leído antes del
// cambio), actualiza en el rango exacto y limpia solo el sobrante — evita el
// patrón destructivo clear+write que pierde datos ante escrituras concurrentes.
export async function replaceRows(sheet, header, rows, filasPrevias) {
  await ensureSheet(sheet);
  const payload = rows.length ? [header, ...rows] : [header];
  const lastCol = colLetter(Math.max(header.length, ...payload.map((r) => r.length)));
  if (Number.isFinite(filasPrevias) && filasPrevias >= 0) {
    await req("PUT", `/values/${encodeURIComponent(sheet)}!A1:${lastCol}${payload.length}?valueInputOption=RAW`,
      { values: payload });
    const sobrantes = filasPrevias + 1 - payload.length; // +1 por la cabecera
    if (sobrantes > 0) {
      try {
        await req("POST", `/values/${encodeURIComponent(sheet)}!A${payload.length + 1}:${lastCol}${payload.length + sobrantes}:clear`, {});
      } catch {}
    }
  } else {
    // Sin conteo previo: comportamiento clásico (clear + write).
    try { await req("POST", `/values/${encodeURIComponent(sheet)}:clear`, {}); } catch {}
    await req("PUT", `/values/${encodeURIComponent(sheet)}!A1?valueInputOption=RAW`, { values: payload });
  }
}

export async function appendRows(sheet, header, rows) {
  await ensureSheet(sheet);
  const last = colLetter(header.length);
  // El endpoint de append requiere el sufijo ":append" sobre el rango.
  await req("POST", `/values/${encodeURIComponent(sheet)}!A:${last}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { values: rows });
}
