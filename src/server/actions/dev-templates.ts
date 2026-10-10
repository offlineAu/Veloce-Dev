"use server";

import { revalidatePath } from "next/cache";
import { env } from "@/config/env";
import { IMPORTED_TEMPLATES } from "@/content/builder-templates";
import { db } from "@/server/db";
import { allow } from "@/server/security/rate-limit";
import { clientKey } from "@/server/security/request";
import { DevAuthError, devUploadsEnabled, endDevSession, readDevSession, requireDevSession, startDevSession, verifyPassword } from "@/server/security/dev-session";

/*
 * Developer actions for uploaded templates. Each one checks the developer session itself: the panel being open in
 * the browser proves nothing.
 */

export type DevResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const SESSION_ENDED = "Your developer session has ended. Unlock the panel again.";

async function guarded<T extends object>(fn: () => Promise<DevResult<T>>): Promise<DevResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DevAuthError) return { ok: false, error: SESSION_ENDED };
    console.error("[dev-templates]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function devStatusAction(): Promise<{ enabled: boolean; name: string | null }> {
  return { enabled: devUploadsEnabled(), name: (await readDevSession())?.name ?? null };
}

/** Wrong passwords are limited per address and site-wide; the answer never says which part was wrong. */
export async function unlockAction(input: { password: string; name: string }): Promise<DevResult> {
  if (!devUploadsEnabled()) return { ok: false, error: "Template uploads aren't set up on this site." };
  const key = await clientKey();
  const withinLimits = (await allow(`devpw:ip:${key}`, 5, 15 * 60_000)) && (await allow("devpw:all", 30, 3600_000));
  if (!withinLimits) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };
  const name = String(input.name ?? "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 40);
  if (!name) return { ok: false, error: "Add your name, so uploads show who made them." };
  if (!verifyPassword(String(input.password ?? ""), env().TEMPLATE_UPLOAD_PASSWORD_HASH!)) return { ok: false, error: "That password isn't right." };
  await startDevSession(name);
  return { ok: true };
}

export async function lockAction(): Promise<void> {
  await endDevSession();
}

export interface UploadedVersion {
  version: number;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  uploadedBy: string;
  createdAt: string;
}
export interface DevTemplateRow {
  slug: string;
  name: string;
  source: "repo" | "upload";
  versions: UploadedVersion[];
}

export async function listDevTemplatesAction(): Promise<DevResult<{ templates: DevTemplateRow[] }>> {
  return guarded(async () => {
    await requireDevSession();
    const uploads = await db.builderTemplate.findMany({
      orderBy: { createdAt: "desc" },
      select: { slug: true, name: true, versions: { orderBy: { version: "desc" }, select: { version: true, status: true, uploadedBy: true, createdAt: true } } },
    });
    const templates: DevTemplateRow[] = [
      ...uploads.map((t) => ({ slug: t.slug, name: t.name, source: "upload" as const, versions: t.versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })) })),
      ...IMPORTED_TEMPLATES.map((t) => ({
        slug: t.slug,
        name: t.name,
        source: "repo" as const,
        versions: t.versions.map((v) => ({ version: v, status: (t.published.includes(v) ? "PUBLISHED" : "DRAFT") as UploadedVersion["status"], uploadedBy: "CLI", createdAt: t.importedAt })),
      })),
    ];
    return { ok: true, templates };
  });
}

async function setStatus(slug: string, version: number, status: "PUBLISHED" | "UNPUBLISHED"): Promise<DevResult> {
  return guarded(async () => {
    await requireDevSession();
    const updated = await db.builderTemplateVersion.updateMany({
      where: { version, template: { slug }, status: status === "PUBLISHED" ? { in: ["DRAFT", "UNPUBLISHED"] } : "PUBLISHED" },
      data: { status, ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
    });
    if (!updated.count) return { ok: false, error: "That version can't be changed (it may already be in that state)." };
    revalidatePath("/build");
    return { ok: true };
  });
}

/** Instantly visible to visitors in the template picker. */
export async function publishVersionAction(slug: string, version: number): Promise<DevResult> {
  return setStatus(slug, version, "PUBLISHED");
}

/** Hidden from new sites; designs already made with it keep working. */
export async function unpublishVersionAction(slug: string, version: number): Promise<DevResult> {
  return setStatus(slug, version, "UNPUBLISHED");
}

/** Only never-published versions can be deleted, so no visitor's design can lose its template. */
export async function deleteDraftAction(slug: string, version: number): Promise<DevResult> {
  return guarded(async () => {
    await requireDevSession();
    const deleted = await db.builderTemplateVersion.deleteMany({ where: { version, status: "DRAFT", template: { slug } } });
    if (!deleted.count) return { ok: false, error: "Only drafts can be deleted." };
    await db.builderTemplate.deleteMany({ where: { slug, versions: { none: {} } } });
    revalidatePath("/build");
    return { ok: true };
  });
}
