import XLSX from "xlsx";
import path from "path";

const PIN123456 = "placeholder_se_cambia_en_runtime"; // el seed usa hashPassword() de auth.js
const EMP = "E001";
const DEMO = "P000";   // SALGUERO ELITE 1
const PROD = "P001";   // SALGUERO ELITE 2
const SIN = "Sin asignar";

const LEEME = [
  ["MAESTRO APPCONTROL"],
  [""],
  ["CONTIENE DOS PROYECTOS:"],
  ["  P000 - SALGUERO ELITE 1 (DEMO, con datos de ejemplo)"],
  ["  P001 - SALGUERO ELITE 2 (PRODUCCION, vacio para que tu lo llenes)"],
  [""],
  ["Pasos:"],
  ["1) Sube este archivo a Google Drive y abrelo con Google Sheets."],
  ["2) Comparte la hoja con la service account como EDITOR."],
  ["3) Copia el ID de la hoja (entre /d/ y /edit) a Vercel: SPREADSHEET_ID."],
  ["4) En Vercel: Deployments -> Redeploy."],
  ["5) Abre la app y ejecuta en consola: fetch('/api/seed',{method:'POST'}).then(r=>r.json()).then(console.log)"],
  ["6) Entra a /login.html y elige proyecto SALGUERO ELITE 1 para ver la demo."],
  [""],
  ["CREDENCIALES DEMO:"],
  ["  ADMIN: director@urbanizadorajimenez.com / 123456"],
  ["  RESIDENTE: residente@urbanizadorajimenez.com / 123456"],
  ["  GERENCIA: gerencia@urbanizadorajimenez.com / 123456"],
  [""],
  ["REGLA DE ORO: HABILITADO = APLICA SI + ACTIVO SI + CONTRATISTA asignado."],
  ["Solo las filas HABILITADO=SI aparecen en el Grid del residente."],
];

const EMPRESAS = [
  ["CODIGO","NOMBRE","ACTIVO"],
  [EMP,"URBANIZADORA JIMENEZ","SI"]
];

const PROYECTOS = [
  ["EMPRESA","CODIGO","NOMBRE","ACTIVO","DEMO"],
  [EMP,DEMO,"SALGUERO ELITE 1","SI","SI"],
  [EMP,PROD,"SALGUERO ELITE 2","SI","NO"]
];

// USUARIOS: PASSWORD_HASH debe generarse via /api/seed o con el helper.
// Se deja en blanco intencionalmente; el seed lo crea bien.
const USUARIOS = [
  ["ID_USUARIO","NOMBRE","EMAIL","ROL","EMPRESA","PROYECTO","TORRE","SENDER_ID","PASSWORD_HASH","MUST_CHANGE_PASSWORD","ACCESS_CODE_HASH","RESET_PIN_HASH","RESET_PIN_EXPIRES","ACTIVO"]
];

const CAPITULOS = [
  ["CODIGO","NOMBRE","PROYECTO","PONDERACION","ACTIVO"],
  ["CAP01","ESTRUCTURA",DEMO,"0.33","SI"],
  ["CAP02","MAMPOSTERIA",DEMO,"0.12","SI"],
  ["CAP03","ACABADOS",DEMO,"0.25","SI"],
  ["CAP04","CARPINTERIA MADERA",DEMO,"0.10","SI"],
  ["CAP05","ASEO",DEMO,"0.05","SI"],
  ["CAP06","PINTURA",DEMO,"0.15","SI"],
  ["CAP01","ESTRUCTURA",PROD,"0.33","SI"],
  ["CAP02","MAMPOSTERIA",PROD,"0.12","SI"],
  ["CAP03","ACABADOS",PROD,"0.25","SI"],
  ["CAP04","CARPINTERIA MADERA",PROD,"0.10","SI"],
  ["CAP05","ASEO",PROD,"0.05","SI"],
  ["CAP06","PINTURA",PROD,"0.15","SI"]
];

const ACTIVIDADES = [
  ["CODIGO","NOMBRE","CAPITULO","PONDERACION","ACTIVO"],
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
];

const CONTRATISTAS = [
  ["CODIGO","NOMBRE","ACTIVO"],
  ["CT01","ABC CONSTRUCCIONES","SI"],
  ["CT02","VIDRIOS Y MAS","SI"],
  ["CT03","PINTURAS DEL CARIBE","SI"]
];

