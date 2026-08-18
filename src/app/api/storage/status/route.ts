import { NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storage = getStorageAdapter();
    const health = await storage.healthCheck();

    return NextResponse.json({
      provider: storage.name,
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        provider: null,
        connected: false,
        readable: false,
        writable: false,
        message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
