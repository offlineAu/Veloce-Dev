import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/builder/media";
import { mediaEnabled, storeImage } from "@/server/builder/media";
import { allow } from "@/server/security/rate-limit";
import { clientKey } from "@/server/security/request";

/*
 * Image upload from the builder. Open to visitors like the builder itself, so: this site's pages only, images only,
 * 5 MB, re-encoded before storing (server/builder/media.ts), and limited per address.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  // Only the builder on this site may upload (browsers always send Origin on a cross-site POST).
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) return json({ error: "Uploads only work from the builder." }, 403);
  if (!mediaEnabled()) return json({ error: "Image upload isn't available right now. Paste an image address instead." }, 503);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64_000) return json({ error: "That image is over 5 MB. Try a smaller one." }, 413);

  const key = await clientKey();
  if (!(await allow(`media:h:${key}`, 30, 3600_000)) || !(await allow(`media:d:${key}`, 100, 86_400_000)))
    return json({ error: "That's a lot of uploads in a short time. Try again later." }, 429);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "Choose an image to upload." }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: "That image is over 5 MB. Try a smaller one." }, 413);

  try {
    const r = await storeImage(Buffer.from(await file.arrayBuffer()));
    return r.ok ? json({ src: r.src, width: r.width, height: r.height }, 201) : json({ error: r.error }, r.status);
  } catch (e) {
    console.error("[builder-media]", e);
    return json({ error: "The upload didn't go through. Please try again." }, 502);
  }
}
