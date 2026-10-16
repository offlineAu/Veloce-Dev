import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { DraftRender } from "@/components/builder/draft-render";
import { findSample } from "@/content/samples";
import { landing } from "@/content/site";
import { migrateDoc, pageRefs, type SiteDoc, type SitePage } from "@/lib/builder/site-doc";
import { isMediaSrc } from "@/lib/builder/media";
import { splitItemPath, type CollectionItem, type PageSeo } from "@/lib/builder/content";
import { docFromTemplate } from "@/lib/builder/template-doc";
import { isWellFormedToken } from "@/lib/token";
import { pieceClasses } from "@/lib/builder/elements";
import { styleClassList } from "@/lib/builder/site-styles";
import type { BlockItem } from "@/lib/builder/blocks";
import { compileExtraCss, validClasses } from "@/server/builder/css-service";
import { readTemplate } from "@/server/builder/template-registry";
import { db } from "@/server/db";

// A visitor's private design: never indexed or cached. The unguessable token is the only key.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ page?: string | string[] }> };

const NO_INDEX: Metadata["robots"] = { index: false, follow: false, nocache: true };

/** What the preview shows: a visitor's submitted design, or one of the home page's sample sites (src/content/samples.ts). */
type Preview = { doc: SiteDoc; note: string; startSlug?: string };

// Once per request: the page and its metadata both need it.
const loadPreview = cache(async (token: string): Promise<Preview | null> => {
  const sample = findSample(token);
  if (sample) {
    const loaded = await readTemplate(sample.slug, sample.version, { requirePublished: false });
    return loaded ? { doc: docFromTemplate(loaded.pkg), note: "Sample design.", startSlug: sample.slug } : null;
  }
  const draft = await db.siteDraft.findUnique({ where: { token }, select: { data: true, createdAt: true } });
  const doc = draft ? migrateDoc(draft.data) : null;
  if (!draft || !doc) return null;
  return { doc, note: `Design preview, submitted ${draft.createdAt.toLocaleDateString("en", { dateStyle: "medium" })}.` };
});

/**
 * The page an address shows: a page by its path, or a collection item on that collection's item page
 * ("/blog/first-post", or "/first-post" when the home page shows the items). Unknown addresses show the first page.
 */
function resolvePage(doc: SiteDoc, wanted: string | undefined): { page: SitePage; item?: CollectionItem } {
  const exact = doc.pages.find((p) => p.path === wanted);
  if (exact || !wanted) return { page: exact ?? doc.pages[0]! };
  const split = splitItemPath(wanted);
  const at = split.slug ? { path: split.page, slug: split.slug } : { path: "/", slug: wanted.replace(/^\//, "") };
  const page = doc.pages.find((p) => p.path === at.path && typeof p.data.root.props?.itemsOf === "string");
  const c = page && doc.collections?.find((x) => x.id === page.data.root.props?.itemsOf);
  const item = c?.items.find((i) => i.slug === at.slug);
  return page && item ? { page, item } : { page: doc.pages[0]! };
}

const wantedOf = (sp: { page?: string | string[] }) => (Array.isArray(sp.page) ? sp.page[0] : sp.page);

/** The page's own search details (Page settings), or an item's title and summary on an item page. Never indexed. */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const fallback: Metadata = { title: "Site design preview", robots: NO_INDEX };
  if (!isWellFormedToken(token)) return fallback;
  const preview = await loadPreview(token);
  if (!preview) return fallback;
  const { page, item } = resolvePage(preview.doc, wantedOf(sp));
  const seo = (page.data.root.props?.seo ?? {}) as PageSeo;
  const c = item && preview.doc.collections?.find((x) => x.id === page.data.root.props?.itemsOf);
  const firstOf = (type: string) => c?.fields.find((f) => f.type === type)?.key;
  const title = (item && (item.values.title || item.values[firstOf("text") ?? ""])) || seo.title || page.title;
  const description = (item && item.values[firstOf("longtext") ?? ""]?.slice(0, 300)) || seo.description;
  const image = (item && item.values[firstOf("image") ?? ""]) || seo.image;
  return {
    title: title ? `${title} (design preview)` : fallback.title,
    description: description || undefined,
    openGraph: { title: title || undefined, description: description || undefined, images: image && (image.startsWith("https://") || isMediaSrc(image)) ? [image] : undefined },
    robots: NO_INDEX,
  };
}

export default async function DraftPreviewPage({ params, searchParams }: Props) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  if (!isWellFormedToken(token)) notFound();
  const preview = await loadPreview(token);
  if (!preview) notFound();
  const { doc } = preview;

  const { page, item } = resolvePage(doc, wantedOf(sp));
  const itemPages: Record<string, string> = {};
  for (const p of doc.pages) {
    const of = p.data.root.props?.itemsOf;
    if (typeof of === "string" && !itemPages[of]) itemPages[of] = p.id;
  }
  // Designs stay on the template version they were made with, even after the template is updated.
  const template = doc.templateRef ? ((await readTemplate(doc.templateRef.slug, doc.templateRef.version, { requirePublished: false, includeDrafts: true })) ?? undefined) : undefined;
  // Classes the visitor added that the template's stylesheet lacks, compiled (and cached) on the server.
  const classes = validClasses([...pieceClasses((page.data.content ?? []) as BlockItem[]), ...styleClassList(doc.styles)]);
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
        <DraftRender page={page} pages={pageRefs(doc)} template={template} extraCss={extraCss} content={{ collections: doc.collections, menus: doc.menus, itemPages }} itemSlug={item?.slug} />
      </main>
    </>
  );
}
