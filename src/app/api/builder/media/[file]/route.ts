import { readMedia } from "@/server/builder/media";

/** An uploaded image (lib/builder/media.ts). Ids are random and files never change, so they cache for good. */

export const runtime = "nodejs";

const FILE = /^([A-Za-z0-9_-]{22})\.webp$/;

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const m = FILE.exec((await params).file);
  if (!m) return new Response(null, { status: 404 });
  const r = await readMedia(m[1]!, req.headers.get("if-none-match") ?? undefined);
  if (!r) return new Response(null, { status: 404 });
  const headers = {
    "Content-Type": "image/webp",
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: r.blob.etag,
    "X-Content-Type-Options": "nosniff",
    // Opened on its own, it's an image and nothing else.
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  return r.statusCode === 304 ? new Response(null, { status: 304, headers }) : new Response(r.stream, { headers });
}
