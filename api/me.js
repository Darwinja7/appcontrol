import { requireUser } from "./_lib/auth.js";
export default async function handler(req, res) {
  const u = await requireUser(req);
  if (!u) return res.status(401).json({ success: false });
  res.json({ success: true, usuario: { id: u.ID_USUARIO, nombre: u.NOMBRE, rol: u.ROL, proyecto: u.PROYECTO, torre: u.TORRE } });
}
