import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import type { FetchLike } from "@/lib/builder/import/assets";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 15_000_000;
const MAX_TOTAL_BYTES = 60_000_000;
const MAX_REDIRECTS = 3;
const IMPORT_TIMEOUT_MS = 45_000;
const blocked = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) blocked.addSubnet(address, prefix, "ipv6");

/** Reject non-global ranges, including every IPv4-mapped IPv6 spelling. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return blocked.check(ip, "ipv4");
  if (version === 6) return !globalV6.check(ip, "ipv6") || blocked.check(ip, "ipv6");
  return true;
}

async function resolvePublic(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("only https addresses are downloaded");
  if (url.username || url.password) throw new Error("addresses with credentials are not downloaded");
  if (url.port && url.port !== "443") throw new Error("non-standard ports are not downloaded");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dnsDeadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DNS lookup timed out")), 3000); });
  let addresses: { address: string; family: number }[];
  try { addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([lookup(host, { all: true, verbatim: true }), dnsDeadline]); }
  finally { clearTimeout(timer); }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("that address is not public");
  return { url, addresses };
}

export async function assertPublicUrl(raw: string): Promise<URL> { return (await resolvePublic(raw)).url; }

/** The TLS socket uses ONLY the validated address; hostname/SNI/certificate checks stay intact. */
export async function pinnedDownload(raw: string, headers: Record<string, string> = {}, maxBytes = MAX_BYTES) {
  const { url, addresses } = await resolvePublic(raw);
  const address = addresses[0]!;
  const pinnedLookup: LookupFunction = (_host, options, callback) => {
    if (options.all) callback(null, [address]);
    else callback(null, address.address, address.family);
  };
  return new Promise<{ status: number; location?: string; bytes: Buffer }>((resolve, reject) => {
    const req = request(url, {
      agent: false, lookup: pinnedLookup, signal: AbortSignal.timeout(TIMEOUT_MS),
      // Never forward authentication headers to a redirect target. Identity encoding
      // keeps byte limits meaningful; compressed responses are deliberately rejected.
      headers: { "User-Agent": headers["User-Agent"] ?? "VeloceAssetImporter/1", "Accept-Encoding": "identity" },
    }, (res) => {
      const status = res.statusCode ?? 502;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.destroy(); resolve({ status, location: res.headers.location, bytes: Buffer.alloc(0) }); return;
      }
      if ((res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") || Number(res.headers["content-length"] ?? 0) > maxBytes) {
        res.destroy(); reject(new Error("file too large or encoded")); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { res.destroy(new Error("file too large")); return; }
        chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => resolve({ status, bytes: Buffer.concat(chunks, size) }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** Count and aggregate-byte budgets are shared by all pages in one import. */
export function createSafeFetch(limit = 80): FetchLike {
  let used = 0;
  let remaining = MAX_TOTAL_BYTES;
  const deadline = Date.now() + IMPORT_TIMEOUT_MS;
  // Serialize downloads so concurrent calls cannot each spend the remaining budget.
  let pending: Promise<unknown> = Promise.resolve();
  return (input, init) => {
    const task = pending.then(async () => {
      if (Date.now() > deadline) throw new Error("import download deadline exceeded");
      if (++used > limit) throw new Error("too many files in one import");
      if (remaining <= 0) throw new Error("import download budget exceeded");
      let url = input;
      for (let hop = 0; ; hop++) {
        if (Date.now() > deadline) throw new Error("import download deadline exceeded");
        let res: Awaited<ReturnType<typeof pinnedDownload>>;
        try { res = await pinnedDownload(url, init?.headers, Math.min(MAX_BYTES, remaining)); }
        catch (error) { remaining = 0; throw error; }
        if (res.location) {
          if (hop >= MAX_REDIRECTS) throw new Error("too many redirects");
          url = new URL(res.location, url).toString(); continue;
        }
        remaining -= res.bytes.length;
        return { ok: res.status >= 200 && res.status < 300, status: res.status, text: async () => res.bytes.toString("utf8"), arrayBuffer: async () => Uint8Array.from(res.bytes).buffer };
      }
    });
    pending = task.catch(() => undefined);
    return task;
  };
}
