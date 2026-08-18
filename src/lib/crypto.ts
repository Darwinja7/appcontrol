import crypto from "crypto";

export function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a ?? "");
  const bBuf = Buffer.from(b ?? "");

  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1));
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function createSignedToken(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds: number
): { token: string; expiresAt: string } {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const data = base64UrlEncode(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  return {
    token: `${data}.${signature}`,
    expiresAt: new Date((now + ttlSeconds) * 1000).toISOString(),
  };
}

export function verifySignedToken(
  token: string,
  secret: string
): Record<string, unknown> | null {
  try {
    const [data, signature] = token.split(".");
    if (!data || !signature) return null;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64url");

    if (!safeCompare(expected, signature)) return null;

    const payload = JSON.parse(base64UrlDecode(data)) as Record<string, unknown>;
    const exp = typeof payload.exp === "number" ? payload.exp : 0;

    if (Math.floor(Date.now() / 1000) > exp) return null;

    return payload;
  } catch {
    return null;
  }
}
