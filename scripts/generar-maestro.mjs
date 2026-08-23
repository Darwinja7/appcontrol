import XLSX from "xlsx";
import path from "path";

const PIN1234 = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
const P = "P001", T = "T1";
const SIN = "Sin asignar";

const LEEME = [
  ["MAESTRO APPCONTROL - HOJA DE TRABAJO"],
  ["1) Sube este archivo a Google Drive y abrelo con Google Sheets."],
  ["2) Comparte la hoja con la service account (correo en GOOGLE_SERVICE_ACCOUNT_JSON) como EDITOR."],
  ["3) Copia el ID de la hoja (entre /d/ y /edit) y pegalo en Vercel: SPREADSHEET_ID."],
  ["4) Redeploy en Vercel y corre: node scripts/smoke.mjs <url> 999000111 1234"],
  [""],
  ["REGLA DE ORO: HABILITADO = APLICA SI + ACTIVO SI + CONTRATISTA distinto de 'Sin asignar'."],
  ["Solo las filas HABILITADO=SI aparecen en el Grid del residente."],
  ["REGISTRO es historico: nunca borrar filas; el ultimo estado por unidad es el que manda."],
];

const PROYECTOS = [
  ["CODIGO","NOMBRE","ACTIVO"],
  [P,"SALGUERO ELITE 2","SI"],
];

const USUARIOS = [
  ["ID_USUARIO","NOMBRE","ROL","PROYECTO","TORRE","SENDER_ID","PIN_HASH","ACTIVO"],
  ["U001","Darwin","ADMIN",P,"*","999000111",PIN1234,"SI"],
  ["U002","Laura","RESIDENTE",P,T,"111222333",PIN1234,"SI"],
  ["U003","Gerencia","VISUALIZADOR",P,"*","444555666",PIN1234,"SI"],
];

const CAPITULOS = [
  ["CODIGO","NOMBRE","PROYECTO","PONDERACION","ACTIVO"],
  ["CAP01","ESTRUCTURA",P,"0.33","SI"],
  ["CAP02","MAMPOSTERIA",P,"0.12","SI"],
  ["CAP03","ACABADOS",P,"0.25","SI"],
  ["CAP04","CARPINTERIA MADERA",P,"0.10","SI"],
  ["CAP05","ASEO",P,"0.05","SI"],
  ["CAP06","PINTURA",P,"0.15","SI"],
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
  ["ACT090","Aseo zonas comunes","CAP05","1","SI"],
];

const CONTRATISTAS = [
  ["CODIGO","NOMBRE","ACTIVO"],
  ["CT01","ABC CONSTRUCCIONES","SI"],
  ["CT02","VIDRIOS Y MAS","SI"],
  ["CT03","PINTURAS DEL CARIBE","SI"],
];

const NIVELES = [
  ["PROYECTO","TORRE","NIVEL","ESPECIAL"],
  [P,T,"1","SI"],
  [P,T,"4","NO"],
  [P,T,"5","NO"],
  [P,T,"6","NO"],
  [P,T,"22","SI"],
  [P,T,"23","SI"],
];

const UNIDADES = [
  ["PROYECTO","TORRE","NIVEL","UNIDAD","TIPO","ACTIVO"],
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
  [P,T,"23","AMENIDADES","AMENIDADES","SI"],
];

// CONFIGURACION: relacion actividad-capitulo-nivel-unidad + regla de oro
const capDe = (a) => ACTIVIDADES.find((r) => r[0] === a)[2];
function cfg(act, nivel, unidad, aplica, activo, ct, obs = "") {
  const hab = aplica === "SI" && activo === "SI" && ct !== SIN ? "SI" : "NO";
  return [P, T, act, capDe(act), String(nivel), unidad, aplica, activo, ct, hab, "2026-08-01", "", obs];
}
const CONFIGURACION = [
  ["PROYECTO","TORRE","ACTIVIDAD","CAPITULO","NIVEL","UNIDAD","APLICA","ACTIVO","CONTRATISTA","HABILITADO","FECHA_ACTIVACION","FECHA_DESACTIVACION","OBSERVACION"],
  cfg("ACT010", 4, "401", "SI", "SI", "CT01"),
  cfg("ACT010", 4, "402", "SI", "SI", SIN, "Falta firmar contrato"),
  cfg("ACT010", 4, "403", "SI", "NO", "CT01", "Pausado por diseno"),
  cfg("ACT010", 4, "404", "NO", "SI", "CT01", "No aplica: fachada norte"),
  cfg("ACT010", 5, "501", "SI", "SI", "CT01"),
  cfg("ACT010", 5, "502", "SI", "SI", "CT01"),
  cfg("ACT020", 4, "401", "SI", "SI", "CT02"),
  cfg("ACT020", 4, "402", "SI", "SI", "CT02"),
  cfg("ACT020", 22, "SAUNA", "SI", "SI", "CT02"),
  cfg("ACT020", 22, "TURCO", "SI", "SI", SIN, "Zona especial sin contratista"),
  cfg("ACT030", 6, "601", "SI", "SI", "CT02"),
  cfg("ACT031", 4, "401", "SI", "SI", "CT02"),
  cfg("ACT040", 4, "401", "SI", "SI", "CT03"),
  cfg("ACT090", 1, "LOBBY", "SI", "SI", "CT03"),
  cfg("ACT090", 23, "AMENIDADES", "SI", "SI", "CT03"),
];

// REGISTRO: historico inmutable (ultimo estado por unidad manda)
const REGISTRO = [
  ["FECHA","PROYECTO","TORRE","CAPITULO","ACTIVIDAD","NIVEL","UNIDAD","ESTADO","VALOR","CONTRATISTA","USUARIO"],
  ["2026-08-18T14:05:00.000Z",P,T,"CAP02","ACT010","4","401","Listo","1","CT01","111222333"],
  ["2026-08-18T14:06:00.000Z",P,T,"CAP02","ACT010","5","501","En remate","0.8","CT01","111222333"],
  ["2026-08-19T09:12:00.000Z",P,T,"CAP02","ACT010","5","502","En curso","0.5","CT01","111222333"],
  ["2026-08-19T09:15:00.000Z",P,T,"CAP03","ACT020","4","401","Listo","1","CT02","111222333"],
  ["2026-08-20T10:30:00.000Z",P,T,"CAP03","ACT020","4","402","En curso","0.5","CT02","111222333"],
  ["2026-08-20T10:32:00.000Z",P,T,"CAP03","ACT020","22","SAUNA","En replanteo","0.1","CT02","111222333"],
  ["2026-08-21T16:00:00.000Z",P,T,"CAP05","ACT090","1","LOBBY","Listo","1","CT03","111222333"],
  ["2026-08-22T08:40:00.000Z",P,T,"CAP04","ACT030","6","601","En replanteo","0.1","CT02","111222333"],
];

const wb = XLSX.utils.book_new();
const add = (name, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
add("LEEME", LEEME);
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
console.log("Pestanas: LEEME, PROYECTOS, USUARIOS, CAPITULOS, ACTIVIDADES, CONTRATISTAS, NIVELES, UNIDADES, CONFIGURACION, REGISTRO");