import type { Metadata } from "next";
import { Suspense } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BuilderLoader } from "@/components/builder/builder-loader";
import type { ReviewInfo } from "@/components/builder/review-banner";
import { currentVersion, findImported, showDrafts } from "@/content/builder-templates";
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

/** While developing, the import report of the template being reviewed (reports live outside public/). */
function reviewInfo(slug: string | undefined): ReviewInfo | undefined {
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
  return { slug: t.slug, version, published: t.published.includes(version), report };
}

async function BuildContent({ searchParams }: BuildPageProps) {
  const sp = await searchParams;
  const ref = first(sp.ref);
  const [company, campaign] = await Promise.all([getCompanyProfile(), ref ? findCampaign(ref) : Promise.resolve(null)]);
  return (
    <main id="main" className="h-dvh">
      <h1 className="sr-only">Design your website</h1>
      <BuilderLoader
        companyName={company.name}
        contactEmail={company.contactEmail}
        refToken={campaign ? ref : undefined}
        requestedTemplate={first(sp.template)}
        review={first(sp.review) === "1" ? reviewInfo(first(sp.template)) : undefined}
      />
    </main>
  );
}
