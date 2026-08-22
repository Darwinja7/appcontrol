// --- SISTEMA OFFLINE FIRST ---
const DB_KEY = "appcontrol_pending";

function getPending() { return JSON.parse(localStorage.getItem(DB_KEY) || "[]"); }
function savePending(list) { localStorage.setItem(DB_KEY, JSON.stringify(list)); updateOfflineBadge(); }

async function syncPending() {
  const pending = getPending();
  if (!pending.length || !navigator.onLine) return;
  
  const stillPending = [];
  for (const item of pending) {
    try {
      const res = await fetch(item.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: item.body });
      if (!res.ok) throw new Error("Server error");
      // Éxito: se envió, no se guarda de nuevo
    } catch (e) {
      stillPending.push(item); // Fallo: se reintenta luego
    }
  }
  savePending(stillPending);
}

function updateOfflineBadge() {
  const badge = document.getElementById("offline-badge");
  if (!badge) return;
  const count = getPending().length;
  if (!navigator.onLine) {
    badge.style.display = "block";
    badge.textContent = "️ SIN SEÑAL - MODO OFFLINE";
    badge.style.background = "#E5695E";
  } else if (count > 0) {
    badge.style.display = "block";
    badge.textContent = `🔄 Sincronizando ${count} registros...`;
    badge.style.background = "#FFB020";
    syncPending();
  } else {
    badge.style.display = "none";
  }
}

window.addEventListener("online", updateOfflineBadge);
window.addEventListener("offline", updateOfflineBadge);
setInterval(syncPending, 10000); // Intentar sincronizar cada 10s

// --- API WRAPPER ---
async function api(path, opts = {}) {
  const isWrite = opts.method === "POST";
  
  // Si es escritura y no hay red -> Guardar en cola
  if (isWrite && !navigator.onLine) {
    const pending = getPending();
    pending.push({ url: path, body: opts.body });
    savePending(pending);
    return { success: true, offline: true };
  }

  try {
    const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
    if (r.status === 401) { location.href = "/login.html"; throw 0; }
    
    // Si es escritura y hubo éxito, intentar sincronizar pendientes antiguos
    if (isWrite && r.ok) syncPending();
    
    return r.json();
  } catch (e) {
    // Si falla la red en una escritura, guardar en cola
    if (isWrite) {
      const pending = getPending();
      pending.push({ url: path, body: opts.body });
      savePending(pending);
      return { success: true, offline: true };
    }
    throw e;
  }
}

// --- UTILIDADES UI ---
const $ = (s) => document.querySelector(s);
const ESTADOS = ["Sin empezar", "En replanteo", "En curso", "En remate", "Listo"];
const VALOR = { "Sin empezar": 0, "En replanteo": 0.1, "En curso": 0.5, "En remate": 0.8, "Listo": 1 };

function requireLogin(cb) {
  api("/api/me").then(d => { if (!d || !d.success) location.href = "/login.html"; else cb(d.usuario); }).catch(() => location.href = "/login.html");
}

function initApp() {
  updateOfflineBadge();
  // Inyectar badge si no existe
  if (!document.getElementById("offline-badge")) {
    const b = document.createElement("div");
    b.id = "offline-badge";
    b.style.cssText = "position:fixed;top:0;left:0;width:100%;text-align:center;padding:6px;color:#000;font-weight:bold;z-index:9999;display:none;font-size:12px;";
    document.body.appendChild(b);
  }
}
