import { createSignedToken, verifySignedToken, sha256Hex, safeCompare } from "./crypto";
import { requiredEnv } from "./env";

export function hashPin(pin: string): string {
  return sha256Hex(pin);
}

export function createWebSession(sub: string) {
  const secret = requiredEnv("HERMES_SESSION_SECRET");
  return createSignedToken({ sub, scope: "web" }, secret, 8 * 3600);
}

export function verifyWebSession(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = verifySignedToken(token, requiredEnv("HERMES_SESSION_SECRET"));
    if (!payload || payload.scope !== "web") return null;
    return String(payload.sub);
  } catch {
    return null;
  }
}

export { safeCompare };
