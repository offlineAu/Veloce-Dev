import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import sharp from "sharp";
import { readBoundedArchive } from "@/lib/builder/import/archive";
import { watermarkedPreview } from "@/lib/security/watermark";
import { securityCsp } from "@/lib/security/csp";
import { sanitizeHtmlOnServer } from "@/server/builder/sanitize-html";

describe("safe publication", () => {
  it("composites attribution into a resized image and strips metadata", async () => {
    const original = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#336699" } }).withExif({ IFD0: { Copyright: "fixture-original" } }).png().toBuffer();
    const output = await watermarkedPreview(original, "veloceapp.dev", 240);
    const meta = await sharp(output).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 240, height: 160 });
    expect(meta.exif).toBeUndefined();
    const { data, info } = await sharp(output).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const bottom = data.subarray((info.height - 25) * info.width * 3);
    expect(new Set(bottom).size).toBeGreaterThan(20); // flattened photo alone would remain uniform
  });
  it("rejects attribution markup", async () => { await expect(watermarkedPreview(Buffer.alloc(0), '<svg onload="bad">')).rejects.toThrow("plain attribution"); });
  it("rejects archive traversal and oversized expansion before extracting", () => {
    expect(() => readBoundedArchive(zipSync({ "../private.txt": new Uint8Array([1]) }))).toThrow("Unsafe archive path");
    expect(() => readBoundedArchive(zipSync({ "bomb.txt": new Uint8Array(15_000_001) }))).toThrow("expands");
    expect(readBoundedArchive(zipSync({ "home/code.html": new TextEncoder().encode("<main>Safe</main>") })).get("home/code.html")?.toString()).toBe("<main>Safe</main>");
  });
});
it("has strict production scripts, scoped builder exceptions and disabled plugin content", () => {
  const strict = securityCsp({ production: true, nonce: "fixture" });
  expect(strict).toContain("object-src 'none'"); expect(strict).toContain("script-src 'self' 'nonce-fixture'");
  expect(strict).not.toContain("unsafe-eval"); expect(strict).not.toContain("frame-src 'self' https:");
  expect(securityCsp({ production: true, builder: true })).toContain("frame-src 'self' https:");
});
it("removes active malicious markup before storage", () => {
  const html = sanitizeHtmlOnServer('<script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="javascript:alert(1)" srcdoc="<script>bad</script>"></iframe><svg><animate attributeName="href" values="javascript:alert(1)"/></svg><a href="javascript:alert(1)">link</a>');
  expect(html).not.toMatch(/<script|onerror|javascript:|srcdoc|<animate/i);
});
