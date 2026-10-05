import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { env } from "@/config/env";

/** Keyed hash for rate-limit keys and logs, so raw IPs/emails are never stored. */
export function hmac(value: string): string {
  return createHmac("sha256", env().HASH_SECRET).update(value).digest("hex").slice(0, 32);
}

/** 128-bit random public token (22 chars, URL-safe). */
export function newPublicToken(): string {
  return randomBytes(16).toString("base64url");
}
