import { readRows } from "./sheets.js";
import { descifrarLlave } from "./crypto-llm.js";
import { PROVEEDORES, resolverProveedor } from "./llm-providers.js";
import { HEADERS } from "./model.js";

// Resuelve la config LLM efectiva para un usuario:
//  1) su fila en LLM_CONFIG (llave cifrada en la hoja)
//  2) respaldo por variables de entorno del proveedor (ej. OPENROUTER_API_KEY
//     con el modelo por defecto openrouter/stealth/ox-alpha en esfuerzo low)
// Devuelve null si no hay nada configurado.
export async function resolverLlm(u) {
  const filas = await readRows("LLM_CONFIG");
  const fila = filas.find((f) => String(f.EMAIL || "").toLowerCase() === String(u.EMAIL || "").toLowerCase());
  if (fila && fila.PROVEEDOR) {
    const prov = resolverProveedor(fila.PROVEEDOR);
    if (!prov) return null;
    let llave = "";
    try { llave = fila.KEY_ENC ? descifrarLlave(fila.KEY_ENC) : ""; } catch { llave = ""; }
    if (!llave && prov.envFallback) llave = process.env[prov.envFallback] || "";
    if (!prov.baseUrl && !fila.BASE_URL) return null;
    return {
      proveedor: fila.PROVEEDOR,
      baseUrl: fila.BASE_URL || prov.baseUrl,
      modelo: fila.MODELO || prov.modeloDefault,
      razonamientoBajo: !!prov.razonamientoBajo,
      llave,
      origen: fila.KEY_ENC ? "propia" : "servidor"
    };
  }
  for (const [id, prov] of Object.entries(PROVEEDORES)) {
    if (!prov.envFallback) continue;
    const llave = process.env[prov.envFallback];
    if (llave) {
      return { proveedor: id, baseUrl: prov.baseUrl, modelo: prov.modeloDefault, razonamientoBajo: !!prov.razonamientoBajo, llave, origen: "servidor" };
    }
  }
  return null;
}

export async function chatLlm(cfg, mensajes, { timeoutMs = 30000, maxTokens = 900 } = {}) {
  const controlador = new AbortController();
  const t = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const cuerpo = {
      model: cfg.modelo,
      messages: mensajes,
      temperature: 0.2,
      max_tokens: maxTokens
    };
    if (cfg.razonamientoBajo) cuerpo.reasoning = { effort: "low" };
    const r = await fetch(cfg.baseUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      signal: controlador.signal,
      headers: {
        Authorization: "Bearer " + cfg.llave,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://appcontrol-three.vercel.app",
        "X-Title": "AppControl"
      },
      body: JSON.stringify(cuerpo)
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: "HTTP " + r.status + ": " + txt.slice(0, 300) };
    }
    const data = await r.json();
    const texto = data?.choices?.[0]?.message?.content ?? "";
    return { ok: true, texto };
  } catch (e) {
    return { ok: false, error: e?.name === "AbortError" ? "Timeout del proveedor" : String(e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}

export function promptSistema({ proyecto, torres, nivelesResumen, actividades, capitulos, contratistas }) {
  const estados = "Sin empezar | En replanteo | En curso | En remate | Listo";
  return [
    "Eres el asistente de registro de avance de obra de AppControl.",
    "Proyecto actual: " + proyecto + ". Torres: " + torres.join(", ") + ".",
    "Niveles por torre: " + nivelesResumen + ".",
    "Actividades (codigo | nombre | capitulo | ponderacion | aplicacion):",
    actividades.map((a) => `- ${a.CODIGO} | ${a.NOMBRE} | ${a.CAPITULO} | ${a.PONDERACION} | ${a.APLICACION || "UNIDAD"}`).join("\n"),
    "Capitulos (codigo | nombre | ponderacion): " + capitulos.map((c) => `${c.CODIGO} ${c.NOMBRE} (${c.PONDERACION})`).join("; "),
    "Contratistas: " + (contratistas.map((c) => c.CODIGO + " " + c.NOMBRE).join("; ") || "ninguno"),
    "",
    "El residente te habla informalmente y puede usar sinonimos (muros = mamposteria, piso = losa, pintar = pintura).",
    "Si la actividad es aplicacion UNIDAD y el usuario dice un nivel completo, usa unidad null para que se aplique a todas las unidades del nivel.",
    "Si la actividad es aplicacion NIVEL, unidad siempre null.",
    "Reglas:",
    "- Estados validos exactos: " + estados + ". O pct numerico 0-100.",
    "- Si falta la torre, los niveles o hay varias actividades posibles, NO devuelvas acciones: haz una pregunta breve en mensaje.",
    "- Confirma siempre lo que registraste en mensaje.",
    "",
    "Responde EXCLUSIVAMENTE con JSON valido, sin markdown:",
    '{"mensaje": string, "acciones": [{"tipo":"avance", "actividad": codigo, "torre": torre, "niveles":[strings], "unidad": null, "estado": estado|null, "pct": numero|null}]}'
  ].join("\n");
}

export function parseRespuestaLlm(texto) {
  const limpio = String(texto || "").replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(limpio); } catch {}
  const ini = limpio.indexOf("{"), fin = limpio.lastIndexOf("}");
  if (ini >= 0 && fin > ini) {
    try { return JSON.parse(limpio.slice(ini, fin + 1)); } catch {}
  }
  return { mensaje: String(texto || "").slice(0, 500), acciones: [] };
}
