import { readRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS } from "./_lib/model.js";
import { requireUser, hashPassword, sha256Hex, randomCode } from "./_lib/auth.js";

const DEFAULT_PASSWORD = "123456";

export default async function handler(req, res) {
  try {
    const admin = await requireUser(req);

    if (!admin || String(admin.ROL).toUpperCase() !== "ADMIN") {
      return res.status(403).json({ success: false, codigo: "SOLO_ADMIN" });
    }

    const usuarios = await readRows("USUARIOS");

    if (req.method === "GET") {
      const rows = usuarios
        .filter((u) => u.EMPRESA === admin.EMPRESA && u.PROYECTO === admin.PROYECTO)
        .map((u) => ({
          ID_USUARIO: u.ID_USUARIO,
          NOMBRE: u.NOMBRE,
          EMAIL: u.EMAIL,
          ROL: u.ROL,
          EMPRESA: u.EMPRESA,
          PROYECTO: u.PROYECTO,
          TORRE: u.TORRE,
          MUST_CHANGE_PASSWORD: u.MUST_CHANGE_PASSWORD,
          ACTIVO: u.ACTIVO
        }));

      return res.json({ success: true, usuarios: rows });
    }

    if (req.method === "POST") {
      const {
        nombre = "",
        email = "",
        rol = "RESIDENTE",
        torre = "*"
      } = req.body || {};

      if (!nombre || !email) {
        return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
      }

      const exists = usuarios.some((u) =>
        String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
        u.EMPRESA === admin.EMPRESA &&
        u.PROYECTO === admin.PROYECTO
      );

      if (exists) {
        return res.status(409).json({ success: false, codigo: "USUARIO_YA_EXISTE" });
      }

      const id = "U" + String(usuarios.length + 1).padStart(4, "0");
      const accessCode = "AC-" + randomCode(8).toUpperCase();

      usuarios.push({
        ID_USUARIO: id,
        NOMBRE: nombre,
        EMAIL: String(email).toLowerCase(),
        ROL: rol,
        EMPRESA: admin.EMPRESA,
        PROYECTO: admin.PROYECTO,
        TORRE: torre,
        SENDER_ID: String(email).toLowerCase(),
        PASSWORD_HASH: hashPassword(DEFAULT_PASSWORD),
        MUST_CHANGE_PASSWORD: "SI",
        ACCESS_CODE_HASH: sha256Hex(accessCode),
        RESET_PIN_HASH: "",
        RESET_PIN_EXPIRES: "",
        ACTIVO: "SI"
      });

      await replaceRows(
        "USUARIOS",
        HEADERS.USUARIOS,
        usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? ""))
      );

      return res.json({
        success: true,
        usuario: {
          id,
          nombre,
          email,
          rol,
          torre,
          passwordInicial: DEFAULT_PASSWORD,
          accessCode
        }
      });
    }

    if (req.method === "PATCH") {
      const {
        email = "",
        rol,
        torre,
        activo,
        resetPassword
      } = req.body || {};

      const idx = usuarios.findIndex((u) =>
        String(u.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
        u.EMPRESA === admin.EMPRESA &&
        u.PROYECTO === admin.PROYECTO
      );

      if (idx < 0) {
        return res.status(404).json({ success: false, codigo: "USUARIO_NO_EXISTE" });
      }

      if (rol) usuarios[idx].ROL = rol;
      if (torre !== undefined) usuarios[idx].TORRE = torre;
      if (activo) usuarios[idx].ACTIVO = activo;

      if (resetPassword === true) {
        usuarios[idx].PASSWORD_HASH = hashPassword(DEFAULT_PASSWORD);
        usuarios[idx].MUST_CHANGE_PASSWORD = "SI";
      }

      await replaceRows(
        "USUARIOS",
        HEADERS.USUARIOS,
        usuarios.map((r) => HEADERS.USUARIOS.map((h) => r[h] ?? ""))
      );

      return res.json({ success: true });
    }

    res.status(405).json({ success: false, codigo: "METODO_NO_PERMITIDO" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}