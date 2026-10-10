import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftRender } from "@/components/builder/draft-render";
import { migrateDoc, pageRefs } from "@/lib/builder/site-doc";
import { isWellFormedToken } from "@/lib/token";
import { readTemplate } from "@/server/builder/template-registry";
import { db } from "@/server/db";

// A visitor's private design: never indexed or cached. The unguessable token is the only key.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Site design preview",
  robots: { index: false, follow: false, nocache: true },
};

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ page?: string | string[] }> };

export default async function DraftPreviewPage({ params, searchParams }: Props) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  if (!isWellFormedToken(token)) notFound();
  const draft = await db.siteDraft.findUnique({ where: { token }, select: { data: true, createdAt: true } });
  const doc = draft ? migrateDoc(draft.data) : null;
  if (!draft || !doc) notFound();

  const wanted = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = doc.pages.find((p) => p.path === wanted) ?? doc.pages[0]!;
  // Designs stay on the template version they were made with, even after the template is updated.
  const template = doc.templateRef ? ((await readTemplate(doc.templateRef.slug, doc.templateRef.version, { requirePublished: false, includeDrafts: true })) ?? undefined) : undefined;

  return (
    <>
      {/* Pinned to the bottom: designs often have their own fixed header at the top. */}
      <div className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-ink px-4 py-2 text-sm text-bg shadow-lg">
        <p>Design preview, submitted {draft.createdAt.toLocaleDateString("en", { dateStyle: "medium" })}. Links and forms are placeholders.</p>
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
      </div>
      <main id="main" className="pb-24">
        <DraftRender page={page} pages={pageRefs(doc)} template={template} />
      </main>
    </>
  );
}
