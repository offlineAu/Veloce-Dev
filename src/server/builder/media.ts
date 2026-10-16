import "server-only";
import { randomBytes } from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { copy, del, get, list, put, type GetBlobResult } from "@vercel/blob";
import { mediaIdsIn, mediaSrc, MAX_UPLOAD_BYTES } from "@/lib/builder/media";
import { db } from "@/server/db";

/*
 * Builder uploads (lib/builder/media.ts has the address rules). Every upload is decoded and re-encoded here, so what's
 * stored is a plain WebP: no metadata (location, camera), nothing hidden in the file, no SVG. Files live in a private
 * Blob store under two prefixes:
 *   tmp/   uploaded in the builder; deleted 30 days after upload unless a sent design uses them
 *   kept/  used by a sent design; deleted once no stored design refers to them (drafts go when their lead is deleted)
 */

const TMP = "builder-media/tmp/";
const KEPT = "builder-media/kept/";
const TMP_DAYS = 30;
/** Kept files younger than this are never cleaned up, so a design being sent right now can't lose them. */
const KEPT_GRACE_MS = 24 * 3600_000;
const MAX_SIDE = 2400;
const FORMATS = new Set(["jpeg", "png", "webp", "gif", "heif"]);

/** Whether this server can store uploads (a Blob store is connected). */
export const mediaEnabled = () => !!(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));

export type StoreOutcome = { ok: true; src: string; width: number; height: number } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): StoreOutcome => ({ ok: false, status, error });

export async function storeImage(bytes: Buffer): Promise<StoreOutcome> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return fail(413, "That image is over 5 MB. Try a smaller one.");
  let out: { data: Buffer; info: OutputInfo };
  try {
    const input = sharp(bytes, { animated: true, limitInputPixels: 40_000_000, failOn: "error" });
    const meta = await input.metadata();
    // AVIF reads as "heif"; HEIC photos too, which browsers can't show, so only AV1-coded HEIF is taken.
    if (!meta.format || !FORMATS.has(meta.format) || (meta.format === "heif" && meta.compression !== "av1")) return fail(415, "Use a JPEG, PNG, WebP, AVIF or GIF image.");
    out = await input
      .rotate() // upright, from the photo's orientation, before the metadata goes
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return fail(415, "That file couldn't be read as an image.");
  }
  const id = randomBytes(16).toString("base64url");
  await put(`${TMP}${id}.webp`, out.data, { access: "private", contentType: "image/webp", addRandomSuffix: false });
  // An animated image's height is all its frames stacked.
  const pages = out.info.pages ?? 1;
  return { ok: true, src: mediaSrc(id), width: out.info.width, height: Math.round(out.info.height / pages) };
}

/** An uploaded image, wherever it is now (kept, or still in the builder's uploads). */
export async function readMedia(id: string, ifNoneMatch?: string): Promise<GetBlobResult | null> {
  for (const prefix of [KEPT, TMP]) {
    const r = await get(`${prefix}${id}.webp`, { access: "private", ifNoneMatch }).catch(() => null);
    if (r) return r;
  }
  return null;
}

/** Moves the uploads a sent design uses out of the 30-day uploads, so they stay as long as the design does. */
export async function keepMedia(siteJson: string): Promise<void> {
  if (!mediaEnabled()) return;
  await Promise.all(
    mediaIdsIn(siteJson).map(async (id) => {
      try {
        await copy(`${TMP}${id}.webp`, `${KEPT}${id}.webp`, { access: "private", contentType: "image/webp", addRandomSuffix: false, allowOverwrite: true });
      } catch {
        // Already kept (sent before, in another design) or gone (older than 30 days): nothing to keep.
      }
    }),
  );
}

async function* blobsUnder(prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    yield* page.blobs;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}

/** Every upload id a stored design still refers to. */
async function idsInDrafts(): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    const rows = await db.siteDraft.findMany({ select: { id: true, data: true }, orderBy: { id: "asc" }, take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    for (const r of rows) for (const id of mediaIdsIn(JSON.stringify(r.data))) ids.add(id);
    if (rows.length < 200) return ids;
    cursor = rows.at(-1)!.id;
  }
}

/** Deletes builder uploads older than 30 days and kept files no stored design uses. `dryRun` only counts them. */
export async function cleanupMedia({ dryRun = true, now = Date.now() }: { dryRun?: boolean; now?: number } = {}) {
  if (!mediaEnabled()) return { uploadsDeleted: 0, keptDeleted: 0, dryRun };
  const stale: string[] = [];
  for await (const b of blobsUnder(TMP)) if (now - b.uploadedAt.getTime() > TMP_DAYS * 86_400_000) stale.push(b.url);
  const used = await idsInDrafts();
  const orphans: string[] = [];
  for await (const b of blobsUnder(KEPT)) {
    const id = b.pathname.slice(KEPT.length).replace(/\.webp$/, "");
    if (!used.has(id) && now - b.uploadedAt.getTime() > KEPT_GRACE_MS) orphans.push(b.url);
  }
  if (!dryRun)
    for (let i = 0; i < stale.length + orphans.length; i += 500) await del([...stale, ...orphans].slice(i, i + 500));
  return { uploadsDeleted: stale.length, keptDeleted: orphans.length, dryRun };
}
