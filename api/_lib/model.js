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

  ACTIVIDADES: ["CODIGO","NOMBRE","CAPITULO","PONDERACION","ACTIVO","APLICACION","ZONA"],

  NIVELES: ["PROYECTO","TORRE","NIVEL","ESPECIAL"],

  UNIDADES: ["PROYECTO","TORRE","NIVEL","UNIDAD","TIPO","ACTIVO"],

  CONTRATISTAS: ["CODIGO","NOMBRE","ACTIVO"],

  // Configuracion LLM por administrador (opcional). KEY_ENC va cifrada con
  // AES-256-GCM derivado de SESSION_SECRET; jamas vuelve al cliente.
  LLM_CONFIG: ["EMAIL","PROVEEDOR","MODELO","BASE_URL","KEY_ENC","ACTUALIZADO"],

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

// Pseudo-unidad para actividades especiales que se registran por nivel
// completo (estructura, movimiento de tierras) sin unidad especifica.
export const UNIDAD_NIVEL = "NIVEL";

// Modos de aplicacion de una actividad:
// - "UNIDAD": se registra por apartamento/zona dentro de cada nivel (default).
// - "NIVEL": actividad especial con un solo estado para el nivel completo.
// - "ZONA": zona fija presente en todos los niveles (ej. punto fijo de
//   escaleras, ascensor, barandas, puertas cortafuego); se registra en esa
//   zona nivel a nivel, sin tocar los apartamentos.
export const MODOS = ["UNIDAD", "NIVEL", "ZONA"];

export const aplicacionDe = (act) => {
  const v = String(act?.APLICACION || "").toUpperCase();
  return MODOS.includes(v) ? v : "UNIDAD";
};

// Nombre de la zona fija. Se normaliza sin "|" porque participa en claves
// compuestas (torre|actividad|nivel|unidad).
export const zonaDe = (act) =>
  String(act?.ZONA || "").replace(/\|/g, " ").trim().toUpperCase() || "PUNTO FIJO";

/**
 * Colapsa CONFIGURACION al modo vigente de cada actividad:
 * - NIVEL: una fila por nivel con UNIDAD="NIVEL".
 * - ZONA:  una fila por nivel con UNIDAD=<zona>.
 * - UNIDAD: filas intactas.
 * Conserva contratista/aplica/activo de lo ya configurado y recalcula
 * HABILITADO. Es idempotente: aplicarla dos veces no cambia nada.
 */
export function normalizarConfigPorModo(cfgRows, actividades) {
  const info = new Map(actividades.map((a) => [String(a.CODIGO), a]));
  const vistas = new Set();
  const salida = [];
  for (const r of cfgRows) {
    const act = info.get(String(r.ACTIVIDAD));
    if (!act || aplicacionDe(act) === "UNIDAD") { salida.push(r); continue; }
    const gk = r.ACTIVIDAD + "|" + r.TORRE + "|" + String(r.NIVEL);
    if (vistas.has(gk)) continue;
    vistas.add(gk);
    const filas = cfgRows.filter((x) =>
      x.ACTIVIDAD === r.ACTIVIDAD && x.TORRE === r.TORRE && String(x.NIVEL) === String(r.NIVEL));
    const aplica = filas.some((x) => String(x.APLICA).toUpperCase() === "SI") ? "SI" : "NO";
    const activo = filas.some((x) => String(x.ACTIVO).toUpperCase() === "SI") ? "SI" : "NO";
    const conCt = filas.find((x) => String(x.CONTRATISTA || "").trim() !== "" && x.CONTRATISTA !== SIN_CONTRATISTA);
    const activacion = filas.map((x) => String(x.FECHA_ACTIVACION || "")).filter(Boolean).sort();
    const base = {
      ...filas[0],
      CAPITULO: act.CAPITULO || filas[0].CAPITULO,
      NIVEL: String(r.NIVEL),
      UNIDAD: aplicacionDe(act) === "NIVEL" ? UNIDAD_NIVEL : zonaDe(act),
      APLICA: aplica,
      ACTIVO: activo,
      CONTRATISTA: conCt ? conCt.CONTRATISTA : SIN_CONTRATISTA,
      FECHA_ACTIVACION: activacion[0] || ""
    };
    base.HABILITADO = habilitado(base) ? "SI" : "NO";
    salida.push(base);
  }
  return salida;
}

export function habilitado(row) {
  return String(row.APLICA).toUpperCase() === "SI" &&
         String(row.ACTIVO).toUpperCase() === "SI" &&
         String(row.CONTRATISTA || "").trim() !== "" &&
         String(row.CONTRATISTA || "").trim() !== SIN_CONTRATISTA;
}

export const keyCfg = (r) => [r.TORRE, r.ACTIVIDAD, r.NIVEL, r.UNIDAD].join("|");