import type { ReactNode } from "react";
import Link from "next/link";
import { servicePages, withReferral } from "@/content/seo";
import { InquiryProvider, OpenInquiryButton, type InquiryService } from "@/components/forms/inquiry";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { BreadcrumbData } from "@/components/site/structured-data";
import { getCompanyProfile } from "@/server/services/company";
import { getPublicCampaign } from "@/server/services/campaign";
import sectionSurfaces from "./section-surfaces.module.css";

export type ContentSearchParams = Promise<{ ref?: string | string[] }>;

export async function ContentPage({ label, path, heading, intro, service, searchParams, children }: {
  label: string; path: string; heading: string; intro: string; service?: InquiryService;
  searchParams: ContentSearchParams; children: ReactNode;
}) {
  const sp = await searchParams;
  const ref = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const [company, campaign] = await Promise.all([getCompanyProfile(), ref ? getPublicCampaign(ref) : Promise.resolve(null)]);
  const refToken = campaign?.token;
  const links = [
    { label: "Services", href: withReferral("/#services", refToken) },
    { label: "Approach", href: withReferral("/#approach", refToken) },
    { label: "About", href: withReferral("/about", refToken) },
    { label: "Contact", href: "#contact" },
  ];
  return (
    <InquiryProvider companyName={company.name} contactEmail={company.contactEmail} refToken={refToken} introducedBy={campaign?.referrerName}>
      <SiteHeader companyName={company.name} compactOnScroll={false} homeHref={withReferral("/", refToken)} links={links} menuCta={<OpenInquiryButton service={service}>Start a conversation</OpenInquiryButton>} />
      <BreadcrumbData label={label} path={path} />
      <main id="main" className="mx-auto max-w-page px-5 py-10 sm:px-10 lg:px-16">
        <nav aria-label="Breadcrumb" className="mb-10 text-sm text-muted">
          <ol className="flex flex-wrap gap-2"><li><Link href={withReferral("/", refToken)} className="underline underline-offset-4">Home</Link></li><li aria-hidden>/</li><li aria-current="page">{label}</li></ol>
        </nav>
        <section className={`${sectionSurfaces.cool} border-b border-line py-12 sm:py-20`} aria-labelledby="page-title">
          <p className="mb-6 font-mono text-xs uppercase tracking-wider text-muted">{label}</p>
          <h1 id="page-title" className="max-w-[20ch] text-[clamp(44px,6.5vw,84px)] leading-[1.02] tracking-[-0.05em] text-ink">{heading}</h1>
          <p className="mb-8 mt-7 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>
          <OpenInquiryButton service={service}>Discuss your project</OpenInquiryButton>
        </section>
        <div className="py-14 sm:py-20">{children}</div>
        <section aria-labelledby="related-title" className="border-t border-line py-12">
          <h2 id="related-title" className="mb-6 text-2xl">Explore our website services</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {servicePages.filter((page) => `/services/${page.slug}` !== path).map((page) => <li key={page.slug}><Link className="block rounded-2xl border border-line bg-surface p-6 font-semibold hover:underline" href={withReferral(`/services/${page.slug}`, refToken)}>{page.label} →</Link></li>)}
          </ul>
          {path !== "/about" ? <Link href={withReferral("/about", refToken)} className="mt-6 inline-block underline underline-offset-4">Get to know Veloce</Link> : null}
        </section>
        <section id="contact" aria-labelledby="contact-title" className="mb-10 rounded-xl bg-inverse p-8 text-on-inverse sm:p-12">
          <h2 id="contact-title" className="max-w-[20ch] text-[clamp(32px,4.2vw,52px)] leading-[1.05] tracking-[-0.035em] text-on-inverse">Let’s talk about what you need.</h2>
          <p className="mb-6 mt-5 max-w-2xl text-on-inverse/80">Tell us about your business, the problem you want to solve, and what you already have. We’ll start with a conversation, then discuss the scope, timing, and cost.</p>
          <OpenInquiryButton service={service}>Start a conversation</OpenInquiryButton>
          <a href={`mailto:${company.contactEmail}`} className="mt-5 block w-fit break-all underline underline-offset-4">{company.contactEmail}</a>
        </section>
      </main>
      <SiteFooter {...company} email={company.contactEmail} contactHref="#contact" columns={[{ title: "Website services", links: servicePages.map((page) => ({ label: page.label, href: withReferral(`/services/${page.slug}`, refToken) })) }, { title: "Veloce", links: [{ label: "About", href: withReferral("/about", refToken) }] }]} />
    </InquiryProvider>
  );
}
