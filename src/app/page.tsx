import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/site/page-loading";
import { CardRibbons } from "@/components/brand/card-ribbons";
import { ArrowRight, ArrowUpRight, Check, Minus, MessageCircleMore } from "lucide-react";
import { HeroHeadline } from "@/components/motion/hero-headline";
import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
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
import { ServicesCarousel } from "@/components/marketing/services-carousel";
import { ApproachRings } from "@/components/marketing/approach-rings";
import { ModernTools } from "@/components/marketing/modern-tools";
import { buttonVariants } from "@/components/ui/button";
import StatsCounter from "@/components/ui/stats-counter";
import { brand, capabilityGroups, SHOW_STATS, stats, customVsTemplate, deliveryStages, expectations, landing } from "@/content/site";
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

/** Owner-supplied photography: drop files at these paths in public/ and the hero / featured card pick them up. */
const photo = (file: string) => (existsSync(join(process.cwd(), "public", "images", file)) ? `/images/${file}` : undefined);

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
  const heroPhoto = photo("hero-office.webp");
  const teamPhoto = photo("card-builders.webp");
  const reviewPhoto = photo("card-team.webp");
  const contactPhoto = photo("contact-code.webp");
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
      <main id="main">
        {/* Full-bleed hero: spans the page with an even gutter and fills the first screen; the rest sits in the page container. */}
        <section className="relative px-3 pb-6 pt-3 md:pb-10" aria-labelledby="hero-title">
          <div className="relative isolate flex min-h-[max(580px,calc(100svh-5rem))] flex-col justify-between overflow-hidden rounded-[32px] bg-gradient-to-br from-[#1a2e3b] via-[#244252] to-[#12202a] px-6 py-10 text-white shadow-lg sm:p-12 sm:rounded-[40px] lg:px-[max(4rem,calc((100%-80rem)/2+4rem))] lg:py-16">
            <div aria-hidden className="absolute inset-0 -z-10">
              {heroPhoto ? (
                <Image src={heroPhoto} unoptimized alt="" fill priority sizes="100vw" className="object-cover object-center opacity-60 mix-blend-overlay brightness-95" />
              ) : (
                <div className="ring-pattern absolute -right-48 -top-48 size-[860px] rounded-full opacity-25 invert" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/40" />
            </div>

            <div className="flex max-w-2xl flex-col items-start gap-5 pt-2">
              {offer ? (
                <a href="#offer" className="inline-flex items-center gap-2.5 rounded-full bg-neutral-100 py-1.5 pl-2 pr-4 text-[13.5px] text-muted hover:bg-neutral-200">
                  <span className="rounded-full bg-sage-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-sage-800">Special offer</span>
                  {campaign?.hasReferrer ? "Available through an existing client introduction" : "Available through this link"}
                </a>
              ) : introducedBy ? (
                <ReferralBadge name={introducedBy} initials={initials(introducedBy)} />
              ) : (
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent backdrop-blur-md">
                  <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                  {landing.heroEyebrow}
                </p>
              )}
              <h1 id="hero-title" className="text-[clamp(44px,6.4vw,76px)] leading-[0.95] text-white">
                <HeroHeadline text={brand.value} bold={3} />
              </h1>
            </div>

            <div className="grid items-end gap-8 pt-16 lg:grid-cols-12">
              <div className="flex max-w-lg flex-col gap-6 lg:col-span-6">
                <p className="text-[15px] leading-relaxed text-white/85 sm:text-base">{brand.short}</p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <OpenInquiryButton data-hero-cta className="px-7">
                    Start a conversation <ArrowRight aria-hidden className="size-[18px]" strokeWidth={2.75} />
                  </OpenInquiryButton>
                  <a href="#services" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/15 px-6 text-[15px] font-medium text-white backdrop-blur-md transition-colors hover:bg-white/25">
                    See what we build
                  </a>
                </div>
              </div>
              <div className="flex flex-col gap-2 lg:col-span-6 lg:items-end lg:text-right">
                <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-white/70">
                  <span aria-hidden>■</span> {landing.heroSideLabel}
                </p>
                <p className="font-heading text-[clamp(36px,4.6vw,60px)] font-normal leading-tight tracking-[-0.04em] text-white/95">
                  {landing.heroSide[0]} <br className="hidden sm:inline" />
                  <span className="font-bold">{landing.heroSide[1]}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-page px-5 sm:px-10 lg:px-16">
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

        <section id="services" className="relative py-16" aria-labelledby="services-carousel-title">
          <SectionHeading
            eyebrow={landing.servicesEyebrow}
            titleId="services-carousel-title" title={landing.servicesTitle} bold={6} className="max-w-5xl"
          />
          <ServicesCarousel services={services} photo={teamPhoto} closingPhoto={reviewPhoto} />
        </section>

        <section className="relative py-10" aria-labelledby="fit-title">
          <ApproachRings />
        </section>

        <section className="relative py-16 md:py-24" aria-labelledby="custom-title">
          <SectionBackdrop tone="sage" side="right" />
          <SectionHeading
            eyebrow="Why custom"
            tone="sage"
            titleId="custom-title" title="Your business isn't a template. Your software needn't be either." bold={5}
            lead={customVsTemplate.intro}
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-line bg-neutral-200 p-8 sm:p-11">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">Template website</p>
              <h3 className="mb-6 mt-2 text-[26px] font-medium text-ink/80">{customVsTemplate.templateFits.label}</h3>
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
            <div className="relative overflow-hidden rounded-[28px] border border-line bg-surface p-8 text-ink shadow-sm sm:p-11">
              <div aria-hidden className="ring-pattern pointer-events-none absolute -bottom-56 -right-56 size-[620px] rounded-full opacity-70" />
              <CardRibbons />
              <p className="relative inline-flex w-fit items-center gap-2 rounded-full bg-accent-100 px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-800">
                <span aria-hidden className="size-1.5 rounded-full bg-accent-700" />
                Custom website
              </p>
              <h3 className="relative mb-6 mt-3 text-[26px]">{customVsTemplate.customFits.label}</h3>
              <ul className="relative flex flex-col gap-4 text-[16px]">
                {customVsTemplate.customFits.points.map((p) => (
                  <li key={p} className="flex items-center gap-3.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-inverse text-accent">
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
            titleId="approach-title" title="From idea to working system." bold={3}
            lead="Think it. Build it. Make it work. Explore how we turn your priorities into a first working version, then improve it through real use."
          />
          <ApproachWorkbench />
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="flex flex-col justify-between gap-8 rounded-[28px] border border-line bg-surface p-6 shadow-sm sm:p-10 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-6">
                <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  <span aria-hidden className="size-2.5 rounded-full bg-accent" />
                  How we build
                </p>
                <span className="rounded-full bg-accent-100 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent-800">
                  {deliveryStages.length} stages
                </span>
              </div>
              <ol className="grid gap-3 sm:grid-cols-3">
                {deliveryStages.map((st, i) => (
                  <li key={st.id} className={i === 1 ? "rounded-2xl border border-accent-300 bg-accent-100 p-4" : "rounded-2xl border border-line bg-neutral-100 p-4"}>
                    <p className="font-mono text-xs font-bold text-ink">{String(i + 1).padStart(2, "0")}. {st.label.replace(".", "").toUpperCase()}</p>
                    <p className="mt-1 text-sm font-bold text-ink">{st.headline}</p>
                    <p className="mt-1 text-[13px] leading-snug text-muted">{st.steps.map((x) => x.title).join(", ")}.</p>
                  </li>
                ))}
              </ol>
              <div aria-hidden className="flex h-20 items-end gap-1.5 rounded-2xl border border-line bg-neutral-100/70 px-2 pt-3 sm:gap-2">
                {[30, 38, 46, 54, 62, 70, 78, 86, 94, 100].map((h, i) => (
                  <span key={h} className={i < 4 ? "flex-1 rounded-t-sm bg-neutral-300" : i < 8 ? "flex-1 rounded-t-sm bg-accent" : "flex-1 rounded-t-sm bg-inverse"} style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="rounded-xl border border-line bg-neutral-100 p-3 text-center font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted">
                Something real to review at every stage
              </p>
            </div>
            <div className="flex flex-col justify-between gap-10 rounded-[28px] bg-accent p-8 text-on-accent shadow-sm sm:p-12 lg:col-span-5">
              <div className="flex flex-col gap-4">
                <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.12em]">
                  <span aria-hidden className="size-2 bg-current" />
                  Our promise
                </p>
                <h3 className="text-[clamp(26px,2.8vw,36px)] font-light leading-tight">
                  {brand.promise.split(" ").slice(0, 4).join(" ")}{" "}
                  <strong className="font-bold">{brand.promise.split(" ").slice(4).join(" ")}</strong>
                </h3>
                <p className="text-[15px] leading-relaxed">{brand.valueBody}</p>
              </div>
              <a href="#contact" className={buttonVariants({ variant: "dark", className: "self-start" })}>
                Plan your first version <ArrowUpRight aria-hidden className="size-4 text-accent" strokeWidth={2.5} />
              </a>
            </div>
          </div>
        </section>

        <section id="capabilities" className="relative py-16 md:py-24" aria-labelledby="cap-title">
          <SectionBackdrop tone="sage" side="left" dots />
          <SectionHeading eyebrow="Capabilities" titleId="cap-title" title="The functionality your business needs." bold={3} />
          <div className="mt-10">
            <CapabilityTabs groups={capabilityGroups} />
          </div>
          <p className="mt-6 text-sm text-muted">Not seeing what you need? Most projects include something specific to the business. Tell us about yours.</p>
          <ModernTools />
        </section>

        <section id="all-services" className="relative py-16 md:py-24" aria-labelledby="services-title">
          <SectionBackdrop tone="accent" side="left" dots />
          <SectionHeading
            eyebrow="Explore every service"
            titleId="services-title" title="Practical systems, built around your business." bold={4}
            lead="Websites, customer applications, and business tools. Explore the work you need, then talk with us about the right scope."
          />
          <ServicesExplorer services={services} />
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
          <SectionHeading eyebrow="What you can expect" tone="sage" titleId="expect-title" title="No pressure. Just a clear path forward." bold={5} />
          <ExpectationsAccordion items={expectations} />
        </section>

        <section id="contact" className="py-12 md:py-20" aria-labelledby="cta-title">
          <div data-contact-cta className="relative isolate grid gap-10 overflow-hidden rounded-[28px] bg-inverse p-8 text-on-inverse sm:p-14 lg:grid-cols-12 lg:items-center lg:p-16">
            <BorderBeam />
            {contactPhoto ? (
              <div aria-hidden className="absolute inset-0 -z-10">
                <Image src={contactPhoto} unoptimized alt="" fill sizes="100vw" className="object-cover opacity-25 mix-blend-luminosity" />
                <div className="absolute inset-0 bg-gradient-to-r from-inverse via-inverse/85 to-inverse/40" />
              </div>
            ) : null}
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 -z-10 size-96 rounded-full bg-accent/15 blur-3xl" />
            <div className="flex flex-col items-start gap-5 lg:col-span-7">
              <p className="inline-flex items-center gap-2 rounded-full bg-on-inverse/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                Start with a conversation
              </p>
              <h2 id="cta-title" className="max-w-[20ch] text-[clamp(32px,4.4vw,56px)] leading-[1.04] text-on-inverse">
                {brand.message.split(". ").slice(0, -1).map((p) => `${p}. `)}
                <strong className="text-accent">{brand.message.split(". ").at(-1)}</strong>
              </h2>
              <p className="max-w-[50ch] text-[17px] leading-relaxed text-on-inverse/80">
                {brand.promise} Tell us what you&apos;re looking to build, improve or solve, and we&apos;ll start with a conversation.
              </p>
              <ul aria-label="What we focus on" className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-on-inverse/75">
                {brand.promiseFocus.map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex min-w-0 flex-col gap-4 rounded-2xl bg-surface p-6 text-ink shadow-lg sm:p-8 lg:col-span-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold tracking-tight">Talk with {company.name}</h3>
                <span className="rounded-md bg-accent px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase text-on-accent">No pressure</span>
              </div>
              <div className="flex flex-col gap-2.5 [&>*]:w-full">
                <OpenInquiryButton size="lg" variant="dark">Start a conversation</OpenInquiryButton>
                <OpenInquiryButton size="lg" variant="outline" intent="CONSULTATION">Request a consultation</OpenInquiryButton>
                <OpenMeetingButton size="lg" variant="outline" entryPoint="contact" />
              </div>
              <div className="mt-1 flex min-w-0 max-w-full flex-col gap-3 border-t border-line pt-5">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Or reach us directly</p>
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
        columns={[{ title: "What we build", links: services.slice(0, 5).map((sv) => ({ label: sv.title, href: "#services" })) }]}
      />
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
