import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/site/page-loading";
import { CardRibbons } from "@/components/brand/card-ribbons";
import { ArrowRight, Check, Minus, MessageCircleMore } from "lucide-react";
import { HeroHeadline } from "@/components/motion/hero-headline";
import { PerspectiveGrid } from "@/components/ui/perspective-grid";
import { fabClass, fabLabelClass } from "@/components/site/cta-style";
import { ConversationFab } from "@/components/site/conversation-fab";
import SocialFlipButton from "@/components/ui/social-flip-button";
import { QuickDock } from "@/components/site/quick-dock";
import { Aura } from "@/components/motion/aura";
import { BorderBeam } from "@/components/motion/border-beam";
import { ExpectationsAccordion } from "@/components/site/expectations-accordion";
import { buildSearchEntries } from "@/lib/search";
import { CapabilityTabs } from "@/components/site/capability-tabs";
import { SectionBackdrop } from "@/components/site/section-backdrop";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { InquiryProvider, OpenInquiryButton } from "@/components/forms/inquiry";
import { OfferSplit, ReferralBadge, SectionHeading } from "@/components/marketing/cards";
import { BuilderGuide } from "@/components/marketing/builder-guide";
import { ServicesExplorer } from "@/components/marketing/services-explorer";
import { ApproachWorkbench } from "@/components/marketing/approach-workbench";
import { HeroComposition } from "@/components/marketing/mockups";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import StatsCounter from "@/components/ui/stats-counter";
import { brand, capabilityGroups, SHOW_STATS, stats, customVsTemplate, expectations } from "@/content/site";
import { formatOfferDate } from "@/lib/offer";
import { initials } from "@/lib/utils";
import { getPublicCampaign } from "@/server/services/campaign";
import { getCompanyProfile } from "@/server/services/company";
import { getServices } from "@/server/services/services";
import { MeetingProvider, OpenMeetingButton } from "@/components/booking/meeting-provider";
import { publicMeetingConfig } from "@/server/booking/config";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  // Same page for every ?ref= value; only the canonical URL is indexed.
};

type HomePageProps = { searchParams: Promise<{ ref?: string | string[] }> };

