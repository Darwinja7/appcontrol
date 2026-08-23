const assert = (cond, msg) => { if (!cond) { console.log("FALLO:", msg); process.exitCode = 1; } };
process.env.SESSION_SECRET = "secreto-de-prueba-para-crypto-llm-32chars!!";

const { cifrarLlave, descifrarLlave, mascararLlave } = await import("../api/_lib/crypto-llm.js");
const { parseRespuestaLlm, promptSistema } = await import("../api/_lib/llm.js");

const original = "sk-or-v1-abc123xyz";
const cifrada = cifrarLlave(original);
assert(cifrada !== original && cifrada.startsWith("v1."), "formato cifrado v1");
assert(descifrarLlave(cifrada) === original, "roundtrip descifra igual");
let falloDescifrado = false;
try { descifrarLlave("v1.aGVsbG8=.aGVsbG8=.aGVsbG8="); } catch { falloDescifrado = true; }
assert(falloDescifrado, "tag invalido rechazado por GCM");
assert(mascararLlave(original) === "sk-or...xyz" || mascararLlave(original).includes("..."), "mascara no revela la llave");

const jsonPuro = '{"mensaje":"Listo","acciones":[{"tipo":"avance","actividad":"ACT010","torre":"T2","niveles":["4","5"],"unidad":null,"estado":"Listo","pct":null}]}';
const p1 = parseRespuestaLlm(jsonPuro);
assert(p1.acciones.length === 1 && p1.acciones[0].actividad === "ACT010", "parse JSON puro");

const conCerca = 'Claro!\n```json\n{"mensaje":"Hecho","acciones":[{"tipo":"avance","actividad":"ACT011","torre":"T2","niveles":["6"],"unidad":null,"pct":65,"estado":null}]}\n```';
const p2 = parseRespuestaLlm(conCerca);
assert(p2.acciones[0].pct === 65, "parse con cercado markdown y pct");

const basura = parseRespuestaLlm("No puedo procesarlo");
assert(basura.mensaje === "No puedo procesarlo" && Array.isArray(basura.acciones), "texto libre degrada sin romper");

const ps = promptSistema({ proyecto: "P000 (E001)", torres: ["T1", "T2"], nivelesResumen: "T2: 1,2,3", actividades: [{ CODIGO: "ACT004", NOMBRE: "Movimiento de tierras", CAPITULO: "CAP01", PONDERACION: "0.2", APLICACION: "NIVEL" }], capitulos: [{ CODIGO: "CAP01", NOMBRE: "ESTRUCTURA", PONDERACION: "0.33" }], contratistas: [] });
assert(ps.includes("openrouter") === false && ps.includes("Responde EXCLUSIVAMENTE con JSON"), "prompt exige JSON y no filtra detalles del proveedor");

console.log(process.exitCode ? "TESTS LLM FALLARON" : "TESTS LLM OK — cifrado GCM, parse robusto y prompt seguro");
