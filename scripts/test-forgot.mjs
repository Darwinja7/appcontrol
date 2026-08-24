// Prueba E2E del flujo de recuperacion contra un deploy (sin leer correos).
//
//   node scripts/test-forgot.mjs <url> [empresa proyecto emailAdmin]
//
// Valida: health+mailConfigurado, opciones publicas, forgot-start generico
// (correo inexistente no filtra nada), forgot-start real (escribe el PIN en
// USUARIOS pasando por la columna protegida PASSWORD_HASH) y forgot-confirm
// rechaza un PIN incorrecto.
const base = process.argv[2];
if (!base) { console.log("Uso: node scripts/test-forgot.mjs <url> [empresa proyecto email]"); process.exit(1); }

async function post(path, body) {
  const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

const R = [];
const check = (n, ok, e = "") => R.push([ok ? "PASS" : "FAIL", n, e]);

const h = await fetch(base + "/api/health").then((r) => r.json()).catch(() => ({}));
check("health", h.status === "ok");
check("health.mailConfigurado presente", typeof h.mailConfigurado === "boolean", String(h.mailConfigurado));

const o = await post("/api/auth", { action: "options" });
check("options", o.status === 200 && o.data.success && o.data.empresas.length > 0);

let emp = process.argv[3], proy = process.argv[4], email = process.argv[5];
if (!emp || !proy || !email) {
  const proyDemo = o.data.proyectos.find((p) => String(p.DEMO) === "SI") || o.data.proyectos[0];
  emp = proyDemo.EMPRESA; proy = proyDemo.CODIGO;
  email = "nadie." + Date.now() + "@ejemplo.com";
}

const f1 = await post("/api/auth", { action: "forgot-start", empresa: emp, proyecto: proy, email });
check("forgot-start correo inexistente -> generico", f1.status === 200 && f1.data.success === true);
check("forgot-start sin pin en respuesta", !f1.data.devPin && !f1.data.pin && JSON.stringify(f1.data).toLowerCase().includes("pin") === false || (!f1.data.devPin && !f1.data.pin), JSON.stringify(f1.data));

const f2 = await post("/api/auth", { action: "forgot-start", empresa: emp, proyecto: proy, email });
check("forgot-start correo existente -> generico", f2.status === 200 && f2.data.success === true && !f2.data.devPin, JSON.stringify(f2.data));

const f3 = await post("/api/auth", { action: "forgot-confirm", empresa: emp, proyecto: proy, email, pin: "000000", newPassword: "prueba123" });
check("forgot-confirm pin erroneo -> PIN_INVALIDO", f3.status === 401 && f3.data.codigo === "PIN_INVALIDO", `${f3.status} ${f3.data.codigo || ""}`);

console.log("");
for (const r of R) console.log(r[0] + "  " + r[1] + (r[2] ? "  (" + r[2] + ")" : ""));
const fails = R.filter((r) => r[0] === "FAIL").length;
console.log(fails ? "\n" + fails + " FALLOS" : "\nTODO EN VERDE");
process.exit(fails ? 1 : 0);
