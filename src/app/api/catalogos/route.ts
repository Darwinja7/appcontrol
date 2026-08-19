import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyWebSession } from "@/lib/web-auth";
import { loadCatalogs } from "@/lib/catalogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = await cookies();
  const sub = verifyWebSession(store.get("appcontrol_session")?.value);
  if (!sub) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const cat = await loadCatalogs();
    return NextResponse.json(cat);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
