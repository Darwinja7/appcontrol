import { readRows } from "./_lib/sheets.js";
import { requireUser } from "./_lib/auth.js";
export default async function handler(req, res) {
  const u = await requireUser(req);
  if (!u) return res.status(401).json({ error: "UNAUTHORIZED" });
  const [proyectos, capitulos, actividades, unidades, contratistas, configuracion, registro] = await Promise.all([
    readRows("PROYECTOS"), readRows("CAPITULOS"), readRows("ACTIVIDADES"),
    readRows("UNIDADES"), readRows("CONTRATISTAS"), readRows("CONFIGURACION"), readRows("REGISTRO"),
  ]);
  res.json({ proyectos, capitulos, actividades, unidades, contratistas, configuracion, registro,
    me: { rol: u.ROL, proyecto: u.PROYECTO, torre: u.TORRE, nombre: u.NOMBRE } });
}
