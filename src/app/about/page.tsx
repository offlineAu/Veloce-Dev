import { ContentPage, type ContentSearchParams } from "@/components/marketing/content-page";
import { brand, philosophy } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("About Veloce", "Get to know Veloce’s approach to custom websites and digital systems: practical scope, visible progress, and remote collaboration around your business.", "/about");

export default function AboutPage({ searchParams }: { searchParams: ContentSearchParams }) {
  return <ContentPage label="About" path="/about" heading="Practical websites and systems. Built around your business." intro={brand.about[0]} searchParams={searchParams}>
      <section aria-labelledby="approach-title" className="max-w-3xl">
        <h2 id="approach-title" className="text-3xl">How we approach the work</h2>
        <p className="mt-5 text-lg leading-relaxed text-muted">{brand.about[1]}</p>
      </section>
      <div className="my-12 grid gap-5 md:grid-cols-2">{philosophy.map((item) => <section key={item.title} className="rounded-2xl border border-line bg-surface p-7"><h2 className="text-xl">{item.title}</h2><p className="mt-3 leading-relaxed text-muted">{item.body}</p></section>)}</div>
      <section aria-labelledby="remote-title" className="max-w-3xl">
        <h2 id="remote-title" className="text-3xl">Working together remotely</h2>
        <p className="mt-5 text-lg leading-relaxed text-muted">We work with English-speaking businesses through a clear project scope and regular reviews. At the start, we agree how to communicate, who will provide content and feedback, and which decisions need your input.</p>
        <p className="mt-4 text-lg leading-relaxed text-muted">You review the proposed work before deciding. We discuss timelines and pricing after understanding the requirements, and make room to improve the system as you learn from using it.</p>
      </section>
    </ContentPage>;
}
