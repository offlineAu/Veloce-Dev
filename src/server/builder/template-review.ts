import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { currentVersion, findImported, showDrafts } from "@/content/builder-templates";
import type { ReviewInfo } from "@/components/builder/review-banner";
import { db } from "@/server/db";

/** Resolve an exact review version without falling back to a different version. */
export async function templateReview(slug: string | undefined, isDeveloper: boolean, requestedVersion?: string): Promise<ReviewInfo | undefined> {
  if (!slug || !/^[a-z0-9-]{1,40}$/.test(slug)) return undefined;
  const version = requestedVersion === undefined ? undefined : Number(requestedVersion);
  if (requestedVersion !== undefined && (!/^[1-9]\d*$/.test(requestedVersion) || !Number.isSafeInteger(version))) return undefined;
  const repo = findImported(slug);
  if (!repo) {
    if (!isDeveloper) return undefined;
    const row = await db.builderTemplateVersion.findFirst({
      where: { template: { slug }, ...(version === undefined ? {} : { version }) },
      orderBy: { version: "desc" },
      select: { version: true, status: true, report: true },
    });
    return row ? { slug, version: row.version, published: row.status === "PUBLISHED", report: row.report, canPublish: true } : undefined;
  }
  if (!isDeveloper && !showDrafts()) return undefined;
  const selected = version ?? currentVersion(repo, true);
  if (selected === undefined || !repo.versions.includes(selected)) return undefined;
  let report = "";
  try {
    report = readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "src/content/builder-templates/reports", `${repo.slug}-v${selected}.md`), "utf8");
  } catch { /* A CLI template may not have an import report. */ }
  return { slug: repo.slug, version: selected, published: repo.published.includes(selected), report, canPublish: false };
}
