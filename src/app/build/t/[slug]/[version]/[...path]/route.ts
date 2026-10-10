import { readAsset, readTemplate } from "@/server/builder/template-registry";
import { readDevSession } from "@/server/security/dev-session";

/*
 * The files of a template version: its package, stylesheet, fonts, images and thumbnails, for repo and uploaded
 * templates alike. Published versions never change, so they are cached for a year; drafts are only served to
 * developers and never cached (they can still be re-themed). Unpublished versions keep serving, so designs that
 * were made with them still open.
 */

export const dynamic = "force-dynamic";

const IMMUTABLE = "public, max-age=31536000, immutable";
const PRIVATE = "private, no-store";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; version: string; path: string[] }> }) {
  const { slug, version: v, path } = await ctx.params;
  const version = Number(v.replace(/^v/, ""));
  const file = path.join("/");
  const includeDrafts = !!(await readDevSession());
  const access = { includeDrafts, requirePublished: false };

  if (file === "template.json" || file === "theme.css") {
    const t = await readTemplate(slug, version, access);
    if (!t) return new Response("Not found", { status: 404 });
    // Is this exact version a draft? Only if visitors couldn't load it.
    const draft = includeDrafts && !(await readTemplate(slug, version, { requirePublished: false }));
    const headers = { "Cache-Control": draft ? PRIVATE : IMMUTABLE, "X-Content-Type-Options": "nosniff" };
    return file === "template.json"
      ? new Response(JSON.stringify(t.pkg), { headers: { ...headers, "Content-Type": "application/json" } })
      : new Response(t.css, { headers: { ...headers, "Content-Type": "text/css; charset=utf-8" } });
  }

  const asset = await readAsset(slug, version, file, access);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.bytes), {
    headers: { "Content-Type": asset.contentType, "Cache-Control": asset.draft ? PRIVATE : IMMUTABLE, "X-Content-Type-Options": "nosniff" },
  });
}
