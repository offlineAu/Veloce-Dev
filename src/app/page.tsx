import { portfolioImageUrl } from "@/lib/security/portfolio-images";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { HeroHeadline } from "@/components/motion/hero-headline";
import { existsSync } from "node:fs";
import { join } from "node:path";
import SocialFlipButton from "@/components/ui/social-flip-button";
import { ExpectationsAccordion } from "@/components/site/expectations-accordion";
import { buildSearchEntries } from "@/lib/search";
import { CapabilityTabs } from "@/components/site/capability-tabs";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { InquiryProvider, OpenInquiryButton } from "@/components/forms/inquiry";
import { OfferSplit, ReferralBadge, SectionHeading } from "@/components/marketing/cards";
import { BuilderGuide } from "@/components/marketing/builder-guide";
import { SampleSites } from "@/components/marketing/sample-sites";
import { ServicesBook } from "@/components/marketing/services-book";
import { LaptopShowcase } from "@/components/marketing/laptop-showcase";
import { WorkbenchDisclosure } from "@/components/marketing/workbench-disclosure";
import { CapabilitiesDisclosure } from "@/components/marketing/capabilities-disclosure";
import { StickyMeeting } from "@/components/site/sticky-meeting";
import { MIN_SHOWCASE, showcaseSamples } from "@/content/samples";
import sectionSurfaces from "@/components/marketing/section-surfaces.module.css";
import { ModernTools } from "@/components/marketing/modern-tools";
import { capabilityGroups, deliveryStages, expectations, story } from "@/content/site";
import { ProblemSplit } from "@/components/marketing/problem-split";
import { formatOfferDate } from "@/lib/offer";
import { initials } from "@/lib/utils";
import { getPublicCampaign } from "@/server/services/campaign";
import { getCompanyProfile } from "@/server/services/company";
import { getServices } from "@/server/services/services";
import { MeetingProvider, OpenMeetingButton } from "@/components/booking/meeting-provider";
import { publicMeetingConfig } from "@/server/booking/config";
import { servicePages, servicePageHref, withReferral } from "@/content/seo";
import { pageMetadata } from "@/lib/seo";
import { OrganizationData } from "@/components/site/structured-data";
import { BootLoader } from "@/components/site/boot-loader";
import { AUTOMATED_AGENT_PATTERN } from "@/components/site/boot-constants";
import { env } from "@/config/env";
import { headers } from "next/headers";
import { Suspense } from "react";

// Same page for every referral or tracking query; only the clean URL is canonical.
export const metadata = pageMetadata("Business Website Design & Development", "Custom business websites, website redesign, and e-commerce development from Veloce. Practical websites built around your customers and business needs.", "/");

/** Owner-supplied photography: drop files at these paths in public/ and the hero / featured card pick them up. */
const photo = (file: string) => (existsSync(join(process.cwd(), "public", "images", file)) ? portfolioImageUrl(`/images/${file}`) : undefined);

type HomePageProps = { searchParams: Promise<{ ref?: string | string[]; sample?: string | string[]; nojs?: string | string[] }> };

/** Hero carousel, in order. hero-code-review, hero-dev-desk, hero-team-floor and hero-code-closeup are Pexels photos
 *  (Pexels License: free commercial use, no attribution) by Jakub Zerdzicki, Lisa Fotios, cottonbro studio and Pixabay. */
const heroPhotoFiles = ["hero-code-review.webp", "hero-dev-pair.webp", "hero-dev-desk.webp", "hero-team-floor.webp", "card-office.webp", "hero-code-closeup.webp"];

