import type { Metadata } from "next";
import { Suspense } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BuilderLoader } from "@/components/builder/builder-loader";
import type { ReviewInfo } from "@/components/builder/review-banner";
import { currentVersion, findImported, showDrafts } from "@/content/builder-templates";
import { listTemplates } from "@/server/builder/template-registry";
import { db } from "@/server/db";
import { readDevSession } from "@/server/security/dev-session";
import { PageLoading } from "@/components/site/page-loading";
import { findCampaign } from "@/server/services/campaign";
import { getCompanyProfile } from "@/server/services/company";

export const metadata: Metadata = {
  title: "Design your website",
  description: "Drag and drop a page, start from a template or paste your own HTML, then send it to us to build for real.",
  robots: { index: false, follow: false },
};

type BuildPageProps = { searchParams: Promise<{ template?: string | string[]; ref?: string | string[]; review?: string | string[] }> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Full-screen editor: no site header or footer (chrome is opt-in per page). */
export default function BuildPage(props: BuildPageProps) {
  return (
    <Suspense fallback={<PageLoading />}>
      <BuildContent {...props} />
    </Suspense>
  );
}

/**
 * The template being reviewed: an uploaded one (developer session) with its report from the database, or a repo
 * one while developing locally (reports live outside public/).
 */
async function reviewInfo(slug: string | undefined, isDeveloper: boolean): Promise<ReviewInfo | undefined> {
  if (!slug) return undefined;
  if (isDeveloper && !findImported(slug)) {
    const v = await db.builderTemplateVersion.findFirst({
      where: { template: { slug } },
      orderBy: { version: "desc" },
      select: { version: true, status: true, report: true },
    });
    if (v) return { slug, version: v.version, published: v.status === "PUBLISHED", report: v.report, canPublish: true };
  }
  const t = findImported(slug);
  const version = t ? currentVersion(t, true) : undefined;
  if (!showDrafts() || !t || version === undefined) return undefined;
  let report = "";
  try {
    // Development only (see showDrafts above), so the production bundle doesn't need to include the reports.
    report = readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "src/content/builder-templates/reports", `${t.slug}-v${version}.md`), "utf8");
  } catch {
    /* imported without a report */
  }
  return { slug: t.slug, version, published: t.published.includes(version), report, canPublish: false };
}

async function BuildContent({ searchParams }: BuildPageProps) {
  const sp = await searchParams;
  const ref = first(sp.ref);
  const developer = await readDevSession();
  const [company, campaign, templates] = await Promise.all([
    getCompanyProfile(),
    ref ? findCampaign(ref) : Promise.resolve(null),
    listTemplates({ includeDrafts: !!developer }),
  ]);
  return (
    <main id="main" className="h-dvh">
      <h1 className="sr-only">Design your website</h1>
      <BuilderLoader
        companyName={company.name}
        contactEmail={company.contactEmail}
        refToken={campaign ? ref : undefined}
        requestedTemplate={first(sp.template)}
        templates={templates}
        review={first(sp.review) === "1" ? await reviewInfo(first(sp.template), !!developer) : undefined}
      />
    </main>
  );
}
