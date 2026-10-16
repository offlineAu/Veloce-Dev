import { readFileSync } from "node:fs";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, { data: Buffer; uploadedAt: Date }>();
const drafts: { id: string; data: unknown }[] = [];
vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({
  db: { siteDraft: { findMany: async ({ take }: { take: number }) => drafts.slice(0, take) } },
}));
vi.mock("@vercel/blob", () => ({
  put: async (pathname: string, data: Buffer) => {
    store.set(pathname, { data, uploadedAt: new Date() });
    return { pathname, url: `blob:${pathname}` };
  },
  copy: async (from: string, to: string) => {
    const f = store.get(from);
    if (!f) throw new Error("not found");
    store.set(to, { ...f });
    return { pathname: to };
  },
  get: async () => null,
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: [...store.entries()].filter(([p]) => p.startsWith(prefix)).map(([pathname, b]) => ({ pathname, url: `blob:${pathname}`, uploadedAt: b.uploadedAt, size: b.data.length })),
    hasMore: false,
  }),
  del: async (urls: string[]) => urls.forEach((u) => store.delete(u.replace(/^blob:/, ""))),
}));
process.env.BLOB_READ_WRITE_TOKEN = "test";

const { cleanupMedia, keepMedia, storeImage } = await import("@/server/builder/media");
const { isMediaSrc, mediaIdsIn } = await import("@/lib/builder/media");
const { readMotion, writeMotion } = await import("@/lib/builder/motion");
const { bindProps, PLAIN_PARAGRAPHS, textToParagraphs } = await import("@/lib/builder/content");
const { sanitizeRichText } = await import("@/server/builder/sanitize-html");
const { siteDraftSchema } = await import("@/schemas/site-draft");
const { docFromTemplate } = await import("@/lib/builder/template-doc");

beforeEach(() => {
  store.clear();
  drafts.length = 0;
});

const photo = (w = 3000, h = 1500) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#c0392b" } }).jpeg().withMetadata({ exif: { IFD0: { Copyright: "camera-secret" } } }).toBuffer();

