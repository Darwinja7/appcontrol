// Genera config/appcontrol-db-base.xlsx: el archivo de base de datos listo
// para importar a Google Sheets y ejecutar AppControl.
//
//   node scripts/generar-db-base.mjs
//
// Contenido:
//   - Las 10 pestañas exactas que espera api/_lib/model.js (cabeceras idénticas).
//   - Catálogos y proyecto DEMO (P000 - SALGUERO ELITE 1) con datos de ejemplo.
//   - Pestaña LEEME con los pasos para subirlo a Google Drive.
//   - USUARIOS queda VACÍA a propósito: crea tu admin después con
//     node scripts/init-db.mjs --admin=tu@correo.com  (contraseña aleatoria,
//     nunca embebida en archivos).
import XLSX from "xlsx";
import path from "path";

const EMP = "E001";
const DEMO = "P000";   // SALGUERO ELITE 1 - DEMO
const PROD = "P001";   // SALGUERO ELITE 2 - PRODUCCION
const TD = "T1";       // torre demo
const SIN = "Sin asignar";

const LEEME = [
  ["BASE DE DATOS APPCONTROL"],
  [""],
  ["ESTRUCTURA: las 10 pestañas de este archivo coinciden 1:1 con api/_lib/model.js."],
  [""],
  ["PASOS PARA DEJARLA FUNCIONANDO:"],
  ["1) Sube este archivo a Google Drive y ábrelo con Google Sheets"],
  ["   (o en Sheets: Archivo > Importar > Subir > 'Reemplazar hoja de cálculo')."],
  ["2) Compártela como EDITOR con el correo de la cuenta de servicio"],
  ["   (el client_email de service-account.json, termina en .iam.gserviceaccount.com)."],
  ["3) Copia el ID de la URL (entre /d/ y /edit) y configúralo en Vercel:"],
  ["   SPREADSHEET_ID"],
  ["4) Verifica la estructura desde tu máquina:"],
  ["   $env:GOOGLE_SERVICE_ACCOUNT_JSON=(Get-Content ruta\\service-account.json -Raw)"],
  ["   $env:SPREADSHEET_ID=\"<id>\"; node scripts/init-db.mjs"],
  ["5) Crea tu ADMIN (contraseña temporal aleatoria, se muestra una vez):"],
  ["   node scripts/init-db.mjs --admin=tu@correo.com"],
  ["6) En Vercel define también SESSION_SECRET (32+ caracteres)."],
  [""],
  ["PROYECTOS INCLUIDOS:"],
  ["  P000 - SALGUERO ELITE 1 (DEMO: unidades, configuración y registro de ejemplo)"],
  ["  P001 - SALGUERO ELITE 2 (PRODUCCIÓN: catálogos listos, sin datos operativos)"],
  [""],
  ["USUARIOS: pestaña vacía a propósito. Los usuarios se crean desde el módulo"],
  ["Usuarios de la app (ADMIN) o con init-db.mjs --admin. Cada uno recibe una"],
  ["contraseña temporal que debe cambiar en su primer inicio de sesión."],
  [""],
  ["REGLA DE ORO: HABILITADO = APLICA SI + ACTIVO SI + CONTRATISTA asignado."],
  ["Solo las filas HABILITADO=SI aparecen en el Grid del residente."]
];

const EMPRESAS = [[EMP, "URBANIZADORA JIMENEZ", "SI"]];

const PROYECTOS = [
  [EMP, DEMO, "SALGUERO ELITE 1", "SI", "SI"],
  [EMP, PROD, "SALGUERO ELITE 2", "SI", "NO"]
];

// USUARIOS: solo cabeceras — se llena vía init-db.mjs --admin o módulo Usuarios.
const USUARIOS = [];

const caps = [
  ["CAP01","ESTRUCTURA",DEMO,"0.33","SI"],
  ["CAP02","MAMPOSTERIA",DEMO,"0.12","SI"],
  ["CAP03","ACABADOS",DEMO,"0.25","SI"],
  ["CAP04","CARPINTERIA MADERA",DEMO,"0.10","SI"],
  ["CAP05","ASEO",DEMO,"0.05","SI"],
  ["CAP06","PINTURA",DEMO,"0.15","SI"]
];
const CAPITULOS = [...caps, ...caps.map((r) => [r[0], r[1], PROD, r[3], r[4]])];

const ACTIVIDADES = [
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

const NIVELES = [
  [DEMO,TD,"1","SI"],
  [DEMO,TD,"4","NO"],
  [DEMO,TD,"5","NO"],
  [DEMO,TD,"6","NO"],
  [DEMO,TD,"22","SI"],
  [DEMO,TD,"23","SI"]
];

const UNIDADES = [
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

const CONTRATISTAS = [
  ["CT01","ABC CONSTRUCCIONES","SI"],
  ["CT02","VIDRIOS Y MAS","SI"],
  ["CT03","PINTURAS DEL CARIBE","SI"]
];

const capOf = {
  ACT010: "CAP02", ACT020: "CAP03", ACT030: "CAP04",
  ACT031: "CAP04", ACT040: "CAP06", ACT090: "CAP05"
};
const cfg = (act, nivel, unidad, aplica, activo, ct, obs = "") => [
  DEMO, TD, act, capOf[act], String(nivel), unidad, aplica, activo, ct,
  aplica === "SI" && activo === "SI" && ct !== SIN ? "SI" : "NO",
  "2026-08-01", "", obs
];
const CONFIGURACION = [
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
const add = (name, filas) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), name);
add("LEEME", LEEME);
add("EMPRESAS", [["CODIGO","NOMBRE","ACTIVO"], ...EMPRESAS]);
add("PROYECTOS", [["EMPRESA","CODIGO","NOMBRE","ACTIVO","DEMO"], ...PROYECTOS]);
add("USUARIOS", [["ID_USUARIO","NOMBRE","EMAIL","ROL","EMPRESA","PROYECTO","TORRE","SENDER_ID","PASSWORD_HASH","MUST_CHANGE_PASSWORD","ACCESS_CODE_HASH","RESET_PIN_HASH","RESET_PIN_EXPIRES","ACTIVO"], ...USUARIOS]);
add("CAPITULOS", [["CODIGO","NOMBRE","PROYECTO","PONDERACION","ACTIVO"], ...CAPITULOS]);
add("ACTIVIDADES", [["CODIGO","NOMBRE","CAPITULO","PONDERACION","ACTIVO"], ...ACTIVIDADES]);
add("NIVELES", [["PROYECTO","TORRE","NIVEL","ESPECIAL"], ...NIVELES]);
add("UNIDADES", [["PROYECTO","TORRE","NIVEL","UNIDAD","TIPO","ACTIVO"], ...UNIDADES]);
add("CONTRATISTAS", [["CODIGO","NOMBRE","ACTIVO"], ...CONTRATISTAS]);
add("CONFIGURACION", [["PROYECTO","TORRE","ACTIVIDAD","CAPITULO","NIVEL","UNIDAD","APLICA","ACTIVO","CONTRATISTA","HABILITADO","FECHA_ACTIVACION","FECHA_DESACTIVACION","OBSERVACION"], ...CONFIGURACION]);
add("REGISTRO", [["FECHA","PROYECTO","TORRE","CAPITULO","ACTIVIDAD","NIVEL","UNIDAD","ESTADO","VALOR","CONTRATISTA","USUARIO"], ...REGISTRO]);

const out = path.join(process.cwd(), "config", "appcontrol-db-base.xlsx");
XLSX.writeFile(wb, out);
console.log("Generado:", out);
console.log("Pestañas:", wb.SheetNames.join(", "));
