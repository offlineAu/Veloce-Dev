import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/config/env";

export { hashPassword, verifyPassword } from "./password";

/*
 * Developer access for template uploads: one shared password (stored only as an scrypt hash in the environment)
 * unlocks a signed session cookie for a few hours. The keyboard shortcut that opens the panel is convenience, not
 * security; everything here is enforced on the server, on every request.
 */

export const DEV_COOKIE = "vlc_dev";
export const DEV_SESSION_HOURS = 8;

export interface DevSession {
  name: string;
  exp: number;
}

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(`dev-session:${body}`).digest("base64url");

export function encodeSession(s: DevSession, secret: string): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** The session in a cookie value, or null when it is missing, tampered with or expired. */
export function decodeSession(token: string | undefined, secret: string, now = Date.now()): DevSession | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as DevSession;
    return typeof s.name === "string" && typeof s.exp === "number" && s.exp > now ? s : null;
  } catch {
    return null;
  }
}

/** Uploads are switched on only when both the password hash and the session secret are configured. */
export function devUploadsEnabled(): boolean {
  const e = env();
  return !!e.TEMPLATE_UPLOAD_PASSWORD_HASH && !!e.DEV_SESSION_SECRET;
}

export async function readDevSession(): Promise<DevSession | null> {
  const secret = env().DEV_SESSION_SECRET;
  if (!secret || !devUploadsEnabled()) return null;
  return decodeSession((await cookies()).get(DEV_COOKIE)?.value, secret);
}

export class DevAuthError extends Error {
  constructor() {
    super("Developer session required");
  }
}

export async function requireDevSession(): Promise<DevSession> {
  const s = await readDevSession();
  if (!s) throw new DevAuthError();
  return s;
}

export async function startDevSession(name: string): Promise<void> {
  const secret = env().DEV_SESSION_SECRET!;
  const exp = Date.now() + DEV_SESSION_HOURS * 3600_000;
  (await cookies()).set(DEV_COOKIE, encodeSession({ name, exp }, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: DEV_SESSION_HOURS * 3600,
  });
}

export async function endDevSession(): Promise<void> {
  (await cookies()).delete(DEV_COOKIE);
}
