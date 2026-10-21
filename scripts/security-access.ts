import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { db } from "../src/server/db";
import { grantHash, CASE_SLUG } from "../src/server/portfolio/access";
import { watermarkedPreview } from "../src/lib/security/watermark";
import { z } from "zod";

const manifestSchema = z.object({ slug: z.string().max(60).regex(CASE_SLUG), title: z.string().min(1).max(200), summary: z.string().max(10_000), images: z.array(z.object({ source: z.string().min(1), name: z.string().regex(/^[a-z0-9-]{1,80}$/), alt: z.string().max(500) })).min(1).max(30) });
async function main() {
  const [command, value, daysValue = "7"] = process.argv.slice(2);
  if (command === "logout-all" && (value === "owner" || value === "developer")) {
    const result = await db.securitySession.updateMany({ where: { kind: value, revokedAt: null }, data: { revokedAt: new Date() } });
    console.log(`Revoked ${result.count} ${value} sessions.`); return;
  }
  if (command === "revoke" && value) {
    await db.privateAccessGrant.update({ where: { id: value }, data: { revokedAt: new Date() } });
    console.log("Invitation revoked."); return;
  }
  if (command === "invite" && value && CASE_SLUG.test(value)) {
    const days = Number(daysValue);
    if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error("Use 1–30 days");
    const token = randomBytes(32).toString("base64url");
    const grant = await db.privateAccessGrant.create({ data: { caseSlug: value, tokenHash: grantHash(token), expiresAt: new Date(Date.now() + days * 86400_000) } });
    // Explicit operator command: display this once, never send it to application logs.
    console.log(`Grant ID: ${grant.id}\nPage: /private/${value}\nInvitation (share separately from the URL): ${token}`); return;
  }
  if (command === "publish-private" && value) {
    const manifestPath = path.resolve(value);
    const input = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
    if (new Set(input.images.map(image => image.name)).size !== input.images.length) throw new Error("Duplicate image names");
    const images: { file: string; alt: string }[] = [];
    for (const image of input.images) {
      const original = readFileSync(path.resolve(path.dirname(manifestPath), image.source));
      if (original.length > 15_000_000) throw new Error("Original exceeds 15 MB");
      const file = `${image.name}.webp`;
      const preview = await watermarkedPreview(original);
      await put(`portfolio-private/${input.slug}/${file}`, preview, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "image/webp" });
      images.push({ file, alt: image.alt });
    }
    await db.privateCaseStudy.upsert({ where: { slug: input.slug }, create: { slug: input.slug, title: input.title, summary: input.summary, images }, update: { title: input.title, summary: input.summary, images } });
    console.log("Private previews stored. Originals remain in their local source location."); return;
  }
  throw new Error("Usage: security:access logout-all owner|developer; invite <slug> [1–30 days]; revoke <grant-id>; publish-private <manifest.json>");
}
main().catch(error => { console.error(error instanceof z.ZodError ? "Invalid private case manifest." : "Security access command failed. Check the command, database, storage and local files."); process.exitCode = 1; }).finally(() => db.$disconnect());
