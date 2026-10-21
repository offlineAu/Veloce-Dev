import "server-only";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { hmac } from "./hash";

/** Trust an IP header only when the ingress overwrites it and direct access is blocked. */
export function trustedClientIp(h: Pick<Headers, "get">): string {
  const header = process.env.VERCEL === "1" ? "x-forwarded-for" : process.env.SECURITY_TRUSTED_IP_HEADER;
  if (header !== "x-forwarded-for" && header !== "x-real-ip") return "unknown";
  const parts = (h.get(header) ?? "").split(",");
  // Choose the address appended by the trusted ingress, never a client-prepended value.
  const ip = parts.at(-1)?.trim() ?? "";
  return isIP(ip) ? ip : "unknown";
}
export async function clientKey(): Promise<string> {
  return hmac(`ip:${trustedClientIp(await headers())}`);
}

export const MIN_FILL_MS = 1500;

/** True if the submission looks automated (honeypot filled or submitted implausibly fast). */
export function looksLikeBot(input: { contactFax?: string; startedAt: number }, now = Date.now()): boolean {
  if (input.contactFax && input.contactFax.trim() !== "") return true;
  const elapsed = now - input.startedAt;
  return elapsed < MIN_FILL_MS;
}
