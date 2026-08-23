import { readRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS } from "./_lib/model.js";
import { resetPin, sha256Hex } from "./_lib/auth.js";
import { sendResetPin } from "./_lib/mail.js";

export default async function handler(req, res) {
  try {
    const { empresa = "", proyecto = "", email = "" } = req.body || {};

    if (!empresa || !proyecto || !email) {
      return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
    }

    const usuarios = await readRows("USUARIOS");

    const idx = usuarios.findIndex((u) =>
      String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
      u.EMPRESA === empresa &&
      u.PROYECTO === proyecto &&
      String(u.ACTIVO).toUpperCase() === "SI"
    );

    // Respuesta neutra para no revelar usuarios.
    if (idx < 0) {
      return res.json({ success: true });
    }

    const pin = resetPin();
    const expires = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    usuarios[idx] = {
      ...usuarios[idx],
      RESET_PIN_HASH: sha256Hex(pin),
      RESET_PIN_EXPIRES: expires
    };

    await replaceRows(
      "USUARIOS",
      HEADERS.USUARIOS,
      usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? ""))
    );

    const mail = await sendResetPin({
      to: usuarios[idx].EMAIL,
      pin,
      nombre: usuarios[idx].NOMBRE
    });

    res.json({
      success: true,
      sent: mail.sent,
      devPin: process.env.ALLOW_DEV_PIN === "SI" ? pin : undefined
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}