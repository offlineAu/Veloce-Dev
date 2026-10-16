/*
 * The font files behind /api/builder/fonts: fetched from Google Fonts on the server, served from this site. Only
 * woff2 files at Google's own font paths; they never change, so they're cached for a year.
 */

export const runtime = "nodejs";

const PATH = /^\/s\/[a-z0-9]+\/v\d+\/[\w-]+\.woff2$/;

export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!PATH.test(path)) return new Response("Not found", { status: 404 });
  const res = await fetch(`https://fonts.gstatic.com${path}`, { cache: "force-cache" }).catch(() => null);
  if (!res?.ok) return new Response("Font unavailable", { status: 502 });
  return new Response(await res.arrayBuffer(), {
    headers: { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" },
  });
}
