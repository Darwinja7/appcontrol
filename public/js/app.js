/* =====================================================
   AppControl Core - v1.3.0
   offline-first · toasts · sesión · helpers UI
   ===================================================== */
const APP_VERSION = "1.3.0";
const DB_KEY = "appcontrol_pending";
const $ = (s) => document.querySelector(s);
const ESTADOS = ["Sin empezar", "En replanteo", "En curso", "En remate", "Listo"];
const VALOR = { "Sin empezar": 0, "En replanteo": 0.1, "En curso": 0.5, "En remate": 0.8, "Listo": 1 };

/* ---------- Toasts (reemplazan alert) ---------- */
(function () {
  if (document.getElementById("toast-root")) return;
  const st = document.createElement("style");
  st.textContent = "#toast-root{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;flex-direction:column;gap:8px;width:min(92vw,420px);pointer-events:none}" +
    ".toast{background:#10151C;border:1px solid #202A36;border-left:4px solid #FFB020;color:#EAF0F6;padding:12px 16px;border-radius:12px;font-size:13.5px;box-shadow:0 16px 40px rgba(0,0,0,.5);animation:tin .25s cubic-bezier(.2,.7,.2,1)}" +
    ".toast.ok{border-left-color:#2FBF71}.toast.err{border-left-color:#E5695E}" +
    "@keyframes tin{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}";
  document.head.appendChild(st);
  const root = document.createElement("div"); root.id = "toast-root"; document.body.appendChild(root);
})();
function toast(msg, type = "info", ms = 3500) {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = ".3s"; setTimeout(() => el.remove(), 300); }, ms);
}
window.alert = (m) => toast(String(m), /error|inválid|selecciona|sin conexión|⚠/i.test(String(m)) ? "err" : "ok");

/* ---------- Cola offline ---------- */
function getPending() { try { return JSON.parse(localStorage.getItem(DB_KEY) || "[]"); } catch { return []; } }
function savePending(l) { localStorage.setItem(DB_KEY, JSON.stringify(l)); updateOfflineBadge(); }
async function syncPending() {
  const pending = getPending();
  if (!pending.length || !navigator.onLine) return;
  const left = []; let sent = 0;
  for (const item of pending) {
    try {
      const r = await fetch(item.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: item.body });
      if (!r.ok) throw 0;
      sent++;
    } catch { left.push(item); }
  }
  savePending(left);
  if (sent) toast("Conexión recuperada: " + sent + " registros sincronizados.", "ok");
}
function updateOfflineBadge() {
  let b = document.getElementById("offline-badge");
  if (!b) { b = document.createElement("div"); b.id = "offline-badge"; b.style.cssText = "position:fixed;top:0;left:0;width:100%;text-align:center;padding:6px;color:#000;font-weight:bold;z-index:9999;display:none;font-size:12px;"; document.body.appendChild(b); }
  const n = getPending().length;
  if (!navigator.onLine) { b.style.display = "block"; b.style.background = "#E5695E"; b.textContent = "SIN SEÑAL - MODO OFFLINE"; }
  else if (n > 0) { b.style.display = "block"; b.style.background = "#FFB020"; b.textContent = "Sincronizando " + n + " registros..."; syncPending(); }
  else b.style.display = "none";
}
window.addEventListener("online", updateOfflineBadge);
window.addEventListener("offline", updateOfflineBadge);
setInterval(syncPending, 10000);

/* ---------- API ---------- */
async function api(path, opts = {}) {
  const isWrite = opts.method === "POST";
  if (isWrite && !navigator.onLine) {
    const p = getPending(); p.push({ url: path, body: opts.body }); savePending(p);
    toast("Sin conexión: guardado en este equipo.", "err");
    return { success: true, offline: true };
  }
  try {
    const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
    if (r.status === 401) { top.location.href = "/login.html"; throw 0; }
    if (isWrite && r.ok) syncPending();
    return await r.json();
  } catch (e) {
    if (isWrite) {
      const p = getPending(); p.push({ url: path, body: opts.body }); savePending(p);
      toast("Sin conexión: guardado en este equipo.", "err");
      return { success: true, offline: true };
    }
    toast("Error de conexión con el servidor.", "err");
    throw e;
  }
}

/* ---------- Helpers ---------- */
function fill(el, items, map) { el.innerHTML = '<option value="">Seleccione...</option>' + items.map((i) => `<option value="${map(i).v}">${map(i).t}</option>`).join(""); }
function requireLogin(cb) { api("/api/me").then((d) => { if (!d || !d.success) { top.location.href = "/login.html"; return; } cb(d.usuario); }).catch(() => { top.location.href = "/login.html"; }); }
function setLoading(btn, on) { if (!btn) return; if (on) { btn.dataset.label = btn.textContent; btn.textContent = "Procesando…"; btn.disabled = true; } else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; } }
function initApp() { updateOfflineBadge(); }

/* ---------- Sello de versión + errores globales ---------- */
(function () {
  const d = document.createElement("div");
  d.textContent = "AppControl v" + APP_VERSION;
  d.style.cssText = "position:fixed;bottom:6px;right:10px;font-size:10px;color:#5b6b7c;z-index:5;letter-spacing:.08em";
  document.body.appendChild(d);
  console.info("%cAppControl%c v" + APP_VERSION, "font-weight:700;color:#FFB020", "color:inherit");
})();
window.addEventListener("unhandledrejection", () => toast("Algo salió mal. Revisa los datos e intenta de nuevo.", "err"));