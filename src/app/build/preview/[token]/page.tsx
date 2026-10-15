import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { DraftRender } from "@/components/builder/draft-render";
import { findSample } from "@/content/samples";
import { landing } from "@/content/site";
import { migrateDoc, pageRefs, type SiteDoc } from "@/lib/builder/site-doc";
import { docFromTemplate } from "@/lib/builder/template-doc";
import { isWellFormedToken } from "@/lib/token";
import { pieceClasses } from "@/lib/builder/elements";
import type { BlockItem } from "@/lib/builder/blocks";
import { compileExtraCss, validClasses } from "@/server/builder/css-service";
import { readTemplate } from "@/server/builder/template-registry";
import { db } from "@/server/db";

// A visitor's private design: never indexed or cached. The unguessable token is the only key.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Site design preview",
  robots: { index: false, follow: false, nocache: true },
};

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ page?: string | string[] }> };

/** What the preview shows: a visitor's submitted design, or one of the home page's sample sites (src/content/samples.ts). */
type Preview = { doc: SiteDoc; note: string; startSlug?: string };

async function loadPreview(token: string): Promise<Preview | null> {
  const sample = findSample(token);
  if (sample) {
    const loaded = await readTemplate(sample.slug, sample.version, { requirePublished: false });
    return loaded ? { doc: docFromTemplate(loaded.pkg), note: "Sample design.", startSlug: sample.slug } : null;
  }
  const draft = await db.siteDraft.findUnique({ where: { token }, select: { data: true, createdAt: true } });
  const doc = draft ? migrateDoc(draft.data) : null;
  if (!draft || !doc) return null;
  return { doc, note: `Design preview, submitted ${draft.createdAt.toLocaleDateString("en", { dateStyle: "medium" })}.` };
}

export default async function DraftPreviewPage({ params, searchParams }: Props) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  if (!isWellFormedToken(token)) notFound();
  const preview = await loadPreview(token);
  if (!preview) notFound();
  const { doc } = preview;

  const wanted = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = doc.pages.find((p) => p.path === wanted) ?? doc.pages[0]!;
  // Designs stay on the template version they were made with, even after the template is updated.
  const template = doc.templateRef ? ((await readTemplate(doc.templateRef.slug, doc.templateRef.version, { requirePublished: false, includeDrafts: true })) ?? undefined) : undefined;
  // Classes the visitor added that the template's stylesheet lacks, compiled (and cached) on the server.
  const classes = validClasses(pieceClasses((page.data.content ?? []) as BlockItem[]));
  const extraCss = classes.length
    ? ((await compileExtraCss(doc.templateRef && template ? doc.templateRef : { site: doc.theme }, classes, { includeDrafts: true }).catch(() => null)) ?? "")
    : "";

  return (
    <>
      {/* Pinned to the bottom: designs often have their own fixed header at the top. */}
      <div className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-ink px-4 py-2 text-sm text-bg shadow-lg">
        {preview.startSlug ? (
          // Back to the home page's samples, with this sample in front.
          <Link href={`/?sample=${encodeURIComponent(token)}#services`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold hover:bg-bg/15">
            <ArrowLeft aria-hidden className="size-4" />
            {landing.samples.back}
          </Link>
        ) : null}
        <p>{preview.note} Links and forms are placeholders.</p>
        {doc.pages.length > 1 ? (
          <nav aria-label="Pages in this design">
            <ul className="flex flex-wrap gap-1">
              {doc.pages.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`?page=${encodeURIComponent(p.path)}`}
                    aria-current={p.id === page.id ? "page" : undefined}
                    className="rounded-full px-3 py-1 underline-offset-2 hover:underline aria-[current=page]:bg-bg aria-[current=page]:text-ink"
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {preview.startSlug ? (
          <Link href={`/build?template=${encodeURIComponent(preview.startSlug)}`} className="rounded-full bg-bg px-3 py-1 font-semibold text-ink hover:opacity-90">
            Start from this design
          </Link>
        ) : null}
      </div>
      <main id="main" className="pb-24">
        <DraftRender page={page} pages={pageRefs(doc)} template={template} extraCss={extraCss} />
      </main>
    </>
  );
}
