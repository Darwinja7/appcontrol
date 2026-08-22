const DB_KEY = "appcontrol_pending";
const $ = (s) => document.querySelector(s);
const ESTADOS = ["Sin empezar", "En replanteo", "En curso", "En remate", "Listo"];
const VALOR = { "Sin empezar": 0, "En replanteo": 0.1, "En curso": 0.5, "En remate": 0.8, "Listo": 1 };

function getPending() { try { return JSON.parse(localStorage.getItem(DB_KEY) || "[]"); } catch { return []; } }
function savePending(l) { localStorage.setItem(DB_KEY, JSON.stringify(l)); updateOfflineBadge(); }

async function syncPending() {
  const pending = getPending();
  if (!pending.length || !navigator.onLine) return;
  const left = [];
  for (const item of pending) {
    try {
      const r = await fetch(item.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: item.body });
      if (!r.ok) throw 0;
    } catch { left.push(item); }
  }
  savePending(left);
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

async function api(path, opts = {}) {
  const isWrite = opts.method === "POST";
  if (isWrite && !navigator.onLine) { const p = getPending(); p.push({ url: path, body: opts.body }); savePending(p); return { success: true, offline: true }; }
  try {
    const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
    if (r.status === 401) { top.location.href = "/login.html"; throw 0; }
    if (isWrite && r.ok) syncPending();
    return r.json();
  } catch (e) {
    if (isWrite) { const p = getPending(); p.push({ url: path, body: opts.body }); savePending(p); return { success: true, offline: true }; }
    throw e;
  }
}

function fill(el, items, map) { el.innerHTML = '<option value="">Seleccione...</option>' + items.map((i) => `<option value="${map(i).v}">${map(i).t}</option>`).join(""); }
function requireLogin(cb) { api("/api/me").then((d) => { if (!d || !d.success) { top.location.href = "/login.html"; return; } cb(d.usuario); }).catch(() => { top.location.href = "/login.html"; }); }
function initApp() { updateOfflineBadge(); }