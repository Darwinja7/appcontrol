import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "AppControl",
    storage_provider: process.env.STORAGE_PROVIDER ?? "not_configured",
    spreadsheet_configured: Boolean(process.env.SPREADSHEET_ID),
    timestamp: new Date().toISOString(),
  });
}
