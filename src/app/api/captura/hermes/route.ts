import { NextResponse } from "next/server";
import { hermesCaptureSchema } from "@/lib/validation";
import { verifyHermesAccessToken } from "@/lib/hermes-auth";
import { getStorageAdapter } from "@/lib/storage";
import { sha256Hex } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reject(codigo: string, mensaje: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      estado: "RECHAZADO",
      codigo,
      mensaje,
    },
    { status }
  );
}

export async function POST(request: Request) {
  const auth = verifyHermesAccessToken(request.headers.get("authorization"));

  if (!auth.ok) {
    return reject(auth.code, "No autorizado", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return reject("INVALID_JSON", "El body no es JSON valido", 400);
  }

  const parsed = hermesCaptureSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((item) => `${item.path.join(".")}: ${item.message}`)
      .join("; ");

    return reject("INVALID_SCHEMA", message, 400);
  }

  const data = parsed.data;

  const idempotencyHeader = request.headers.get("idempotency-key")?.trim();
  const canonical = JSON.stringify({
    source: data.source,
    sender: data.sender,
    timestamp: data.timestamp,
    payload: data.payload,
  });

  const hash = sha256Hex(canonical);
  const idempotencyKey = idempotencyHeader || hash;

  try {
    const storage = getStorageAdapter();

    const existing = await storage.findRegistroByIdempotencyKey(idempotencyKey);

    if (existing) {
      return NextResponse.json({
        success: true,
        registro_id: existing,
        estado: "DUPLICADO",
      });
    }

    const registro = {
      fechaHora: data.timestamp,
      usuario: data.sender,
      proyecto: data.payload.proyecto,
      torre: data.payload.torre,
      nivel: data.payload.nivel,
      zona: data.payload.zona,
      actividad: data.payload.actividad,
      avance: data.payload.avance,
      observacion: data.payload.observacion,
      fuente: data.source,
      estado: "VALIDADO",
      idempotencyKey,
      hash,
    };

    const registroId = await storage.appendRegistro(registro);

    return NextResponse.json({
      success: true,
      registro_id: registroId,
      estado: "VALIDADO",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.startsWith("MISSING_ENV_")) {
      return reject("CREDENTIALS_REQUIRED", message, 500);
    }

    if (message.startsWith("UNSUPPORTED_STORAGE_PROVIDER_")) {
      return reject("STORAGE_CONFIG_ERROR", message, 500);
    }

    return reject("STORAGE_UNAVAILABLE", message, 502);
  }
}
