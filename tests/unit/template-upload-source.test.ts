import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { uploadTemplate } from "@/server/builder/upload-service";

const stored = vi.hoisted(() => ({ versions: [] as Record<string, unknown>[], assets: [] as { path: string; bytes: Uint8Array }[] }));
vi.mock("@/server/db", () => {
  const tx = {
    builderTemplate: { findUnique: async () => null, upsert: async () => ({ id: "template" }) },
    builderTemplateVersion: { create: async ({ data }: { data: Record<string, unknown> }) => { stored.versions.push(data); return { id: "version" }; } },
    builderTemplateAsset: { createMany: async ({ data }: { data: typeof stored.assets }) => { stored.assets.push(...data); } },
  };
  return { db: { ...tx, $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } };
});

beforeEach(() => { stored.versions.length = 0; stored.assets.length = 0; });

const photo = () => sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer();
const inputFor = (html: string) => ({ name: "Images", slug: "test-images", websiteType: "BUSINESS", pages: [{ fileName: "home.html", html: `<main><section><h1>Images</h1>${html}</section></main>` }] });
const response = (bytes: Buffer) => ({ ok: true, status: 200, text: async () => "", arrayBuffer: async () => Uint8Array.from(bytes).buffer });

describe("HTML upload with image files", () => {
  it("imports distinct local images on multiple pages and retains private editable source", async () => {
    const red = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer();
    const blue = await sharp({ create: { width: 4, height: 4, channels: 3, background: "blue" } }).png().toBuffer();
    const pages = [
      { fileName: "home.html", html: '<main><section><h1>Welcome</h1><img src="images/red.png"></section></main>' },
      { fileName: "about.html", html: '<main><section><h1>About</h1><img src="images/blue.png"></section></main>' },
    ];
    const outcome = await uploadTemplate({ name: "Local images", slug: "test-local-images", websiteType: "BUSINESS", pages, assets: [{ path: "images/red.png", bytes: red }, { path: "images/blue.png", bytes: blue }] }, { uploadedBy: "Tester", ipHash: "test", fetcher: async () => { throw new Error("Must not fetch local images over network"); } });
    expect(outcome).toMatchObject({ ok: true, version: 1 });
    const photos = stored.assets.filter(a => a.path.startsWith("img/"));
    expect(photos).toHaveLength(2);
    expect(photos.every(a => a.path.endsWith(".webp") && !a.path.includes("placeholder"))).toBe(true);
    expect(Buffer.from(photos[0]!.bytes).equals(Buffer.from(photos[1]!.bytes))).toBe(false);
    expect(JSON.parse(Buffer.from(stored.assets.find(a => a.path === "source/design.json")!.bytes).toString()).pages).toEqual(pages);
    expect(stored.assets.some(a => a.path === "source/assets/images/red.png")).toBe(true);
  });
  it("bundles online and embedded images without separate files", async () => {
    const png = await photo();
    const fetcher = vi.fn(async () => response(png));
    const outcome = await uploadTemplate(inputFor(`<img src="https://images.example.com/hero.png"><img src="data:image/png;base64,${png.toString("base64")}">`), { uploadedBy: "Tester", ipHash: "test", fetcher });
    expect(outcome.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(stored.assets.filter(a => a.path.startsWith("img/"))).toHaveLength(2);
  });

  it("rejects failed remote images with exact URLs and reasons before storing a template", async () => {
    const outcome = await uploadTemplate(inputFor('<img src="https://images.example.com/denied.png"><img src="https://images.example.com/missing.png">'), { uploadedBy: "Tester", ipHash: "test", fetcher: async url => ({ ...response(Buffer.alloc(0)), ok: false, status: url.includes("denied") ? 403 : 404 }) });
    expect(outcome).toMatchObject({ ok: false, status: 422 });
    if (outcome.ok) throw new Error("Expected an import failure");
    expect(outcome.error).toContain("https://images.example.com/denied.png”: HTTP 403");
    expect(outcome.error).toContain("https://images.example.com/missing.png”: HTTP 404");
    expect(stored.versions).toHaveLength(0);
  });

  it("reuses stored remote images during HTML edits without network requests or quality loss", async () => {
    const png = await photo();
    const input = inputFor('<img src="https://images.example.com/hero.png">');
    expect((await uploadTemplate(input, { uploadedBy: "Tester", ipHash: "test", fetcher: async () => response(png) })).ok).toBe(true);
    const previous = new Map(stored.assets.filter(a => a.path.startsWith("img/")).map(a => [a.path, Buffer.from(a.bytes)]));
    stored.assets.length = 0;
    const offline = vi.fn(async () => { throw new Error("Host is offline"); });
    expect((await uploadTemplate({ ...input, storedImageFiles: previous }, { uploadedBy: "Tester", ipHash: "test", fetcher: offline })).ok).toBe(true);
    expect(offline).not.toHaveBeenCalled();
    for (const [path, bytes] of previous) expect(Buffer.from(stored.assets.find(a => a.path === path)!.bytes)).toEqual(bytes);
  });

  it("uses the exported Google image URL when the full-size URL is unavailable", async () => {
    const png = await photo();
    const fetcher = vi.fn(async (url: string) => ({ ...response(png), ok: !url.endsWith("=s0"), status: url.endsWith("=s0") ? 403 : 200 }));
    const outcome = await uploadTemplate(inputFor('<img src="https://lh3.googleusercontent.com/photo">'), { uploadedBy: "Tester", ipHash: "test", fetcher });
    expect(outcome.ok).toBe(true);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["https://lh3.googleusercontent.com/photo=s0", "https://lh3.googleusercontent.com/photo"]);
  });

  it("identifies an invalid local image without exposing an internal synthetic address", async () => {
    const outcome = await uploadTemplate({ ...inputFor('<img src="images/broken.png">'), assets: [{ path: "images/broken.png", bytes: Buffer.from("not an image") }] }, { uploadedBy: "Tester", ipHash: "test" });
    expect(outcome).toMatchObject({ ok: false, status: 422 });
    if (outcome.ok) throw new Error("Expected an import failure");
    expect(outcome.error).toContain("images/broken.png in home.html");
    expect(outcome.error).not.toContain("template-assets.invalid");
    expect(stored.versions).toHaveLength(0);
  });

  it("imports embedded SVG image data as a stored raster image", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>';
    const outcome = await uploadTemplate(inputFor(`<img src="data:image/svg+xml,${encodeURIComponent(svg)}">`), { uploadedBy: "Tester", ipHash: "test", fetcher: async () => { throw new Error("No download needed"); } });
    expect(outcome.ok).toBe(true);
    expect(stored.assets.filter(a => a.path.startsWith("img/"))).toHaveLength(1);
  });

});
