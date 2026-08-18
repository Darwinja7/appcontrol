import { getEnv, requiredEnv } from "./env";
import { createSignedToken, safeCompare, verifySignedToken } from "./crypto";

export function issueHermesSessionToken(agentId: string, agentSecret: string) {
  try {
    const expectedId = requiredEnv("HERMES_AGENT_ID");
    const expectedSecret = requiredEnv("HERMES_AGENT_SECRET");
    const sessionSecret = requiredEnv("HERMES_SESSION_SECRET");

    if (!safeCompare(agentId, expectedId) || !safeCompare(agentSecret, expectedSecret)) {
      return {
        ok: false as const,
        code: "INVALID_CREDENTIALS",
      };
    }

    const { token, expiresAt } = createSignedToken(
      {
        sub: agentId,
        scope: "capture",
      },
      sessionSecret,
      3600
    );

    return {
      ok: true as const,
      token,
      expiresAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false as const,
      code: message,
    };
  }
}

export function verifyHermesAccessToken(
  authHeader: string | null
): { ok: true; agentId: string } | { ok: false; code: string } {
  const bearer = authHeader ?? "";
  const token = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";

  if (!token) {
    return { ok: false, code: "UNAUTHORIZED" };
  }

  const staticToken = getEnv("HERMES_CAPTURE_TOKEN");

  if (staticToken && safeCompare(token, staticToken)) {
    return { ok: true, agentId: "hermes-static-token" };
  }

  try {
    const sessionSecret = requiredEnv("HERMES_SESSION_SECRET");
    const payload = verifySignedToken(token, sessionSecret);

    if (!payload) {
      return { ok: false, code: "INVALID_TOKEN" };
    }

    if (payload.scope !== "capture") {
      return { ok: false, code: "INVALID_SCOPE" };
    }

    return { ok: true, agentId: String(payload.sub ?? "hermes-agent") };
  } catch {
    return { ok: false, code: "UNAUTHORIZED" };
  }
}
