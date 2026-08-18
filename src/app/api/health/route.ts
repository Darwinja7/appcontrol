import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "AppControl",
    storage_provider: getEnv("STORAGE_PROVIDER", "not_configured"),
    spreadsheet_configured: Boolean(getEnv("SPREADSHEET_ID")),
    timestamp: new Date().toISOString(),
  });
}
