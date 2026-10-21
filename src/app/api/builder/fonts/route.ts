import { readBody } from "@/server/security/body";
import { findWebFont } from "@/lib/builder/site-styles";

/*
 * A web font's stylesheet for the builder and design previews (site-styles.ts lists the fonts). Fetched from Google
 * Fonts on the server and rewritten so the font files load from this site too: visitors' browsers never contact a
 * third party. Only families on the list are served; responses are cached for a day (and by the CDN for a year).
 */

export const runtime = "nodejs";

const GSTATIC = /url\(https:\/\/fonts\.gstatic\.com(\/s\/[a-z0-9]+\/v\d+\/[\w-]+\.woff2)\)/g;
// Google sends woff2 (and unicode-range subsets) only to browsers it knows.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function GET(req: Request) {
  const family = new URL(req.url).searchParams.get("family") ?? "";
  const font = findWebFont(family);
  if (!font) return new Response("/* unknown font */", { status: 404, headers: { "Content-Type": "text/css" } });

  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family).replace(/%20/g, "+")}:wght@${font.weights.join(";")}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "force-cache", signal: AbortSignal.timeout(10_000), next: { revalidate: 86_400 } }).catch(() => null);
  if (!res?.ok) return new Response("/* font unavailable */", { status: 502, headers: { "Content-Type": "text/css" } });

  const bytes = await readBody(res, 200_000).catch(() => null);
  if (!bytes) return new Response("/* font response exceeds limits */", { status: 502 });
  const css = new TextDecoder().decode(bytes)
    // Only @font-face rules come back; keep nothing that could load from elsewhere.
    .replace(GSTATIC, (_, path: string) => `url(/api/builder/fonts/file?path=${encodeURIComponent(path)})`)
    .replace(/@import[^;]*;/g, "");
  if (/url\((?!\/api\/builder\/fonts\/file)/.test(css)) return new Response("/* unexpected font source */", { status: 502, headers: { "Content-Type": "text/css" } });
  return new Response(css, {
    headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=31536000", "X-Content-Type-Options": "nosniff" },
  });
}
