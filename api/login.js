import { readRows } from "./_lib/sheets.js";
import { verifyPassword, createToken } from "./_lib/auth.js";

export default async function handler(req, res) {
  try {
    const {
      empresa = "",
      proyecto = "",
      email = "",
      password = ""
    } = req.body || {};

    if (!empresa || !proyecto || !email || !password) {
      return res.status(400).json({ success: false, codigo: "DATOS_INCOMPLETOS" });
    }

    const [empresas, proyectos, usuarios] = await Promise.all([
      readRows("EMPRESAS"),
      readRows("PROYECTOS"),
      readRows("USUARIOS")
    ]);

    const emp = empresas.find((e) =>
      e.CODIGO === empresa &&
      String(e.ACTIVO).toUpperCase() === "SI"
    );

    if (!emp) {
      return res.status(401).json({ success: false, codigo: "EMPRESA_INVALIDA" });
    }

    const proy = proyectos.find((p) =>
      p.EMPRESA === empresa &&
      p.CODIGO === proyecto &&
      String(p.ACTIVO).toUpperCase() === "SI"
    );

    if (!proy) {
      return res.status(401).json({ success: false, codigo: "PROYECTO_INVALIDO" });
    }

    const u = usuarios.find((x) =>
      String(x.EMAIL || "").toLowerCase() === String(email).toLowerCase() &&
      x.EMPRESA === empresa &&
      x.PROYECTO === proyecto
    );

    if (!u || String(u.ACTIVO).toUpperCase() !== "SI") {
      return res.status(401).json({ success: false, codigo: "USUARIO_INACTIVO_O_INVALIDO" });
    }

    if (!verifyPassword(password, u.PASSWORD_HASH)) {
      return res.status(401).json({ success: false, codigo: "CREDENCIALES_INVALIDAS" });
    }

    if (String(u.MUST_CHANGE_PASSWORD).toUpperCase() === "SI") {
      return res.json({
        success: true,
        mustChangePassword: true,
        email: u.EMAIL,
        empresa,
        proyecto
      });
    }

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

    res.json({
      success: true,
      mustChangePassword: false,
      usuario: {
        nombre: u.NOMBRE,
        email: u.EMAIL,
        rol: u.ROL,
        empresa,
        proyecto
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}