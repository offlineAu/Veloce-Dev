import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage, type ContentSearchParams } from "@/components/marketing/content-page";
import { servicePages } from "@/content/seo";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }>; searchParams: ContentSearchParams };

export function generateStaticParams() {
  return servicePages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = servicePages.find((item) => item.slug === slug);
  if (!page) notFound();
  return pageMetadata(page.title, page.description, `/services/${page.slug}`);
}

// Resolve the route before streaming so unknown service URLs return a real 404.
export default async function ServicePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = servicePages.find((item) => item.slug === slug);
  if (!page) notFound();
  return <ContentPage label={page.label} path={`/services/${page.slug}`} heading={page.heading} intro={page.intro} searchParams={searchParams} service={{ slug: page.serviceSlug, title: page.label }}>
    <section aria-labelledby="fit-title" className="max-w-3xl">
      <h2 id="fit-title" className="text-3xl">Is this the right fit?</h2>
      <p className="mt-5 text-lg leading-relaxed text-muted">{page.fit}</p>
    </section>
    <section aria-labelledby="capabilities-title" className="py-14">
      <h2 id="capabilities-title" className="mb-7 text-3xl">What we can include</h2>
      <div className="grid gap-5 md:grid-cols-2">{page.capabilities.map((item) => <article key={item.title} className="rounded-2xl border border-line bg-surface p-7"><h3 className="text-xl">{item.title}</h3><p className="mt-3 leading-relaxed text-muted">{item.body}</p></article>)}</div>
    </section>
    <section aria-labelledby="process-title" className="max-w-3xl">
      <h2 id="process-title" className="text-3xl">From a conversation to launch</h2>
      <p className="mt-5 text-lg leading-relaxed text-muted">{page.process}</p>
      <p className="mt-4 leading-relaxed text-muted">We agree the deliverables, responsibilities, estimate, and review points before building. Ongoing support and additional development are discussed as part of that scope.</p>
    </section>
    <section aria-labelledby="questions-title" className="mt-14 max-w-3xl">
      <h2 id="questions-title" className="mb-7 text-3xl">Questions before you start</h2>
      <div className="space-y-7">{page.questions.map((item) => <div key={item.question}><h3 className="text-xl">{item.question}</h3><p className="mt-3 leading-relaxed text-muted">{item.answer}</p></div>)}</div>
    </section>
  </ContentPage>;
}
