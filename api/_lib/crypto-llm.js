import crypto from "crypto";

// Cifrado AES-256-GCM para llaves de LLM en la hoja LLM_CONFIG.
// La clave se deriva de SESSION_SECRET (HKDF); rotar SESSION_SECRET
// invalida las llaves guardadas y hay que reingresarlas.
function claveDerivada() {
  const secreto = process.env.SESSION_SECRET || "";
  if (!secreto) throw new Error("SESSION_SECRET no definida");
  return crypto.hkdfSync("sha256", Buffer.from(secreto), Buffer.from("appcontrol-llm"), Buffer.from("llm-api-key"), 32);
}

export function cifrarLlave(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", Buffer.from(claveDerivada()), iv);
  const ct = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return "v1." + iv.toString("base64") + "." + tag.toString("base64") + "." + ct.toString("base64");
}

export function descifrarLlave(payload) {
  const [v, ivB, tagB, ctB] = String(payload).split(".");
  if (v !== "v1" || !ivB || !tagB || !ctB) throw new Error("formato invalido");
  const d = crypto.createDecipheriv("aes-256-gcm", Buffer.from(claveDerivada()), Buffer.from(ivB, "base64"));
  d.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([d.update(Buffer.from(ctB, "base64")), d.final()]).toString("utf8");
}

export function mascararLlave(texto) {
  const t = String(texto || "");
  if (!t) return "";
  if (t.length <= 8) return "*".repeat(t.length);
  return t.slice(0, 5) + "...".concat(t.slice(-4));
}
