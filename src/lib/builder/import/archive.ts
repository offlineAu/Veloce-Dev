import { unzipSync } from "fflate";

/** Validate central-directory sizes before decompression, then verify actual totals. */
export function readBoundedArchive(bytes: Uint8Array): Map<string, Buffer> {
  if (bytes.byteLength > 24_000_000) throw new Error("Archive exceeds 24 MB");
  let count = 0, total = 0;
  const entries = unzipSync(bytes, { filter(file) {
    if (++count > 1000 || file.originalSize > 15_000_000 || (total += file.originalSize) > 80_000_000) throw new Error("Archive expands beyond its limits");
    if (file.name.startsWith("/") || file.name.includes("\\") || file.name.split("/").some(part => part === "..") || /^[a-z]:/i.test(file.name)) throw new Error("Unsafe archive path");
    return !file.name.endsWith("/");
  } });
  const result = new Map<string, Buffer>();
  let actual = 0;
  for (const [name, data] of Object.entries(entries)) {
    actual += data.length;
    if (data.length > 15_000_000 || actual > 80_000_000) throw new Error("Archive exceeds expanded limits");
    result.set(name, Buffer.from(data));
  }
  return result;
}
