import { readSheetRows } from "@/lib/storage/google-sheets";

type Row = Record<string, string>;

export interface Catalogs {
  proyectos: Row[];
  zonas: Row[];
  actividades: Row[];
  usuarios: Row[];
}

export interface CapturePayload {
  proyecto: string;
  torre: string;
  nivel: string;
  zona: string;
  actividad: string;
  avance: number;
  observacion: string;
}

export interface ValidationError {
  codigo: string;
  mensaje: string;
}

let cache: { at: number; data: Catalogs } | null = null;
const TTL = 60000;

export async function loadCatalogs(): Promise<Catalogs> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;

  const [proyectos, zonas, actividades, usuarios] = await Promise.all([
    readSheetRows("PROYECTOS"),
    readSheetRows("ZONAS"),
    readSheetRows("ACTIVIDADES"),
    readSheetRows("USUARIOS"),
  ]);

  cache = { at: Date.now(), data: { proyectos, zonas, actividades, usuarios } };
  return cache.data;
}

const activo = (v?: string) => (v ?? "").toUpperCase() === "SI";

export async function validarCaptura(
  sender: string,
  payload: CapturePayload
): Promise<ValidationError[]> {
  const errores: ValidationError[] = [];
  const cat = await loadCatalogs();

  const usuario = cat.usuarios.find((u) => u.SENDER_ID === sender);
  if (!usuario) {
    return [
      {
        codigo: "USUARIO_NO_EXISTE",
        mensaje: `El remitente ${sender} no esta registrado en USUARIOS`,
      },
    ];
  }
  if (!activo(usuario.ACTIVO)) {
    return [
      {
        codigo: "USUARIO_INACTIVO",
        mensaje: `El usuario ${usuario.NOMBRE || sender} no esta activo`,
      },
    ];
  }

  const rol = (usuario.ROL ?? "").toUpperCase();

  const proyecto = cat.proyectos.find((p) => p.PROYECTO === payload.proyecto);
  if (!proyecto) {
    errores.push({
      codigo: "PROYECTO_INVALIDO",
      mensaje: `El proyecto ${payload.proyecto} no existe`,
    });
  } else {
    if (!activo(proyecto.ACTIVO)) {
      errores.push({
        codigo: "PROYECTO_INACTIVO",
        mensaje: `El proyecto ${payload.proyecto} no esta activo`,
      });
    }
    const torres = (proyecto.TORRES ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!torres.includes(payload.torre)) {
      errores.push({
        codigo: "TORRE_INVALIDA",
        mensaje: `La torre ${payload.torre} no pertenece a ${payload.proyecto}`,
      });
    }
  }

  if (rol !== "ADMIN") {
    if (usuario.PROYECTO && usuario.PROYECTO !== payload.proyecto) {
      errores.push({
        codigo: "PROYECTO_NO_AUTORIZADO",
        mensaje: `El usuario no esta autorizado para ${payload.proyecto}`,
      });
    }
    if (
      usuario.TORRE &&
      usuario.TORRE !== "*" &&
      usuario.TORRE !== payload.torre
    ) {
      errores.push({
        codigo: "TORRE_NO_AUTORIZADA",
        mensaje: `El usuario no esta autorizado para la torre ${payload.torre}`,
      });
    }
  }

  const zona = cat.zonas.find(
    (z) =>
      z.PROYECTO === payload.proyecto &&
      z.TORRE === payload.torre &&
      String(z.NIVEL) === String(payload.nivel) &&
      z.ZONA === payload.zona
  );
  if (!zona) {
    errores.push({
      codigo: "ZONA_INVALIDA",
      mensaje: `La zona ${payload.zona} no existe para ${payload.proyecto} ${payload.torre} nivel ${payload.nivel}`,
    });
  } else if (!activo(zona.ACTIVA)) {
    errores.push({
      codigo: "ZONA_INACTIVA",
      mensaje: `La zona ${payload.zona} no esta activa`,
    });
  }

  const actividad = cat.actividades.find(
    (a) => a.ACTIVIDAD === payload.actividad
  );
  if (!actividad) {
    errores.push({
      codigo: "ACTIVIDAD_INVALIDA",
      mensaje: `La actividad ${payload.actividad} no existe`,
    });
  } else if (!activo(actividad.ACTIVA)) {
    errores.push({
      codigo: "ACTIVIDAD_INACTIVA",
      mensaje: `La actividad ${payload.actividad} no esta activa`,
    });
  }

  return errores;
}