export default function HomePage(props: HomePageProps) {
  return (
    <Suspense fallback={<PageLoading />}>
      <HomeContent {...props} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }: HomePageProps) {
  const sp = await searchParams;
  const ref = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const [company, services, campaign] = await Promise.all([
    getCompanyProfile(),
    getServices(),
    ref ? getPublicCampaign(ref) : Promise.resolve(null),
  ]);

  const offer = campaign?.offer.state === "active" ? campaign.offer : null;
  const introducedBy = campaign?.referrerName ?? null;
  const links = [
    { href: "#services", label: "Services" },
    { href: "#approach", label: "Our approach" },
    { href: "#capabilities", label: "Capabilities" },
    { href: "#offer", label: "Offer" },
  ];
  const search = buildSearchEntries({
    links,
    services,
    capabilities: capabilityGroups.flatMap((g) => g.items),
    email: company.contactEmail,
    ctaLabel: "Start a conversation",
  });

  return (
    <InquiryProvider companyName={company.name} contactEmail={company.contactEmail} refToken={campaign?.token} introducedBy={introducedBy}>
    <MeetingProvider config={publicMeetingConfig()} refToken={campaign?.token} contactEmail={company.contactEmail}>
      <SiteHeader companyName={company.name} links={links}
        menuCta={<OpenInquiryButton className="w-full">Start a conversation</OpenInquiryButton>} />
      <div className="relative isolate">
      <Aura />
      <PerspectiveGrid />
      <main id="main" className="mx-auto max-w-page px-5 sm:px-10 lg:px-16">
        <section className="hero-grid relative py-14 md:py-24" aria-labelledby="hero-title">
          <div className="flex flex-col items-start gap-6">
            {offer ? (
              <a href="#offer" className="inline-flex items-center gap-2.5 rounded-full bg-neutral-100 py-1.5 pl-2 pr-4 text-[13.5px] text-muted hover:bg-neutral-200">
                <span className="rounded-full bg-sage-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-sage-800">Special offer</span>
                {campaign?.hasReferrer ? "Available through an existing client introduction" : "Available through this link"}
              </a>
            ) : introducedBy ? (
              <ReferralBadge name={introducedBy} initials={initials(introducedBy)} />
            ) : null}
            <h1 id="hero-title" className="text-[clamp(42px,5.8vw,76px)] leading-[1.04] tracking-tight">
              <HeroHeadline text={brand.value} />
            </h1>
            <p className="max-w-[46ch] text-[18px] leading-relaxed text-muted">{brand.short}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-[19px] text-accent-700">
              <span className="sr-only">{brand.valueFlow.join(", then ")}</span>
              {brand.valueFlow.map((w, i) => (
                <span key={w} aria-hidden className="flex items-center gap-3">
                  <span className={i === brand.valueFlow.length - 1 ? "shimmer" : undefined}>{w}</span>
                  {i < brand.valueFlow.length - 1 ? <ArrowRight className="size-4 text-muted" strokeWidth={2.75} /> : null}
                </span>
              ))}
            </p>
            <div className="flex flex-wrap gap-3">
              <OpenInquiryButton size="lg" data-hero-cta>
                Start a conversation <ArrowRight aria-hidden className="size-[18px]" strokeWidth={2.75} />
              </OpenInquiryButton>
              <a href="#services" className={buttonVariants({ variant: "outline", size: "lg" })}>
                See what we build
              </a>
            </div>
          </div>
          <HeroComposition />
        </section>

        {SHOW_STATS ? (
          <section aria-label="At a glance" className="py-4">
            <dl className="grid gap-6 rounded-xl bg-surface p-8 sm:grid-cols-3 sm:p-10">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1 text-center sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-line">
                  <dt className="order-2 text-[15px] text-muted">{s.label}</dt>
                  <dd className="order-1 font-heading text-[clamp(40px,5vw,60px)] leading-none text-accent-700">
                    <StatsCounter value={s.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section id="services" className="relative py-16 md:py-24" aria-labelledby="services-title">
          <SectionBackdrop tone="accent" side="left" dots />
          <SectionHeading
            eyebrow="What we build"
            titleId="services-title" title="Practical systems, built around your business."
            lead="Websites, customer applications, and business tools. Explore the work you need, then talk with us about the right scope."
          />
          <ServicesExplorer services={services} />
        </section>

        <section className="relative py-16 md:py-24" aria-labelledby="custom-title">
          <SectionBackdrop tone="sage" side="right" />
          <SectionHeading
            eyebrow="Why custom"
            tone="sage"
            titleId="custom-title" title="Your business isn't a template. Your software needn't be either."
            lead={customVsTemplate.intro}
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-neutral-200 p-8 sm:p-11">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Template website</p>
              <h3 className="mb-6 mt-1.5 text-[26px] text-ink/80">{customVsTemplate.templateFits.label}</h3>
              <ul className="flex flex-col gap-4 text-[16px] text-muted">
                {customVsTemplate.templateFits.points.map((p) => (
                  <li key={p} className="flex items-center gap-3.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-300">
                      <Minus aria-hidden className="size-3.5" strokeWidth={2.75} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-8 text-ink sm:p-11">
              <CardRibbons />
              <p className="relative text-xs font-bold uppercase tracking-[0.08em] text-sage-700">Custom website</p>
              <h3 className="relative mb-6 mt-1.5 text-[26px]">{customVsTemplate.customFits.label}</h3>
              <ul className="relative flex flex-col gap-4 text-[16px]">
                {customVsTemplate.customFits.points.map((p) => (
                  <li key={p} className="flex items-center gap-3.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sage text-on-sage">
                      <Check aria-hidden className="size-3.5" strokeWidth={3.25} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="approach" className="relative py-16 md:py-24" aria-labelledby="approach-title">
          <SectionBackdrop tone="accent" side="right" dots />
          <SectionHeading
            eyebrow="Our approach"
            titleId="approach-title" title="From idea to working system."
            lead="Think it. Build it. Make it work. Explore how we turn your priorities into a first working version, then improve it through real use."
          />
          <ApproachWorkbench />
        </section>

        <section id="capabilities" className="relative py-16 md:py-24" aria-labelledby="cap-title">
          <SectionBackdrop tone="sage" side="left" dots />
          <SectionHeading eyebrow="Capabilities" titleId="cap-title" title="The functionality your business needs." />
          <div className="mt-10">
            <CapabilityTabs groups={capabilityGroups} />
          </div>
          <p className="mt-6 text-sm text-muted">Not seeing what you need? Most projects include something specific to the business. Tell us about yours.</p>
        </section>

        <section id="offer" className="relative py-12 md:py-20" aria-label="Offer">
          <SectionBackdrop tone="accent" side="center" />
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
              <OpenInquiryButton className="self-start">Start a conversation</OpenInquiryButton>
            </OfferSplit>
          ) : (
            <BuilderGuide refToken={campaign?.token} />
          )}
        </section>

        <section className="relative py-16 md:py-24" aria-labelledby="expect-title">
          <SectionBackdrop tone="sage" side="left" />
          <SectionHeading eyebrow="What you can expect" tone="sage" titleId="expect-title" title="No pressure. Just a clear path forward." />
          <ExpectationsAccordion items={expectations} />
        </section>

        <section className="py-12 md:py-20" aria-labelledby="cta-title">
          <div data-contact-cta className="relative flex flex-col items-start gap-5 overflow-hidden rounded-xl bg-sage-100 p-8 sm:p-14">
            <BorderBeam />
            <h2 id="cta-title" className="max-w-[20ch] text-[clamp(32px,4.4vw,56px)] leading-[1.06]">
              {brand.message}
            </h2>
            <p className="max-w-[50ch] text-[18px] leading-relaxed text-sage-800">
              {brand.promise} Tell us what you&apos;re looking to build, improve or solve, and we&apos;ll start with a conversation.
            </p>
            <ul aria-label="What we focus on" className="flex flex-wrap gap-2">
              {brand.promiseFocus.map((f) => (
                <li key={f}><Badge variant="secondary" className="bg-bg px-3.5 py-1.5 text-sm font-semibold text-sage-800">{f}</Badge></li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <OpenInquiryButton size="lg">Start a conversation</OpenInquiryButton>
              <OpenInquiryButton size="lg" variant="outline" intent="CONSULTATION">Request a consultation</OpenInquiryButton>
              <OpenMeetingButton size="lg" variant="outline" entryPoint="contact" />
            </div>
            <div className="mt-2 flex min-w-0 max-w-full flex-col gap-3 border-t border-sage-200 pt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-sage-800">Or reach us directly</p>
              <SocialFlipButton items={company.channels} />
            </div>
          </div>
        </section>
      </main>
      </div>
      <SiteFooter showContacts={false} name={company.name} description={company.description} email={company.contactEmail} websiteUrl={company.websiteUrl} channels={company.channels} />
      <QuickDock
        shortcuts={links}
        columns={[
          { title: "Explore", links: links },
          { title: "What we build", links: services.slice(0, 5).map((s) => ({ label: s.title, href: "#services" })) },
        ]}
      />
      <ConversationFab search={search}>
        <OpenInquiryButton data-primary-cta aria-label="Start a conversation" className={fabClass}>
          <MessageCircleMore aria-hidden className="size-6 shrink-0" strokeWidth={2} />
          <span aria-hidden className={fabLabelClass}>Start a conversation</span>
        </OpenInquiryButton>
      </ConversationFab>
    </MeetingProvider>
    </InquiryProvider>
  );
}
