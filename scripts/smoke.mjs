const [base, email, password] = process.argv.slice(2);
if (!base || !email || !password) { console.log("Uso: node scripts/smoke.mjs <url> <email> <password>"); process.exit(1); }
let cookie = "";
async function req(path, opts = {}) {
  const r = await fetch(base + path, { ...opts, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(opts.headers || {}) } });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  return r;
}
const R = [];
const check = (n, ok, e="") => R.push([ok?"PASS":"FAIL", n, e]);

const health = await req("/api/health"); check("health", health.ok);
const opts = await req("/api/auth", { method:"POST", body: JSON.stringify({ action:"options" }) });
const od = await opts.json().catch(()=>({}));
check("options", opts.ok && od.empresas && od.empresas.length > 0, "empresas=" + (od.empresas||[]).length + " proyectos=" + (od.proyectos||[]).length);

const proy = (od.proyectos || []).find(p => String(p.DEMO) === "SI") || (od.proyectos || [])[0];
const emp = (od.empresas || []).find(e => e.CODIGO === (proy && proy.EMPRESA));

const login = await req("/api/auth", { method:"POST", body: JSON.stringify({ action:"login", empresa: emp.CODIGO, proyecto: proy.CODIGO, email, password }) });
const ld = await login.json().catch(()=>({}));
check("login", login.ok && ld.success, ld.codigo || "");

const me = await req("/api/auth", { method:"POST", body: JSON.stringify({ action:"me" }) });
const md = await me.json().catch(()=>({}));
check("me + rol", me.ok && md.success, md.usuario ? md.usuario.rol : "");

const data = await req("/api/data", { method:"POST", body: JSON.stringify({ action:"catalogos" }) });
const dd = await data.json().catch(()=>({}));
check("catalogos", data.ok && Array.isArray(dd.configuracion), "cfg=" + (dd.configuracion||[]).length + " reg=" + (dd.registro||[]).length);
const hab = (dd.configuracion || []).filter(r => r.APLICA === "SI" && r.ACTIVO === "SI" && r.CONTRATISTA !== "Sin asignar");
check("regla de oro", hab.length > 0, String(hab.length));

console.log("");
for (const r of R) console.log(r[0] + "  " + r[1] + (r[2] ? "  (" + r[2] + ")" : ""));
const fails = R.filter(r => r[0] === "FAIL").length;
console.log(fails ? "\n" + fails + " FALLOS" : "\nTODO EN VERDE");
process.exit(fails ? 1 : 0);