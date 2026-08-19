import { NextResponse } from "next/server";
import { loadCatalogs } from "@/lib/catalogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cat = await loadCatalogs();
    return NextResponse.json(cat);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