const TD = "T1";
const NIVELES = [
  ["PROYECTO","TORRE","NIVEL","ESPECIAL"],
  [DEMO,TD,"1","SI"],
  [DEMO,TD,"4","NO"],
  [DEMO,TD,"5","NO"],
  [DEMO,TD,"6","NO"],
  [DEMO,TD,"22","SI"],
  [DEMO,TD,"23","SI"]
];

const UNIDADES = [
  ["PROYECTO","TORRE","NIVEL","UNIDAD","TIPO","ACTIVO"],
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
];

const capOf = {
  ACT010: "CAP02", ACT020: "CAP03", ACT030: "CAP04",
  ACT031: "CAP04", ACT040: "CAP06", ACT090: "CAP05"
};
function cfg(act, nivel, unidad, aplica, activo, ct, obs = "") {
  const hab = aplica === "SI" && activo === "SI" && ct !== SIN ? "SI" : "NO";
  return [DEMO,TD,act,capOf[act],String(nivel),unidad,aplica,activo,ct,hab,"2026-08-01","",obs];
}

const CONFIGURACION = [
  ["PROYECTO","TORRE","ACTIVIDAD","CAPITULO","NIVEL","UNIDAD","APLICA","ACTIVO","CONTRATISTA","HABILITADO","FECHA_ACTIVACION","FECHA_DESACTIVACION","OBSERVACION"],
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
];

const REGISTRO = [
  ["FECHA","PROYECTO","TORRE","CAPITULO","ACTIVIDAD","NIVEL","UNIDAD","ESTADO","VALOR","CONTRATISTA","USUARIO"],
  ["2026-08-18T14:05:00.000Z",DEMO,TD,"CAP02","ACT010","4","401","Listo","1","CT01","residente@urbanizadorajimenez.com"],
  ["2026-08-18T14:06:00.000Z",DEMO,TD,"CAP02","ACT010","5","501","En remate","0.8","CT01","residente@urbanizadorajimenez.com"],
  ["2026-08-19T09:12:00.000Z",DEMO,TD,"CAP02","ACT010","5","502","En curso","0.5","CT01","residente@urbanizadorajimenez.com"],
  ["2026-08-19T09:15:00.000Z",DEMO,TD,"CAP03","ACT020","4","401","Listo","1","CT02","residente@urbanizadorajimenez.com"],
  ["2026-08-20T10:30:00.000Z",DEMO,TD,"CAP03","ACT020","4","402","En curso","0.5","CT02","residente@urbanizadorajimenez.com"],
  ["2026-08-20T10:32:00.000Z",DEMO,TD,"CAP03","ACT020","22","SAUNA","En replanteo","0.1","CT02","residente@urbanizadorajimenez.com"],
  ["2026-08-21T16:00:00.000Z",DEMO,TD,"CAP05","ACT090","1","LOBBY","Listo","1","CT03","residente@urbanizadorajimenez.com"],
  ["2026-08-22T08:40:00.000Z",DEMO,TD,"CAP04","ACT030","6","601","En replanteo","0.1","CT02","residente@urbanizadorajimenez.com"]
];

const wb = XLSX.utils.book_new();
const add = (name, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
add("LEEME", LEEME);
add("EMPRESAS", EMPRESAS);
add("PROYECTOS", PROYECTOS);
add("USUARIOS", USUARIOS);
add("CAPITULOS", CAPITULOS);
add("ACTIVIDADES", ACTIVIDADES);
add("CONTRATISTAS", CONTRATISTAS);
add("NIVELES", NIVELES);
add("UNIDADES", UNIDADES);
add("CONFIGURACION", CONFIGURACION);
add("REGISTRO", REGISTRO);

const out = path.join(process.cwd(), "config", "maestro-appcontrol.xlsx");
XLSX.writeFile(wb, out);
console.log("ARCHIVO GENERADO:", out);
console.log("Pestanas: LEEME, EMPRESAS, PROYECTOS, USUARIOS, CAPITULOS, ACTIVIDADES, CONTRATISTAS, NIVELES, UNIDADES, CONFIGURACION, REGISTRO");
console.log("DEMO=P000 (SALGUERO ELITE 1) / PROD=P001 (SALGUERO ELITE 2)");