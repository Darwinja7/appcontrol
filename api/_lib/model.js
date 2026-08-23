export const HEADERS = {
  EMPRESAS: ["CODIGO","NOMBRE","ACTIVO"],

  PROYECTOS: ["EMPRESA","CODIGO","NOMBRE","ACTIVO","DEMO"],

  USUARIOS: [
    "ID_USUARIO",
    "NOMBRE",
    "EMAIL",
    "ROL",
    "EMPRESA",
    "PROYECTO",
    "TORRE",
    "SENDER_ID",
    "PASSWORD_HASH",
    "MUST_CHANGE_PASSWORD",
    "ACCESS_CODE_HASH",
    "RESET_PIN_HASH",
    "RESET_PIN",
    "RESET_PIN_EXPIRES",
    "ACTIVO"
  ],

  CAPITULOS: ["CODIGO","NOMBRE","PROYECTO","PONDERACION","ACTIVO"],

  ACTIVIDADES: ["CODIGO","NOMBRE","CAPITULO","PONDERACION","ACTIVO","APLICACION"],

  NIVELES: ["PROYECTO","TORRE","NIVEL","ESPECIAL"],

  UNIDADES: ["PROYECTO","TORRE","NIVEL","UNIDAD","TIPO","ACTIVO"],

  CONTRATISTAS: ["CODIGO","NOMBRE","ACTIVO"],

  CONFIGURACION: [
    "PROYECTO",
    "TORRE",
    "ACTIVIDAD",
    "CAPITULO",
    "NIVEL",
    "UNIDAD",
    "APLICA",
    "ACTIVO",
    "CONTRATISTA",
    "HABILITADO",
    "FECHA_ACTIVACION",
    "FECHA_DESACTIVACION",
    "OBSERVACION"
  ],

  REGISTRO: [
    "FECHA",
    "PROYECTO",
    "TORRE",
    "CAPITULO",
    "ACTIVIDAD",
    "NIVEL",
    "UNIDAD",
    "ESTADO",
    "VALOR",
    "CONTRATISTA",
    "USUARIO"
  ],

  // Historico de avances calculados (snapshot diario por registro).
  // AMBITO: "GENERAL" | "NIVEL:<n>" | "UNIDAD:<unidad>" | "TORRE:<t>"
  // AVANCE: porcentaje 0-100 con un decimal.
  HISTORICO: [
    "FECHA",
    "PROYECTO",
    "AMBITO",
    "AVANCE"
  ]
};

export const VALORES = {
  "Sin empezar": 0,
  "En replanteo": 0.1,
  "En curso": 0.5,
  "En remate": 0.8,
  "Listo": 1
};

export const SIN_CONTRATISTA = "Sin asignar";

// Pseudo-unidad para actividades que se ejecutan por nivel completo
// (estructura, movimiento de tierras) sin unidad especifica.
export const UNIDAD_NIVEL = "NIVEL";

// APLICACION de una actividad: "UNIDAD" (por defecto) o "NIVEL".
export const aplicacionDe = (act) =>
  String(act?.APLICACION || "").toUpperCase() === "NIVEL" ? "NIVEL" : "UNIDAD";

export function habilitado(row) {
  return String(row.APLICA).toUpperCase() === "SI" &&
         String(row.ACTIVO).toUpperCase() === "SI" &&
         String(row.CONTRATISTA || "").trim() !== "" &&
         String(row.CONTRATISTA || "").trim() !== SIN_CONTRATISTA;
}

export const keyCfg = (r) => [r.TORRE, r.ACTIVIDAD, r.NIVEL, r.UNIDAD].join("|");