/**
 * The first-visit intro streams first: it needs only files on disk and configuration, so it is in the very first HTML
 * the visitor receives and its gate works straight away (see boot-loader.tsx), while the database-backed page streams
 * in underneath it. Streamed content is swapped into place by an inline script, so clients that run no JavaScript get
 * the page in one pass instead: crawlers (which skip the intro anyway), and browsers with JavaScript off, which a
 * <noscript> refresh sends to ?nojs=1.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const h = await headers();
  const sp = await searchParams;
  const onePass = sp.nojs !== undefined || new RegExp(AUTOMATED_AGENT_PATTERN, "i").test(h.get("user-agent") ?? "");
  // Sample websites replace the service cards once there are enough to fill the carousel.
  const samples = showcaseSamples(undefined, undefined, (file) => existsSync(join(process.cwd(), "public", file)));
  const heroPhotos = heroPhotoFiles.map(photo).filter((src): src is string => !!src);
  // The "Tailored services" sample sites play on the intro's laptop (studio photos if there are too few); the last one
  // is what the laptop screen zooms into before the page appears.
  const introFrames = samples.length >= MIN_SHOWCASE
    ? samples.slice(0, 10).map((s) => ({ src: portfolioImageUrl(s.thumbnail), title: s.title, screen: true }))
    : [photo("hero-overhead.webp"), photo("hero-dashboard.webp"), photo("contact-code.webp"), ...heroPhotos.slice(1)]
      .filter((src): src is string => !!src).map((src) => ({ src, title: "", screen: false }));

  const content = <HomeContent searchParams={searchParams} samples={samples} />;
  if (onePass) return content;
  const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => [v ?? []].flat().map((x) => [k, x])));
  query.set("nojs", "1");
  return (
    <>
      <noscript><meta httpEquiv="refresh" content={`0; url=/?${query}`} /></noscript>
      <BootLoader name={env().COMPANY_NAME} frames={introFrames} />
      <Suspense fallback={null}>{content}</Suspense>
    </>
  );
}

async function HomeContent({ searchParams, samples }: HomePageProps & { samples: ReturnType<typeof showcaseSamples> }) {
  const sp = await searchParams;
  const ref = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const [company, services, campaign] = await Promise.all([
    getCompanyProfile(),
    getServices(),
    ref ? getPublicCampaign(ref) : Promise.resolve(null),
  ]);

  const showSamples = samples.length >= MIN_SHOWCASE;
  // The hero laptop codes, deploys and shows one sample of each kind of work, in this order.
  const laptopItems = ([
    { kind: "website", label: "Website", short: "Website", slug: "aurelia-advisory" },
    { kind: "store", label: "Online store", short: "Store", slug: "oakwell-home" },
    { kind: "system", label: "Business system", short: "System", slug: "bellbird-portal" },
  ] as const).flatMap(({ slug, ...item }) => {
    const sample = samples.find((candidate) => candidate.slug === slug);
    return sample ? [{ ...item, sample }] : [];
  });
  // Coming back from a sample's preview (?sample=<token>) puts that sample in front.
  const sampleToken = Array.isArray(sp.sample) ? sp.sample[0] : sp.sample;
  const activeSample = Math.max(0, samples.findIndex((s) => s.token === sampleToken));

  const offer = campaign?.offer.state === "active" ? campaign.offer : null;
  const introducedBy = campaign?.referrerName ?? null;
  const links = [
    { href: "#examples", label: "Examples" },
    { href: "#services", label: "Services" },
    { href: "#approach", label: "Approach" },
    { href: withReferral("/about", campaign?.token), label: "About" },
  ];
  const meetingConfig = publicMeetingConfig();
  const meetingLabel = meetingConfig.enabled ? "Book a Meeting" : "Request a Meeting";
  const search = buildSearchEntries({
    links,
    services,
    capabilities: capabilityGroups.flatMap((g) => g.items),
    email: company.contactEmail,
    ctaLabel: meetingLabel,
  });

  return (
    <InquiryProvider companyName={company.name} contactEmail={company.contactEmail} refToken={campaign?.token} introducedBy={introducedBy}>
    <MeetingProvider config={meetingConfig} refToken={campaign?.token} contactEmail={company.contactEmail}>
      <OrganizationData company={company} />
      <SiteHeader companyName={company.name} homeHref={withReferral("/", campaign?.token)} links={links} search={search}
        menuCta={<OpenMeetingButton entryPoint="contact" className="w-full">{meetingLabel}</OpenMeetingButton>} />
      {/* Clipped sideways only: the hero's screen glow spreads past the page edge on narrow screens. */}
      <div className="relative isolate overflow-x-clip">
      <main id="main">
        <section className="mx-auto grid max-w-page items-center gap-8 px-5 pb-12 pt-10 sm:px-10 md:pb-20 md:pt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:px-16" aria-labelledby="hero-title">
          <div className="flex min-w-0 flex-col items-start gap-6">
            {offer ? <a href="#offer" className="rounded-full bg-accent-100 px-4 py-2 text-sm font-semibold text-accent-800">Special offer available through this link</a> : introducedBy ? <ReferralBadge name={introducedBy} initials={initials(introducedBy)} /> : null}
            <h1 id="hero-title" className="max-w-[16ch] text-[clamp(42px,5.4vw,76px)] leading-[1.02] tracking-[-0.055em] text-ink"><HeroHeadline text="Websites that work for your business." bold={2} breakBefore={[2]} /></h1>
            <p className="max-w-[46ch] text-lg leading-relaxed text-muted">We design and build custom websites, online stores, and business systems that make it easier to reach customers and get work done.</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 sm:gap-x-4">
              <OpenMeetingButton data-hero-cta data-primary-cta entryPoint="contact" className="px-5 sm:px-6">{meetingLabel} <ArrowRight aria-hidden className="size-4" /></OpenMeetingButton>
              <a href="#examples" className="inline-flex min-h-12 items-center gap-2 px-1 text-sm font-semibold text-ink hover:text-accent-700">Explore examples <ArrowUpRight aria-hidden className="size-4" /></a>
            </div>
          </div>
          <LaptopShowcase items={laptopItems} />
        </section>


        <div className="mx-auto max-w-page px-5 sm:px-10 lg:px-16">
        <ProblemSplit />

        <section id="examples" className={`${sectionSurfaces.cool} py-14 md:py-20`} aria-labelledby="examples-title">
          <SectionHeading titleId="examples-title" title={story.examplesTitle} lead={story.examplesLead} />
          {showSamples ? <SampleSites samples={samples} initialIndex={activeSample} refToken={campaign?.token} /> : <p className="mt-8 text-muted">Examples are being prepared. Explore our services below in the meantime.</p>}
        </section>

        <section id="services" className="border-t border-line py-14 md:py-20" aria-labelledby="services-title">
          <div id="all-services" />
          <SectionHeading titleId="services-title" title={story.servicesTitle} lead={story.servicesLead} />
          <ServicesBook services={services} refToken={campaign?.token} />
          <div id="capabilities" className="border-t border-line pt-10">
            <CapabilitiesDisclosure><CapabilityTabs groups={capabilityGroups} /><ModernTools /></CapabilitiesDisclosure>
          </div>
        </section>

        <section id="approach" className={`${sectionSurfaces.warm} border-t border-line py-20 md:py-28`} aria-labelledby="approach-title">
          <SectionHeading titleId="approach-title" title={story.approachTitle} lead={story.approachLead} />
          <ol className="mt-12 grid gap-8 md:grid-cols-3">{deliveryStages.map((stage) => <li key={stage.id} className="border-t border-line pt-6"><h3 className="font-heading text-2xl font-semibold">{stage.label}</h3><p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted">{stage.summary}</p></li>)}</ol>
          <WorkbenchDisclosure />
        </section>

        <section id="offer" className={`${sectionSurfaces.accent} border-t border-line py-20 md:py-28`} aria-label="Offer">
          {offer && campaign ? (
            <OfferSplit
              heading={campaign.hasReferrer ? "A special offer for your introduction." : "A special offer for you."}
              lead={
                campaign.hasReferrer
                  ? "Because you were introduced by one of our existing clients, we're offering a special opportunity for your business."
                  : "We're running a special offer for visitors who arrive through this link."
              }
              title={offer.title}
              description={offer.description}
              lines={[
                ...(introducedBy ? [`Available through an introduction from ${introducedBy}.`] : []),
                ...(offer.expiresAt ? [`Offer valid until ${formatOfferDate(offer.expiresAt, company.timezone)}.`] : []),
                "Your visit through this link is already linked to the offer. There's nothing to enter or mention.",
              ]}
            >
              <OpenMeetingButton entryPoint="contact" className="self-start">{meetingLabel}</OpenMeetingButton>
            </OfferSplit>
          ) : (
            <BuilderGuide refToken={campaign?.token} />
          )}
        </section>

        <section className="relative border-t border-line py-20 md:py-28" aria-labelledby="expect-title">
          <SectionHeading titleId="expect-title" title={story.expectTitle} />
          <ExpectationsAccordion items={expectations} />
        </section>

        <section id="contact" className="py-12 md:py-20" aria-labelledby="cta-title">
          <div data-contact-cta className="relative isolate grid gap-10 overflow-hidden rounded-xl bg-inverse px-7 py-14 text-on-inverse sm:p-14 lg:grid-cols-12 lg:items-center lg:p-16">
            <div className="flex flex-col items-start gap-5 lg:col-span-7">
              <h2 id="cta-title" className="max-w-[18ch] text-[clamp(32px,4.4vw,56px)] leading-[1.04] text-on-inverse">{story.contactTitle}</h2>
              <p className="max-w-[50ch] text-[17px] leading-relaxed text-on-inverse/80">
                Tell us what you&apos;re looking to build, improve or solve. We&apos;ll suggest a first version worth building, in plain language.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-4 rounded-2xl bg-surface p-6 text-ink shadow-lg sm:p-8 lg:col-span-5">
              <h3 className="text-lg font-semibold tracking-tight">Talk with {company.name}</h3>
              <div className="flex flex-col gap-2.5 [&>*]:w-full">
                <OpenMeetingButton size="lg" variant="dark" entryPoint="contact">{meetingLabel}</OpenMeetingButton>
                <OpenInquiryButton size="lg" variant="outline" intent="CONSULTATION">Request a consultation</OpenInquiryButton>
              </div>
              <div className="mt-1 flex min-w-0 max-w-full flex-col gap-3 border-t border-line pt-5">
                <p className="text-sm font-semibold text-muted">Or reach us directly</p>
                <SocialFlipButton items={company.channels} />
              </div>
            </div>
          </div>
        </section>
        </div>
      </main>
      </div>
      <SiteFooter
        showContacts={false} name={company.name} description={company.description} email={company.contactEmail} websiteUrl={company.websiteUrl} channels={company.channels}
        contactHref="#contact"
        columns={[{ title: "Website services", links: servicePages.map((page) => ({ label: page.label, href: servicePageHref(page.serviceSlug, campaign?.token)! })) }, { title: "Veloce", links: [{ label: "About", href: withReferral("/about", campaign?.token) }] }]}
      />
      <StickyMeeting label={meetingLabel} />
    </MeetingProvider>
    </InquiryProvider>
  );
}
