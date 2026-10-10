import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { FetchLike } from "@/lib/builder/import/assets";

/*
 * Uploaded HTML decides which addresses the importer downloads (fonts, images). On the server that must never reach
 * anything internal (cloud metadata, the database, localhost), so every request, and every redirect, is checked:
 * https only, a public IP address, a time limit, a size limit and a cap on the number of downloads per import.
 */

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 15_000_000;
const MAX_REDIRECTS = 3;

/** Private, loopback, link-local, carrier-grade NAT, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return s === "::" || s === "::1" || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s);
  }
  return true;
}

/** Throws unless the URL is https on the default port and every address its host resolves to is public. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("only https addresses are downloaded");
  if (url.username || url.password) throw new Error("addresses with credentials are not downloaded");
  if (url.port && url.port !== "443") throw new Error("non-standard ports are not downloaded");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new Error("that address is not public");
  return url;
}

/** A FetchLike for the importer that only reaches the public internet. `limit` caps downloads per import. */
export function createSafeFetch(limit = 80): FetchLike {
  let used = 0;
  return async (input, init) => {
    if (++used > limit) throw new Error("too many files in one import");
    let url = await assertPublicUrl(input);
    for (let hop = 0; ; hop++) {
      const res = await fetch(url, { headers: init?.headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        if (hop >= MAX_REDIRECTS) throw new Error("too many redirects");
        url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
        continue;
      }
      const length = Number(res.headers.get("content-length") ?? 0);
      if (length > MAX_BYTES) throw new Error("file too large");
      return res;
    }
  };
}
