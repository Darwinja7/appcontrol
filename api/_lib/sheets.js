import { GoogleAuth } from "google-auth-library";
let clientP = null;
async function client() {
  if (!clientP) {
    const auth = new GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    clientP = auth.getClient();
  }
  return clientP;
}
const SID = () => process.env.SPREADSHEET_ID;
const BASE = "https://sheets.googleapis.com/v4/spreadsheets/";
async function req(method, path, body) {
  const c = await client();
  const res = await c.request({ method, url: BASE + SID() + path, data: body });
  return res.data;
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
export async function replaceRows(sheet, header, rows) {
  await ensureSheet(sheet);
  try { await req("POST", `/values/${encodeURIComponent(sheet)}:clear`, {}); } catch {}
  await req("PUT", `/values/${encodeURIComponent(sheet)}!A1?valueInputOption=RAW`, { values: rows.length ? [header, ...rows] : [header] });
}
export async function appendRows(sheet, header, rows) {
  await ensureSheet(sheet);
  const last = String.fromCharCode(64 + header.length);
  await req("POST", `/values/${encodeURIComponent(sheet)}!A:${last}?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { values: rows });
}
