import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BuilderLoader } from "@/components/builder/builder-loader";
import { templateReview } from "@/server/builder/template-review";
import { listTemplates } from "@/server/builder/template-registry";
import { mediaEnabled } from "@/server/builder/media";
import { readDevSession } from "@/server/security/dev-session";
import { PageLoading } from "@/components/site/page-loading";
import { findCampaign } from "@/server/services/campaign";
import { getCompanyProfile } from "@/server/services/company";

export const metadata: Metadata = {
  title: "Design your website",
  description: "Drag and drop a page, start from a template or paste your own HTML, then send it to us to build for real.",
  robots: { index: false, follow: false },
};

type BuildPageProps = { searchParams: Promise<{ template?: string | string[]; ref?: string | string[]; review?: string | string[]; version?: string | string[] }> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Full-screen editor: no site header or footer (chrome is opt-in per page). */
export default function BuildPage(props: BuildPageProps) {
  return (
    <Suspense fallback={<PageLoading />}>
      <BuildContent {...props} />
    </Suspense>
  );
}

async function BuildContent({ searchParams }: BuildPageProps) {
  const sp = await searchParams;
  const ref = first(sp.ref);
  const developer = await readDevSession();
  const version = first(sp.version);
  const review = first(sp.review) === "1" ? await templateReview(first(sp.template), !!developer, version) : undefined;
  if (first(sp.review) === "1" && version !== undefined && !review) notFound();
  const [company, campaign, templates] = await Promise.all([
    getCompanyProfile(),
    ref ? findCampaign(ref) : Promise.resolve(null),
    listTemplates({ includeDrafts: !!developer }),
  ]);
  return (
    <main id="main" className="h-dvh">
      <h1 className="sr-only">Design your website</h1>
      <BuilderLoader
        key={review ? `${review.slug}@${review.version}` : "builder"}
        companyName={company.name}
        contactEmail={company.contactEmail}
        refToken={campaign ? ref : undefined}
        requestedTemplate={first(sp.template)}
        templates={templates}
        uploads={mediaEnabled()}
        review={review}
      />
    </main>
  );
}