describe("uploaded images", () => {
  it("re-encodes to a WebP without metadata, at most 2400px, under a random id", async () => {
    const r = await storeImage(await photo());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isMediaSrc(r.src)).toBe(true);
    expect([r.width, r.height]).toEqual([2400, 1200]);
    const [stored] = [...store.values()];
    const meta = await sharp(stored!.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
  });

  it("refuses files that aren't images, and SVG", async () => {
    expect(await storeImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toMatchObject({ ok: false, status: 415 });
    expect(await storeImage(Buffer.from("not an image at all"))).toMatchObject({ ok: false });
    expect(store.size).toBe(0);
  });

  it("finds upload ids in a site, and only well-formed addresses count", () => {
    const id = "A".repeat(22);
    expect(mediaIdsIn(JSON.stringify({ a: `/api/builder/media/${id}.webp`, b: `/api/builder/media/${id}.webp` }))).toEqual([id]);
    expect(isMediaSrc(`/api/builder/media/${id}.webp?x`)).toBe(false);
    expect(isMediaSrc("/api/builder/media/../secret.webp")).toBe(false);
  });

  it("keeps a sent design's uploads, and cleans up old uploads and kept ones no design uses", async () => {
    const used = await storeImage(await photo(400, 300));
    const unused = await storeImage(await photo(400, 300));
    if (!used.ok || !unused.ok) throw new Error("upload failed");
    const site = JSON.stringify({ pages: [{ src: used.src }] });
    await keepMedia(site);
    expect([...store.keys()].filter((k) => k.includes("/kept/"))).toHaveLength(1);

    // 31 days on: the unused upload goes; the used one is kept while its design exists.
    drafts.push({ id: "d1", data: JSON.parse(site) });
    const later = Date.now() + 31 * 86_400_000;
    expect(await cleanupMedia({ dryRun: true, now: later })).toEqual({ uploadsDeleted: 2, keptDeleted: 0, dryRun: true });
    await cleanupMedia({ dryRun: false, now: later });
    expect([...store.keys()]).toEqual([expect.stringContaining("/kept/")]);

    // Its design deleted (privacy retention): the kept file goes too.
    drafts.length = 0;
    expect(await cleanupMedia({ dryRun: false, now: later })).toMatchObject({ keptDeleted: 1 });
    expect(store.size).toBe(0);
  });

  it("accepts uploaded images in a submitted design", async () => {
    const pkg = JSON.parse(readFileSync("public/builder-templates/noir-needle/v1/template.json", "utf8"));
    const doc = docFromTemplate(pkg, "pieces");
    const src = `/api/builder/media/${"b".repeat(22)}.webp`;
    doc.pages[0]!.data.content.push({ type: "DImage", props: { id: "DImage-up", className: "", src, alt: "" } });
    const ok = await siteDraftSchema.safeParseAsync({ templateId: "noir-needle", data: doc });
    expect(ok.success).toBe(true);
    doc.pages[0]!.data.content.push({ type: "DImage", props: { id: "DImage-bad", className: "", src: "/api/builder/media/x.svg", alt: "" } });
    expect((await siteDraftSchema.safeParseAsync({ templateId: "noir-needle", data: doc })).success).toBe(false);
  });
});

describe("animations", () => {
  it("sets one entrance and one hover effect, and ignores unknown ones", () => {
    let c = writeMotion("vt:p-4", "enter", "vt-enter-rise");
    c = writeMotion(c, "hover", "vt-hover-lift");
    expect(c).toBe("vt:p-4 vt-enter-rise vt-hover-lift");
    expect(readMotion(writeMotion(c, "enter", "vt-enter-fade"))).toEqual({ enter: "vt-enter-fade", hover: "vt-hover-lift" });
    expect(writeMotion(c, "enter", "vt-enter-explode")).toBe("vt:p-4 vt-hover-lift");
    expect(writeMotion(c, "hover", "")).toBe("vt:p-4 vt-enter-rise");
  });
});

describe("rich text", () => {
  it("keeps the editor's formatting and removes everything else when a design is stored", () => {
    const dirty = '<h2>Hi</h2><p onclick="x()">A <strong>b</strong> <a href="javascript:alert(1)">bad</a> <a href="https://ok.test">ok</a></p><script>alert(1)</script><img src=x onerror=alert(1)><h1>big</h1>';
    const clean = sanitizeRichText(dirty);
    expect(clean).toContain("<h2>Hi</h2>");
    expect(clean).toContain("<strong>b</strong>");
    expect(clean).toContain('<a href="https://ok.test" rel="noopener noreferrer">ok</a>');
    expect(clean).not.toMatch(/script|onclick|onerror|javascript|<img|<h1/);
  });

  it("shows a collection field as escaped paragraphs, never as HTML", () => {
    const html = textToParagraphs("First <b>line</b>\nsecond line\n\n<script>alert(1)</script>");
    expect(html).toBe("<p>First &lt;b&gt;line&lt;/b&gt;<br>second line</p><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(PLAIN_PARAGRAPHS.test(html)).toBe(true);
    expect(PLAIN_PARAGRAPHS.test("<p>x</p><img src=x onerror=alert(1)>")).toBe(false);
    const c = { id: "blog", name: "Blog", itemName: "post", fields: [{ key: "body", label: "Text", type: "longtext" as const }], items: [] };
    const bound = bindProps({ type: "DRich", props: { html: "<p>old</p>", bind: { rich: "body" } } }, c, { id: "i-1", slug: "a", values: { body: "Hello" } }, undefined);
    expect(bound.props.html).toBe("<p>Hello</p>");
  });

  it("is cleaned when a design is sent", async () => {
    const pkg = JSON.parse(readFileSync("public/builder-templates/noir-needle/v1/template.json", "utf8"));
    const doc = docFromTemplate(pkg, "pieces");
    doc.pages[0]!.data.content.push({ type: "DRich", props: { id: "DRich-1", className: "", html: "<p>Hi<script>alert(1)</script></p>" } });
    const r = await siteDraftSchema.parseAsync({ templateId: "noir-needle", data: doc });
    expect(r.data.pages[0]!.data.content.at(-1)!.props.html).toBe("<p>Hi</p>");
  });
});
