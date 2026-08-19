import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyWebSession } from "@/lib/web-auth";
import { loadCatalogs } from "@/lib/catalogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = await cookies();
  const sub = verifyWebSession(store.get("appcontrol_session")?.value);
  if (!sub) return NextResponse.json({ success: false }, { status: 401 });

  const cat = await loadCatalogs();
  const user = cat.usuarios.find(
    (u) => u.SENDER_ID === sub || u.ID_USUARIO === sub
  );
  if (!user) return NextResponse.json({ success: false }, { status: 401 });

  return NextResponse.json({
    success: true,
    usuario: {
      id: user.ID_USUARIO,
      nombre: user.NOMBRE,
      rol: user.ROL,
      proyecto: user.PROYECTO,
      torre: user.TORRE,
    },
  });
}
