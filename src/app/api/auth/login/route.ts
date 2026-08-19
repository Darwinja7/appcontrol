import { NextResponse } from "next/server";
import { loadCatalogs } from "@/lib/catalogs";
import { createWebSession, hashPin, safeCompare } from "@/lib/web-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const usuario = String(body?.usuario ?? "").trim();
  const pin = String(body?.pin ?? "").trim();

  if (!usuario || !pin) {
    return NextResponse.json({ success: false, codigo: "MISSING_CREDENTIALS" }, { status: 400 });
  }

  const cat = await loadCatalogs();
  const user = cat.usuarios.find(
    (u) => u.SENDER_ID === usuario || u.ID_USUARIO === usuario
  );

  if (!user || (user.ACTIVO ?? "").toUpperCase() !== "SI") {
    return NextResponse.json({ success: false, codigo: "CREDENCIALES_INVALIDAS" }, { status: 401 });
  }

  if (!user.PIN_HASH || !safeCompare(user.PIN_HASH, hashPin(pin))) {
    return NextResponse.json({ success: false, codigo: "CREDENCIALES_INVALIDAS" }, { status: 401 });
  }

  const { token, expiresAt } = createWebSession(user.SENDER_ID || user.ID_USUARIO);

  const res = NextResponse.json({
    success: true,
    nombre: user.NOMBRE,
    expires_at: expiresAt,
  });

  res.cookies.set("appcontrol_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 3600,
  });

  return res;
}
