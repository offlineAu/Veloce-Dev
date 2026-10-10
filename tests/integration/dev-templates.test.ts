import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import sharp from "sharp";
import { hashPassword } from "@/server/security/password";

// These tests need a reachable PostgreSQL (npm run db:dev, then npm run db:deploy). Skipped otherwise.
const url = process.env.DATABASE_URL;
let reachable = false;
if (url) {
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  reachable = await c.connect().then(() => c.end().then(() => true), () => false);
}
const d = reachable ? describe : describe.skip;

// The password the tests unlock with; the env is read when the env module first loads.
process.env.TEMPLATE_UPLOAD_PASSWORD_HASH = hashPassword("integration-test-password");
process.env.DEV_SESSION_SECRET = "integration-test-session-secret-0123456789";

// Request context (cookies, headers) doesn't exist outside Next: stand in for the session and the client address.
const session = vi.hoisted(() => ({ current: null as { name: string; exp: number } | null }));
vi.mock("@/server/security/dev-session", async (orig) => {
  const real = await orig<typeof import("@/server/security/dev-session")>();
  return {
    ...real,
    readDevSession: async () => session.current,
    requireDevSession: async () => {
      if (!session.current) throw new real.DevAuthError();
      return session.current;
    },
    startDevSession: async (name: string) => void (session.current = { name, exp: Date.now() + 3600_000 }),
    endDevSession: async () => void (session.current = null),
  };
});
vi.mock("@/server/security/request", async (orig) => ({ ...(await orig<object>()), clientKey: async () => "integration-client" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
// Behave like production: drafts are only for developers (locally they'd be visible to everyone).
vi.mock("@/content/builder-templates", async (orig) => ({ ...(await orig<object>()), showDrafts: () => false }));

const SLUG = "it-upload-mini";
const html = readFileSync(path.join(__dirname, "../fixtures/stitch-mini/mini_studio_home/code.html"), "utf8");

d("developer template uploads against a real database", () => {
  let db: typeof import("@/server/db").db;
  let upload: typeof import("@/server/builder/upload-service");
  let registry: typeof import("@/server/builder/template-registry");
  let actions: typeof import("@/server/actions/dev-templates");
  let validation: typeof import("@/server/builder/design-validation");
  let png: Buffer;

  /** Offline stand-in for Google Fonts and image hosts. */
  const fetcher = async (u: string) => {
    const body = u.includes("fonts.googleapis.com") ? Buffer.from("@font-face { font-family: 'Outfit'; src: url(https://fonts.gstatic.com/o.woff2) format('woff2'); }") : u.includes("gstatic") ? Buffer.from("woff2") : png;
    return { ok: true, status: 200, text: async () => body.toString(), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer };
  };
  const send = () => upload.uploadTemplate({ name: "Mini studio", slug: SLUG, websiteType: "BUSINESS", pages: [{ fileName: "home.html", html }] }, { uploadedBy: "Tester", ipHash: "x", fetcher });

  beforeAll(async () => {
    ({ db } = await import("@/server/db"));
    upload = await import("@/server/builder/upload-service");
    registry = await import("@/server/builder/template-registry");
    actions = await import("@/server/actions/dev-templates");
    validation = await import("@/server/builder/design-validation");
    png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#333" } }).png().toBuffer();
    await db.builderTemplate.deleteMany({ where: { slug: { startsWith: "it-" } } });
  });
  beforeEach(async () => {
    session.current = null;
    await db.rateLimit.deleteMany();
  });
  afterAll(async () => {
    await db?.builderTemplate.deleteMany({ where: { slug: { startsWith: "it-" } } });
    await db?.$disconnect();
  });

  it("unlocking: right password opens a session; wrong ones are limited to 5 per 15 minutes", async () => {
    expect(await actions.unlockAction({ password: "nope", name: "Tester" })).toEqual({ ok: false, error: "That password isn't right." });
    expect(await actions.unlockAction({ password: "integration-test-password", name: "" })).toMatchObject({ ok: false });
    expect(await actions.unlockAction({ password: "integration-test-password", name: "Tester" })).toEqual({ ok: true });
    expect(session.current?.name).toBe("Tester");
    for (let i = 0; i < 3; i++) await actions.unlockAction({ password: "nope", name: "Tester" });
    expect(await actions.unlockAction({ password: "integration-test-password", name: "Tester" })).toMatchObject({ ok: false, error: /Too many attempts/ });
  });

  it("actions refuse to run without a session", async () => {
    expect(await actions.publishVersionAction(SLUG, 1)).toMatchObject({ ok: false, error: /session has ended/ });
    expect(await actions.listDevTemplatesAction()).toMatchObject({ ok: false });
  });

  it("upload → draft (developers only) → publish (everyone) → unpublish (old designs keep working)", async () => {
    const out = await send();
    expect(out).toMatchObject({ ok: true, slug: SLUG, version: 1 });
    const assets = await db.builderTemplateAsset.count({ where: { version: { template: { slug: SLUG } } } });
    expect(assets).toBeGreaterThan(0);

    // Draft: invisible to visitors, visible to developers.
    expect((await registry.listTemplates()).some((t) => t.slug === SLUG)).toBe(false);
    expect((await registry.listTemplates({ includeDrafts: true })).find((t) => t.slug === SLUG)).toMatchObject({ draft: true, source: "upload", version: 1 });
    expect(await registry.readTemplate(SLUG, 1)).toBeNull();

    // A design made with the draft is refused for a visitor.
    const { docFromTemplate } = await import("@/lib/builder/template-doc");
    const loaded = (await registry.readTemplate(SLUG, 1, { includeDrafts: true }))!;
    const doc = docFromTemplate(loaded.pkg);
    expect(await validation.checkDesignSections(doc)).toMatch(/no longer available/);

    session.current = { name: "Tester", exp: Date.now() + 60_000 };
    expect(await actions.publishVersionAction(SLUG, 1)).toEqual({ ok: true });
    session.current = null;

    // Published: everyone sees it, a visitor's design passes, its files are served.
    expect((await registry.listTemplates()).find((t) => t.slug === SLUG)).toMatchObject({ draft: false, version: 1 });
    expect(await validation.checkDesignSections(doc)).toBeNull();
    const img = Object.values(loaded.pkg.pages[0]!.sections.flatMap((s) => Object.values(s.defaults))).find((v) => v.startsWith(`/build/t/${SLUG}/v1/img/`));
    expect(img).toBeTruthy();
    expect(await registry.readAsset(SLUG, 1, img!.split("/v1/")[1]!)).toMatchObject({ contentType: "image/webp", draft: false });

    // Unpublished: gone for new sites, still there for designs made with it.
    session.current = { name: "Tester", exp: Date.now() + 60_000 };
    expect(await actions.unpublishVersionAction(SLUG, 1)).toEqual({ ok: true });
    session.current = null;
    expect((await registry.listTemplates()).some((t) => t.slug === SLUG)).toBe(false);
    expect(await registry.readTemplate(SLUG, 1)).toBeNull();
    expect(await registry.readTemplate(SLUG, 1, { requirePublished: false })).not.toBeNull();
  });

  it("re-theming and deleting only touch drafts; versions count up; built-in slugs are refused", async () => {
    const v2 = await send();
    expect(v2).toMatchObject({ ok: true, version: 2 });
    expect(await upload.rethemeDraft(SLUG, 2, { accent: "#d9f5ab", bg: "not-a-colour" })).toMatchObject({ ok: true, theme: { accent: "#d9f5ab", onAccent: "#141312" } });
    expect(await upload.rethemeDraft(SLUG, 1, { accent: "#000000" })).toMatchObject({ ok: false, status: 404 });

    session.current = { name: "Tester", exp: Date.now() + 60_000 };
    expect(await actions.deleteDraftAction(SLUG, 1)).toMatchObject({ ok: false }); // unpublished, not a draft
    expect(await actions.deleteDraftAction(SLUG, 2)).toEqual({ ok: true });

    const clash = await upload.uploadTemplate({ name: "x", slug: "noir-needle", websiteType: "BUSINESS", pages: [{ fileName: "a.html", html }] }, { uploadedBy: "T", ipHash: "x", fetcher });
    expect(clash).toMatchObject({ ok: false, status: 409 });
    const notHtml = await upload.uploadTemplate({ name: "x", slug: "it-x", websiteType: "BUSINESS", pages: [{ fileName: "a.js", html }] }, { uploadedBy: "T", ipHash: "x", fetcher });
    expect(notHtml).toMatchObject({ ok: false, status: 400 });
  });
});
