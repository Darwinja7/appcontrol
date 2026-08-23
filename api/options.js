import { readRows } from "./_lib/sheets.js";

export default async function handler(req, res) {
  try {
    const [empresas, proyectos] = await Promise.all([
      readRows("EMPRESAS"),
      readRows("PROYECTOS")
    ]);

    res.json({
      success: true,
      empresas: empresas.filter((e) => String(e.ACTIVO).toUpperCase() === "SI"),
      proyectos: proyectos.filter((p) => String(p.ACTIVO).toUpperCase() === "SI")
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}