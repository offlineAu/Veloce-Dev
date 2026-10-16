import { isPublishedVersion, readAsset, readTemplate } from "@/server/builder/template-registry";
import { readDevSession } from "@/server/security/dev-session";

/*
 * The files of a template version: its package, stylesheet, fonts, images and thumbnails, for repo and uploaded
 * templates alike. Published versions never change, so they are cached for a year; drafts are only served to
 * developers and never cached (they can still be re-themed). Unpublished versions keep serving, so designs that
 * were made with them still open; they're checked again on every load, because one not yet published can still be
 * imported again in its place (`template:import --force`).
 */

export const dynamic = "force-dynamic";

const IMMUTABLE = "public, max-age=31536000, immutable";
const PRIVATE = "private, no-store";
const REVALIDATE = "public, no-cache";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; version: string; path: string[] }> }) {
  const { slug, version: v, path } = await ctx.params;
  const version = Number(v.replace(/^v/, ""));
  const file = path.join("/");
  const includeDrafts = !!(await readDevSession());
  const access = { includeDrafts, requirePublished: false };
  // Only a published version is final.
  const published = () => isPublishedVersion(slug, version);

  if (file === "template.json" || file === "theme.css") {
    const t = await readTemplate(slug, version, access);
    if (!t) return new Response("Not found", { status: 404 });
    // Is this exact version a draft? Only if visitors couldn't load it.
    const draft = includeDrafts && !(await readTemplate(slug, version, { requirePublished: false }));
    // Changes whenever the version is imported again, so the editor's check ("still the same?") is a quick yes.
    const etag = `"${slug}-${version}-${(t.pkg.importedAt ?? "").replace(/\W/g, "")}-${file === "theme.css" ? "css" : "json"}"`;
    const headers = { "Cache-Control": draft ? PRIVATE : (await published()) ? IMMUTABLE : REVALIDATE, ETag: etag, "X-Content-Type-Options": "nosniff" };
    if (!draft && req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return file === "template.json"
      ? new Response(JSON.stringify(t.pkg), { headers: { ...headers, "Content-Type": "application/json" } })
      : new Response(t.css, { headers: { ...headers, "Content-Type": "text/css; charset=utf-8" } });
  }

  const asset = await readAsset(slug, version, file, access);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.bytes), {
    headers: { "Content-Type": asset.contentType, "Cache-Control": asset.draft ? PRIVATE : (await published()) ? IMMUTABLE : REVALIDATE, "X-Content-Type-Options": "nosniff" },
  });
}
