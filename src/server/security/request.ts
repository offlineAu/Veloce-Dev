import "server-only";
import { headers } from "next/headers";
import { hmac } from "./hash";

/**
 * Client IP hash. x-forwarded-for is only trustworthy behind a proxy that sets it
 * (e.g. Vercel); on a bare server it can be spoofed, which only weakens rate limiting.
 */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return hmac(`ip:${ip}`);
}

export const MIN_FILL_MS = 1500;

/** True if the submission looks automated (honeypot filled or submitted implausibly fast). */
export function looksLikeBot(input: { contactFax?: string; startedAt: number }, now = Date.now()): boolean {
  if (input.contactFax && input.contactFax.trim() !== "") return true;
  const elapsed = now - input.startedAt;
  return elapsed < MIN_FILL_MS;
}
