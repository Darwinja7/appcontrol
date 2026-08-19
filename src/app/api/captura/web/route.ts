import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyWebSession } from "@/lib/web-auth";
import { hermesPayloadSchema } from "@/lib/validation";
import { validarCaptura } from "@/lib/catalogs";
import { getStorageAdapter } from "@/lib/storage";
import { sha256Hex } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reject(codigo: string, mensaje: string, status: number) {
  return NextResponse.json(
    { success: false, estado: "RECHAZADO", codigo, mensaje },
    { status }
  );
}

export async function POST(request: Request) {
  const store = await cookies();
  const sub = verifyWebSession(store.get("appcontrol_session")?.value);
  if (!sub) return reject("UNAUTHORIZED", "Inicie sesion", 401);

  const body = await request.json().catch(() => null);
  const parsed = hermesPayloadSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((item) => `${item.path.join(".")}: ${item.message}`)
      .join("; ");
    return reject("INVALID_SCHEMA", message, 400);
  }

  const payload = parsed.data;

  const errores = await validarCaptura(sub, payload);
  if (errores.length > 0) {
    return reject(errores[0].codigo, errores.map((e) => e.mensaje).join("; "), 400);
  }

  const canonical = JSON.stringify({ source: "WEB", sender: sub, payload });
  const hash = sha256Hex(canonical);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || hash;

  try {
    const storage = getStorageAdapter();

    const existing = await storage.findRegistroByIdempotencyKey(idempotencyKey);
    if (existing) {
      return NextResponse.json({ success: true, registro_id: existing, estado: "DUPLICADO" });
    }

    const registro = {
      fechaHora: new Date().toISOString(),
      usuario: sub,
      proyecto: payload.proyecto,
      torre: payload.torre,
      nivel: payload.nivel,
      zona: payload.zona,
      actividad: payload.actividad,
      avance: payload.avance,
      observacion: payload.observacion,
      fuente: "WEB",
      estado: "VALIDADO",
      idempotencyKey,
      hash,
    };

    const registroId = await storage.appendRegistro(registro);

    return NextResponse.json({ success: true, registro_id: registroId, estado: "VALIDADO" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("MISSING_ENV_")) return reject("CREDENTIALS_REQUIRED", message, 500);
    if (message.startsWith("UNSUPPORTED_STORAGE_PROVIDER_")) return reject("STORAGE_CONFIG_ERROR", message, 500);
    return reject("STORAGE_UNAVAILABLE", message, 502);
  }
}
