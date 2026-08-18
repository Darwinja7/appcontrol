import { NextResponse } from "next/server";
import { issueHermesSessionToken } from "@/lib/hermes-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const agentId = String(body.agent_id ?? "");
    const agentSecret = String(body.agent_secret ?? "");

    if (!agentId || !agentSecret) {
      return NextResponse.json(
        {
          success: false,
          codigo: "MISSING_CREDENTIALS",
          mensaje: "agent_id y agent_secret son requeridos",
        },
        { status: 400 }
      );
    }

    const result = issueHermesSessionToken(agentId, agentSecret);

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          codigo: result.code,
        },
        { status: result.code === "INVALID_CREDENTIALS" ? 401 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session_token: result.token,
      expires_at: result.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        codigo: "INTERNAL_ERROR",
        mensaje: message,
      },
      { status: 500 }
    );
  }
}
