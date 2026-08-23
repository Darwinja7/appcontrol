// Envio del PIN de recuperacion por correo (Resend). El destinatario es el
// ADMIN del proyecto: quien solicito el cambio solo ve la instruccion de
// comunicarse con el administrador; el PIN jamas viaja en la respuesta HTTP.
export async function sendResetPin({ to, pin, nombreAdmin, solicitante, emailSolicitante, empresa, proyecto }) {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) {
    // Nunca registrar el PIN en logs: solo el hecho de que no se envio.
    console.warn("MAIL_NOT_CONFIGURED: PIN no enviado (revisa RESEND_API_KEY y MAIL_FROM). Destino:", to);
    return { sent: false, reason: "MAIL_NOT_CONFIGURED" };
  }

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#0B0F14;color:#EAF0F6;padding:24px">
      <div style="max-width:520px;margin:auto;background:#10151C;border:1px solid #202A36;border-radius:16px;padding:28px">
        <h2 style="margin:0 0 12px;color:#FFB020">AppControl</h2>
        <p>Hola ${nombreAdmin || ""},</p>
        <p>El usuario <b>${solicitante || ""}</b> (${emailSolicitante || ""}) solicitó recuperar su
        contraseña en <b>${empresa || ""} / ${proyecto || ""}</b>.</p>
        <p>Comparte este PIN con él para que complete el cambio:</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#0B0F14;border:1px solid #202A36;border-radius:12px;padding:18px;text-align:center;color:#FFB020">
          ${pin}
        </div>
        <p style="color:#93A1B0">Este PIN vence en 15 minutos. Si nadie solicitó este cambio, ignora este mensaje.</p>
      </div>
    </div>
  `;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to,
      subject: `PIN de recuperación AppControl — ${empresa}/${proyecto}`,
      html
    })
  });

  if (!r.ok) {
    const txt = await r.text();
    console.error("RESEND_ERROR", txt);
    return { sent: false, reason: txt };
  }

  return { sent: true };
}
