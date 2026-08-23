import { readRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS } from "./_lib/model.js";
import { verifyPassword, hashPassword, createToken } from "./_lib/auth.js";

export default async function handler(req, res) {
  try {
    const {
      empresa = "",
      proyecto = "",
      email = "",
      currentPassword = "",
      newPassword = ""
    } = req.body || {};

    if (!empresa || !proyecto || !email || !currentPassword || !newPassword) {
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
      return res.status(404).json({ success: false, codigo: "USUARIO_NO_EXISTE" });
    }

    const u = usuarios[idx];

    if (!verifyPassword(currentPassword, u.PASSWORD_HASH)) {
      return res.status(401).json({ success: false, codigo: "PASSWORD_ACTUAL_INVALIDA" });
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

    const token = createToken({
      email: u.EMAIL,
      empresa,
      proyecto,
      rol: u.ROL,
      scope: "web"
    }, 8 * 3600);

    res.setHeader(
      "Set-Cookie",
      `appcontrol_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800; Secure`
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}