export const HEADERS = {
  USUARIOS: ["ID_USUARIO","NOMBRE","ROL","PROYECTO","TORRE","SENDER_ID","PIN_HASH","ACTIVO"],
  PROYECTOS: ["CODIGO","NOMBRE","ACTIVO"],
  CAPITULOS: ["CODIGO","NOMBRE","PROYECTO","PONDERACION","ACTIVO"],
  ACTIVIDADES: ["CODIGO","NOMBRE","CAPITULO","PONDERACION","ACTIVO"],
  UNIDADES: ["PROYECTO","TORRE","NIVEL","UNIDAD","TIPO","ACTIVO"],
  CONTRATISTAS: ["CODIGO","NOMBRE","ACTIVO"],
  CONFIGURACION: ["PROYECTO","TORRE","ACTIVIDAD","CAPITULO","NIVEL","UNIDAD","APLICA","ACTIVO","CONTRATISTA","HABILITADO","FECHA_ACTIVACION","FECHA_DESACTIVACION","OBSERVACION"],
  REGISTRO: ["FECHA","PROYECTO","TORRE","CAPITULO","ACTIVIDAD","NIVEL","UNIDAD","ESTADO","VALOR","CONTRATISTA","USUARIO"],
};
export const VALORES = { "Sin empezar": 0, "En replanteo": 0.1, "En curso": 0.5, "En remate": 0.8, "Listo": 1 };
export const SIN_CONTRATISTA = "Sin asignar";
// Regla de oro del documento: APLICA + ACTIVO + CONTRATISTA => HABILITADO
export function habilitado(row) {
  return String(row.APLICA).toUpperCase() === "SI" &&
         String(row.ACTIVO).toUpperCase() === "SI" &&
         String(row.CONTRATISTA || "").trim() !== "" &&
         String(row.CONTRATISTA || "").trim() !== SIN_CONTRATISTA;
}
export const keyCfg = (r) => [r.TORRE, r.ACTIVIDAD, r.NIVEL, r.UNIDAD].join("|");
