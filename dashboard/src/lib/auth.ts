// Single-operator auth: one shared DASHBOARD_PASSWORD, no user accounts.
// Login sets a cookie containing an HMAC of a fixed string signed with
// SESSION_SECRET; middleware just recomputes it and compares. Uses Web
// Crypto (crypto.subtle) so it works identically in Next.js middleware
// (edge runtime) and regular route handlers (node runtime).

export const SESSION_COOKIE = "cos_session";

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function makeSessionToken(): Promise<string> {
  const secret = requireEnv("SESSION_SECRET");
  return hmac(secret, "authenticated");
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expected = await makeSessionToken();
  return timingSafeEqual(token, expected);
}

export function checkPassword(input: string): boolean {
  const expected = requireEnv("DASHBOARD_PASSWORD");
  return timingSafeEqual(input, expected);
}

export function checkIngestKey(header: string | null): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  return timingSafeEqual(token, requireEnv("INGEST_API_KEY"));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} — copy .env.example to .env and set it.`);
  }
  return value;
}
