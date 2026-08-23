import { readRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS } from "./_lib/model.js";
import { sha256Hex, safeCompare, hashPassword } from "./_lib/auth.js";

export default async function handler(req, res) {
  try {
    const {
      empresa = "",
      proyecto = "",
      email = "",
      pin = "",
      newPassword = ""
    } = req.body || {};

    if (!empresa || !proyecto || !email || !pin || !newPassword) {
      return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, codigo: "PASSWORD_CORTA" });
    }

    const usuarios = await readRows("USUARIOS");

    const idx = usuarios.findIndex((u) =>
      String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
      u.EMPRESA === empresa &&
      u.PROYECTO === proyecto &&
      String(u.ACTIVO).toUpperCase() === "SI"
    );

    if (idx < 0) {
      return res.status(401).json({ success: false, codigo: "PIN_INVALIDO" });
    }

    const u = usuarios[idx];

    if (!u.RESET_PIN_HASH || !u.RESET_PIN_EXPIRES) {
      return res.status(401).json({ success: false, codigo: "PIN_INVALIDO" });
    }

    if (Date.now() > new Date(u.RESET_PIN_EXPIRES).getTime()) {
      return res.status(401).json({ success: false, codigo: "PIN_EXPIRADO" });
    }

    if (!safeCompare(u.RESET_PIN_HASH, sha256Hex(pin))) {
      return res.status(401).json({ success: false, codigo: "PIN_INVALIDO" });
    }

    usuarios[idx] = {
      ...u,
      PASSWORD_HASH: hashPassword(newPassword),
      MUST_CHANGE_PASSWORD: "NO",
      RESET_PIN_HASH: "",
      RESET_PIN_EXPIRES: ""
    };

    await replaceRows(
      "USUARIOS",
      HEADERS.USUARIOS,
      usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? ""))
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}