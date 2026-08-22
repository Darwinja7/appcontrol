const [base, usuario, pin] = process.argv.slice(2);
if (!base || !usuario || !pin) { console.log("Uso: node scripts/smoke.mjs <https://url.vercel.app> <usuario> <pin>"); process.exit(1); }
let cookie = "";
async function req(path, opts = {}) {
  const r = await fetch(base + path, { ...opts, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(opts.headers || {}) } });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  return r;
}
const R = [];
const check = (name, ok, extra = "") => R.push([ok ? "PASS" : "FAIL", name, extra]);

const health = await req("/api/health"); check("health", health.ok);
const login = await req("/api/login", { method: "POST", body: JSON.stringify({ usuario, pin }) });
const ld = await login.json().catch(() => ({})); check("login admin", login.ok && ld.success);
const me = await req("/api/me"); const md = await me.json().catch(() => ({}));
check("sesion + rol ADMIN", me.ok && md.success && md.usuario.rol === "ADMIN", md.usuario ? md.usuario.rol : "");
const data = await req("/api/data"); const dd = await data.json().catch(() => ({}));
check("catalogos cargan", data.ok && Array.isArray(dd.configuracion), "cfg=" + (dd.configuracion || []).length + " reg=" + (dd.registro || []).length);
const hab = (dd.configuracion || []).filter(r => r.APLICA === "SI" && r.ACTIVO === "SI" && r.CONTRATISTA !== "Sin asignar");
const noHab = (dd.configuracion || []).filter(r => r.CONTRATISTA === "Sin asignar");
check("regla de oro: habilitados", hab.length > 0, String(hab.length));
check("regla de oro: sin contratista fuera", noHab.every(r => !hab.includes(r)), String(noHab.length));

console.log("");
for (const r of R) console.log(r[0] + "  " + r[1] + (r[2] ? "  (" + r[2] + ")" : ""));
const fails = R.filter(r => r[0] === "FAIL").length;
console.log(fails ? "\n" + fails + " FALLOS" : "\nTODO EN VERDE");
process.exit(fails ? 1 : 0);