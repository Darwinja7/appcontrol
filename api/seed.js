import { readRows, replaceRows } from "./_lib/sheets.js";
import { requireUser } from "./_lib/auth.js";
import { HEADERS } from "./_lib/model.js";
export default async function handler(req, res) {
  try {
    const existentes = await readRows("USUARIOS");
    if (existentes.length) {
      const u = await requireUser(req);
      if (!u || String(u.ROL).toUpperCase() !== "ADMIN") return res.status(403).json({ success: false });
    }
    const out = {};
    const put = async (name, rows) => { const cur = await readRows(name); if (!cur.length) { await replaceRows(name, HEADERS[name], rows); out[name] = rows.length; } else out[name] = "ya existe"; };
    await put("USUARIOS", [["U001","Darwin","ADMIN","P001","*","999000111","03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4","SI"]]);
    await put("PROYECTOS", [["P001","SALGUERO ELITE 2","SI"]]);
    await put("CAPITULOS", [["CAP01","ESTRUCTURA","P001","0.33","SI"],["CAP02","MAMPOSTERIA","P001","0.12","SI"],["CAP03","ACABADOS","P001","0.25","SI"],["CAP04","CARPINTERIA MADERA","P001","0.10","SI"],["CAP05","ASEO","P001","0.05","SI"],["CAP06","PINTURA","P001","0.15","SI"]]);
    await put("ACTIVIDADES", [["ACT001","Vaciado de losa","CAP01","0.4","SI"],["ACT002","Columnas","CAP01","0.3","SI"],["ACT010","Mamposteria fachada","CAP02","0.5","SI"],["ACT020","Enchape","CAP03","0.4","SI"],["ACT030","Puertas","CAP04","0.3","SI"],["ACT031","Cocinas","CAP04","0.4","SI"],["ACT090","Aseo zonas comunes","CAP05","1","SI"]]);
    await put("CONTRATISTAS", [["CT01","ABC CONSTRUCCIONES","SI"],["CT02","VIDRIOS Y MAS","SI"]]);
    const uni = [];
    for (const n of [4, 5, 6]) for (let a = 1; a <= 3; a++) uni.push(["P001","T1",String(n), n + "0" + a,"APARTAMENTO","SI"]);
    uni.push(["P001","T1","22","2201","APARTAMENTO","SI"],["P001","T1","22","SAUNA","SAUNA","SI"],["P001","T1","1","LOBBY","LOBBY","SI"],["P001","T1","23","AMENIDADES","AMENIDADES","SI"]);
    await put("UNIDADES", uni);
    await put("CONFIGURACION", [
      ["P001","T1","ACT010","CAP02","4","401","SI","SI","CT01","SI","","",""],
      ["P001","T1","ACT010","CAP02","4","402","SI","SI","Sin asignar","NO","","",""],
      ["P001","T1","ACT020","CAP03","4","401","SI","SI","CT02","SI","","",""],
      ["P001","T1","ACT020","CAP03","5","501","SI","SI","CT02","SI","","",""],
    ]);
    res.json({ success: true, seed: out });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}