const BASE = process.env.APPCONTROL_BASE_URL || "http://localhost:3000";

let cache = null;

async function pedirSesion() {
  const res = await fetch(`${BASE}/api/hermes/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: process.env.HERMES_AGENT_ID,
      agent_secret: process.env.HERMES_AGENT_SECRET,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.success) {
    throw new Error(`SESSION_ERROR_${data.codigo || res.status}`);
  }

  cache = {
    token: data.session_token,
    expiresAtMs: new Date(data.expires_at).getTime(),
  };

  return cache.token;
}

async function getToken(forzar = false) {
  const vencido = !cache || Date.now() > cache.expiresAtMs - 60000;
  if (forzar || vencido) {
    return pedirSesion();
  }
  return cache.token;
}

export async function enviarCaptura({ sender, payload }, idempotencyKey) {
  const cuerpo = {
    source: "TELEGRAM",
    sender: String(sender),
    timestamp: new Date().toISOString(),
    payload,
  };

  const llamar = async (token) =>
    fetch(`${BASE}/api/captura/hermes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(cuerpo),
    });

  let token = await getToken();
  let res = await llamar(token);

  if (res.status === 401) {
    token = await getToken(true);
    res = await llamar(token);
  }

  return res.json();
}
