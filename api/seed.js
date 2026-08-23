import { readRows, replaceRows } from "./_lib/sheets.js";
import { HEADERS } from "./_lib/model.js";
import { hashPassword, sha256Hex } from "./_lib/auth.js";

export default async function handler(req, res) {
  try {
    const out = {};
    const P = "P001";
    const T = "T1";
    const EMP = "E001";
    const SIN = "Sin asignar";

    const put = async (name, rows) => {
      const cur = await readRows(name);
      if (!cur.length) {
        await replaceRows(name, HEADERS[name], rows);
        out[name] = rows.length;
      } else {
        out[name] = "ya existe";
      }
    };

    await put("EMPRESAS", [
      ["E001","URBANIZADORA JIMENEZ","SI"]
    ]);

    await put("PROYECTOS", [
      ["E001","P001","SALGUERO ELITE 2","SI","SI"]
    ]);

    const pass = hashPassword("123456");

    await put("USUARIOS", [
      [
        "U001",
        "Director Urbanizadora Jimenez",
        "director@urbanizadorajimenez.com",
        "ADMIN",
        EMP,
        P,
        "*",
        "director@urbanizadorajimenez.com",
        pass,
        "SI",
        sha256Hex("AC-DEMO-ADMIN"),
        "",
        "",
        "SI"
      ],
      [
        "U002",
        "Residente Demo",
        "residente@urbanizadorajimenez.com",
        "RESIDENTE",
        EMP,
        P,
        T,
        "residente@urbanizadorajimenez.com",
        pass,
        "SI",
        sha256Hex("AC-DEMO-RESIDENTE"),
        "",
        "",
        "SI"
      ],
      [
        "U003",
        "Gerencia Demo",
        "gerencia@urbanizadorajimenez.com",
        "VISUALIZADOR",
        EMP,
        P,
        "*",
        "gerencia@urbanizadorajimenez.com",
        pass,
        "SI",
        sha256Hex("AC-DEMO-GERENCIA"),
        "",
        "",
        "SI"
      ]
    ]);

    await put("CAPITULOS", [
      ["CAP01","ESTRUCTURA",P,"0.33","SI"],
      ["CAP02","MAMPOSTERIA",P,"0.12","SI"],
      ["CAP03","ACABADOS",P,"0.25","SI"],
      ["CAP04","CARPINTERIA MADERA",P,"0.10","SI"],
      ["CAP05","ASEO",P,"0.05","SI"],
      ["CAP06","PINTURA",P,"0.15","SI"]
    ]);

    await put("ACTIVIDADES", [
      ["ACT001","Vaciado de losa","CAP01","0.4","SI"],
      ["ACT002","Columnas","CAP01","0.3","SI"],
      ["ACT003","Escaleras","CAP01","0.3","SI"],
      ["ACT010","Mamposteria fachada","CAP02","0.5","SI"],
      ["ACT011","Mamposteria interna","CAP02","0.5","SI"],
      ["ACT020","Enchape","CAP03","0.4","SI"],
      ["ACT021","Panete","CAP03","0.35","SI"],
      ["ACT022","Ceramica banos","CAP03","0.25","SI"],
      ["ACT030","Puertas","CAP04","0.3","SI"],
      ["ACT031","Cocinas","CAP04","0.4","SI"],
      ["ACT032","Closet","CAP04","0.3","SI"],
      ["ACT040","Pintura fachada","CAP06","0.6","SI"],
      ["ACT041","Pintura interna","CAP06","0.4","SI"],
      ["ACT090","Aseo zonas comunes","CAP05","1","SI"]
    ]);

    await put("CONTRATISTAS", [
      ["CT01","ABC CONSTRUCCIONES","SI"],
      ["CT02","VIDRIOS Y MAS","SI"],
      ["CT03","PINTURAS DEL CARIBE","SI"]
    ]);

    await put("NIVELES", [
      [P,T,"1","SI"],
      [P,T,"4","NO"],
      [P,T,"5","NO"],
      [P,T,"6","NO"],
      [P,T,"22","SI"],
      [P,T,"23","SI"]
    ]);

    await put("UNIDADES", [
      [P,T,"1","LOBBY","LOBBY","SI"],
      [P,T,"4","401","APARTAMENTO","SI"],
      [P,T,"4","402","APARTAMENTO","SI"],
      [P,T,"4","403","APARTAMENTO","SI"],
      [P,T,"4","404","APARTAMENTO","SI"],
      [P,T,"5","501","APARTAMENTO","SI"],
      [P,T,"5","502","APARTAMENTO","SI"],
      [P,T,"6","601","APARTAMENTO","SI"],
      [P,T,"22","2201","APARTAMENTO","SI"],
      [P,T,"22","2202","APARTAMENTO","SI"],
      [P,T,"22","SAUNA","SAUNA","SI"],
      [P,T,"22","TURCO","TURCO","SI"],
      [P,T,"23","AMENIDADES","AMENIDADES","SI"]
    ]);

    const cap = {
      ACT010: "CAP02",
      ACT020: "CAP03",
      ACT030: "CAP04",
      ACT031: "CAP04",
      ACT040: "CAP06",
      ACT090: "CAP05"
    };

    const cfg = (act, nivel, unidad, aplica, activo, ct, obs = "") => [
      P,T,act,cap[act],String(nivel),unidad,aplica,activo,ct,
      aplica === "SI" && activo === "SI" && ct !== SIN ? "SI" : "NO",
      "2026-08-01","",obs
    ];

    await put("CONFIGURACION", [
      cfg("ACT010",4,"401","SI","SI","CT01"),
      cfg("ACT010",4,"402","SI","SI",SIN,"Falta asignar contratista"),
      cfg("ACT010",4,"403","SI","NO","CT01","Pausado"),
      cfg("ACT010",4,"404","NO","SI","CT01","No aplica"),
      cfg("ACT010",5,"501","SI","SI","CT01"),
      cfg("ACT010",5,"502","SI","SI","CT01"),
      cfg("ACT020",4,"401","SI","SI","CT02"),
      cfg("ACT020",4,"402","SI","SI","CT02"),
      cfg("ACT020",22,"SAUNA","SI","SI","CT02"),
      cfg("ACT020",22,"TURCO","SI","SI",SIN,"Zona especial sin contratista"),
      cfg("ACT030",6,"601","SI","SI","CT02"),
      cfg("ACT031",4,"401","SI","SI","CT02"),
      cfg("ACT040",4,"401","SI","SI","CT03"),
      cfg("ACT090",1,"LOBBY","SI","SI","CT03"),
      cfg("ACT090",23,"AMENIDADES","SI","SI","CT03")
    ]);

    await put("REGISTRO", [
      ["2026-08-18T14:05:00.000Z",P,T,"CAP02","ACT010","4","401","Listo","1","CT01","residente@urbanizadorajimenez.com"],
      ["2026-08-18T14:06:00.000Z",P,T,"CAP02","ACT010","5","501","En remate","0.8","CT01","residente@urbanizadorajimenez.com"],
      ["2026-08-19T09:12:00.000Z",P,T,"CAP02","ACT010","5","502","En curso","0.5","CT01","residente@urbanizadorajimenez.com"],
      ["2026-08-19T09:15:00.000Z",P,T,"CAP03","ACT020","4","401","Listo","1","CT02","residente@urbanizadorajimenez.com"],
      ["2026-08-20T10:30:00.000Z",P,T,"CAP03","ACT020","4","402","En curso","0.5","CT02","residente@urbanizadorajimenez.com"]
    ]);

    res.json({ success: true, seed: out });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}