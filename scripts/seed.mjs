// Seed local de AppControl — reemplaza al antiguo endpoint /api/seed (que era
// público y sembraba usuarios con contraseña conocida). Corre SOLO en tu
// máquina contra la hoja directamente:
//
//   PowerShell:
//     $env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content ruta\service-account.json -Raw)
//     $env:SPREADSHEET_ID = "<tu-id>"
//     node scripts/seed.mjs
//
// Solo crea hojas vacías; nunca sobrescribe datos existentes ("ya existe").
import { readRows, replaceRows } from "../api/_lib/sheets.js";
import { HEADERS } from "../api/_lib/model.js";
import { hashPassword, sha256Hex } from "../api/_lib/auth.js";

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.SPREADSHEET_ID) {
  console.error("Faltan GOOGLE_SERVICE_ACCOUNT_JSON o SPREADSHEET_ID. Ver encabezado de este script.");
  process.exit(1);
}

const out = {};
const DEMO = "P000";   // SALGUERO ELITE 1 - DEMO
const PROD = "P001";   // SALGUERO ELITE 2 - PRODUCCION
const EMP = "E001";
const TD = "T1";       // torre demo
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

// EMPRESA UNICA
await put("EMPRESAS", [
  ["E001","URBANIZADORA JIMENEZ","SI"]
]);

// DOS PROYECTOS: uno DEMO, uno de PRODUCCION
await put("PROYECTOS", [
  [EMP, DEMO, "SALGUERO ELITE 1", "SI", "SI"],
  [EMP, PROD, "SALGUERO ELITE 2", "SI", "NO"]
]);

const pass = hashPassword("123456");

// USUARIOS: ADMIN global + usuarios por proyecto
await put("USUARIOS", [
  ["U001","Director Urbanizadora Jimenez","director@urbanizadorajimenez.com","ADMIN",EMP,PROD,"*","director@urbanizadorajimenez.com",pass,"SI",sha256Hex("AC-DIR-ELITE2"),"","","SI"],
  ["U002","Director DEMO","director@urbanizadorajimenez.com","ADMIN",EMP,DEMO,"*","director@urbanizadorajimenez.com",pass,"NO",sha256Hex("AC-DIR-DEMO"),"","","SI"],
  ["U003","Residente DEMO","residente@urbanizadorajimenez.com","RESIDENTE",EMP,DEMO,TD,"residente@urbanizadorajimenez.com",pass,"SI",sha256Hex("AC-RES-DEMO"),"","","SI"],
  ["U004","Gerencia DEMO","gerencia@urbanizadorajimenez.com","VISUALIZADOR",EMP,DEMO,"*","gerencia@urbanizadorajimenez.com",pass,"SI",sha256Hex("AC-GER-DEMO"),"","","SI"]
]);

// CAPITULOS (mismos para ambos proyectos, ponderaciones suma 1.00)
const caps = [
  ["CAP01","ESTRUCTURA",DEMO,"0.33","SI"],
  ["CAP02","MAMPOSTERIA",DEMO,"0.12","SI"],
  ["CAP03","ACABADOS",DEMO,"0.25","SI"],
  ["CAP04","CARPINTERIA MADERA",DEMO,"0.10","SI"],
  ["CAP05","ASEO",DEMO,"0.05","SI"],
  ["CAP06","PINTURA",DEMO,"0.15","SI"]
];
const caps2 = caps.map((r) => [r[0], r[1], PROD, r[3], r[4]]);
await put("CAPITULOS", [...caps, ...caps2]);

// ACTIVIDADES (mismo catálogo, sin proyecto)
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

// NIVELES: DEMO con 6 niveles, PROD vacio (configurar por Excel)
await put("NIVELES", [
  [DEMO,TD,"1","SI"],
  [DEMO,TD,"4","NO"],
  [DEMO,TD,"5","NO"],
  [DEMO,TD,"6","NO"],
  [DEMO,TD,"22","SI"],
  [DEMO,TD,"23","SI"]
]);

// UNIDADES: DEMO con unidades de ejemplo, PROD vacio
await put("UNIDADES", [
  [DEMO,TD,"1","LOBBY","LOBBY","SI"],
  [DEMO,TD,"4","401","APARTAMENTO","SI"],
  [DEMO,TD,"4","402","APARTAMENTO","SI"],
  [DEMO,TD,"4","403","APARTAMENTO","SI"],
  [DEMO,TD,"4","404","APARTAMENTO","SI"],
  [DEMO,TD,"5","501","APARTAMENTO","SI"],
  [DEMO,TD,"5","502","APARTAMENTO","SI"],
  [DEMO,TD,"6","601","APARTAMENTO","SI"],
  [DEMO,TD,"22","2201","APARTAMENTO","SI"],
  [DEMO,TD,"22","2202","APARTAMENTO","SI"],
  [DEMO,TD,"22","SAUNA","SAUNA","SI"],
  [DEMO,TD,"22","TURCO","TURCO","SI"],
  [DEMO,TD,"23","AMENIDADES","AMENIDADES","SI"]
]);

// CONFIGURACION: solo para DEMO, con los 4 casos de la regla de oro
const capOf = {
  ACT010: "CAP02", ACT020: "CAP03", ACT030: "CAP04",
  ACT031: "CAP04", ACT040: "CAP06", ACT090: "CAP05"
};
const cfg = (act, nivel, unidad, aplica, activo, ct, obs = "") => [
  DEMO,TD,act,capOf[act],String(nivel),unidad,aplica,activo,ct,
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

// REGISTRO: historico solo para DEMO
await put("REGISTRO", [
  ["2026-08-18T14:05:00.000Z",DEMO,TD,"CAP02","ACT010","4","401","Listo","1","CT01","residente@urbanizadorajimenez.com"],
  ["2026-08-18T14:06:00.000Z",DEMO,TD,"CAP02","ACT010","5","501","En remate","0.8","CT01","residente@urbanizadorajimenez.com"],
  ["2026-08-19T09:12:00.000Z",DEMO,TD,"CAP02","ACT010","5","502","En curso","0.5","CT01","residente@urbanizadorajimenez.com"],
  ["2026-08-19T09:15:00.000Z",DEMO,TD,"CAP03","ACT020","4","401","Listo","1","CT02","residente@urbanizadorajimenez.com"],
  ["2026-08-20T10:30:00.000Z",DEMO,TD,"CAP03","ACT020","4","402","En curso","0.5","CT02","residente@urbanizadorajimenez.com"],
  ["2026-08-20T10:32:00.000Z",DEMO,TD,"CAP03","ACT020","22","SAUNA","En replanteo","0.1","CT02","residente@urbanizadorajimenez.com"],
  ["2026-08-21T16:00:00.000Z",DEMO,TD,"CAP05","ACT090","1","LOBBY","Listo","1","CT03","residente@urbanizadorajimenez.com"],
  ["2026-08-22T08:40:00.000Z",DEMO,TD,"CAP04","ACT030","6","601","En replanteo","0.1","CT02","residente@urbanizadorajimenez.com"]
]);

console.log(JSON.stringify({ success: true, seed: out }, null, 2));
