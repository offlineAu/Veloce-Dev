/*
 * Images visitors upload in the builder. They're stored privately (Vercel Blob, server/builder/media.ts) and shown
 * through this site at /api/builder/media/<id>.webp: one random id per upload, always re-encoded to WebP. No React.
 */

export const MEDIA_PREFIX = "/api/builder/media/";
/** An uploaded image's address, exactly as the server hands it out. */
export const MEDIA_SRC = /^\/api\/builder\/media\/[A-Za-z0-9_-]{22}\.webp$/;
const MEDIA_IN_TEXT = /\/api\/builder\/media\/([A-Za-z0-9_-]{22})\.webp/g;

export const MAX_UPLOAD_BYTES = 5_000_000;
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export const isMediaSrc = (v: unknown): boolean => typeof v === "string" && MEDIA_SRC.test(v);
export const mediaSrc = (id: string) => `${MEDIA_PREFIX}${id}.webp`;

/** The upload ids a site (or any JSON text) refers to. */
export function mediaIdsIn(text: string): string[] {
  return [...new Set([...text.matchAll(MEDIA_IN_TEXT)].map((m) => m[1]!))];
}
