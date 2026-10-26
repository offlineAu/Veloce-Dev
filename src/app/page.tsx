import { portfolioImageUrl } from "@/lib/security/portfolio-images";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Minus } from "lucide-react";
import { HeroHeadline } from "@/components/motion/hero-headline";
import { HeroSlideshow } from "@/components/motion/hero-slideshow";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fabClass, fabLabelClass } from "@/components/site/cta-style";
import { ConversationFab } from "@/components/site/conversation-fab";
import SocialFlipButton from "@/components/ui/social-flip-button";
import { QuickDock } from "@/components/site/quick-dock";
import { ExpectationsAccordion } from "@/components/site/expectations-accordion";
import { buildSearchEntries } from "@/lib/search";
import { CapabilityTabs } from "@/components/site/capability-tabs";
import { KeywordMarquee } from "@/components/marketing/keyword-marquee";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { InquiryProvider, OpenInquiryButton } from "@/components/forms/inquiry";
import { OfferSplit, ReferralBadge, SectionHeading } from "@/components/marketing/cards";
import { BuilderGuide } from "@/components/marketing/builder-guide";
import { ServicesBook } from "@/components/marketing/services-book";
import { ApproachWorkbench } from "@/components/marketing/approach-workbench";
import { ServicesCarousel } from "@/components/marketing/services-carousel";
import { SampleSites } from "@/components/marketing/sample-sites";
import { MIN_SHOWCASE, showcaseSamples } from "@/content/samples";
import { ApproachStatement } from "@/components/marketing/approach-statement";
import sectionSurfaces from "@/components/marketing/section-surfaces.module.css";
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
import { servicePages, servicePageHref, withReferral } from "@/content/seo";
import { pageMetadata } from "@/lib/seo";
import { OrganizationData } from "@/components/site/structured-data";
import { BootLoader } from "@/components/site/boot-loader";

// Same page for every referral or tracking query; only the clean URL is canonical.
export const metadata = pageMetadata("Business Website Design & Development", "Custom business websites, website redesign, and e-commerce development from Veloce. Practical websites built around your customers and business needs.", "/");

/** Owner-supplied photography: drop files at these paths in public/ and the hero / featured card pick them up. */
const photo = (file: string) => (existsSync(join(process.cwd(), "public", "images", file)) ? portfolioImageUrl(`/images/${file}`) : undefined);

type HomePageProps = { searchParams: Promise<{ ref?: string | string[]; sample?: string | string[] }> };

export default async function HomePage({ searchParams }: HomePageProps) {
  const sp = await searchParams;
  const ref = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const [company, services, campaign] = await Promise.all([
    getCompanyProfile(),
    getServices(),
    ref ? getPublicCampaign(ref) : Promise.resolve(null),
  ]);

  // Sample websites replace the service cards once there are enough to fill the carousel.
  const samples = showcaseSamples(undefined, undefined, (file) => existsSync(join(process.cwd(), "public", file)));
  const showSamples = samples.length >= MIN_SHOWCASE;
  // Coming back from a sample's preview (?sample=<token>) puts that sample in front.
  const sampleToken = Array.isArray(sp.sample) ? sp.sample[0] : sp.sample;
  const activeSample = Math.max(0, samples.findIndex((s) => s.token === sampleToken));

  const offer = campaign?.offer.state === "active" ? campaign.offer : null;
  const introducedBy = campaign?.referrerName ?? null;
  const links = [
    { href: "#services", label: "Services" },
    { href: "#approach", label: "Approach" },
    { href: "#capabilities", label: "Capabilities" },
    { href: "#offer", label: "Offer" },
    { href: withReferral("/about", campaign?.token), label: "About" },
  ];
  // Hero carousel, in order. hero-code-review, hero-dev-desk, hero-team-floor and hero-code-closeup are Pexels photos
  // (Pexels License: free commercial use, no attribution) by Jakub Zerdzicki, Lisa Fotios, cottonbro studio and Pixabay.
  const heroPhotos = [
    photo("hero-code-review.webp"), photo("hero-dev-pair.webp"), photo("hero-dev-desk.webp"),
    photo("hero-team-floor.webp"), photo("card-office.webp"), photo("hero-code-closeup.webp"),
  ].filter((src): src is string => !!src);
  // First-visit intro: the "Tailored services" sample sites play on its laptop (studio photos if there are too few), and
  // it ends on the hero's first photo, the one waiting underneath, which the laptop screen zooms into.
  const introFrames = [
    ...(samples.length >= MIN_SHOWCASE
      ? samples.slice(0, 10).map((s) => ({ src: portfolioImageUrl(s.thumbnail), title: s.title, screen: true }))
      : [photo("hero-overhead.webp"), photo("hero-dashboard.webp"), photo("contact-code.webp"), ...heroPhotos.slice(1)]
        .filter((src): src is string => !!src).map((src) => ({ src, title: "", screen: false }))),
    ...(heroPhotos[0] ? [{ src: heroPhotos[0], title: "Your website, next", screen: false }] : []),
  ];
  const teamPhoto = photo("card-builders.webp");
  const reviewPhoto = photo("card-office.webp");
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
      <BootLoader name={company.name} frames={introFrames} />
      <OrganizationData company={company} />
      <SiteHeader companyName={company.name} homeHref={withReferral("/", campaign?.token)} links={links}
        menuCta={<OpenMeetingButton entryPoint="contact" className="w-full">{meetingLabel}</OpenMeetingButton>} />
      <div className="relative isolate">
      <main id="main">
        {/* Full-bleed hero: spans the page with an even gutter and fills the first screen; the rest sits in the page container. */}
        <section className="relative px-3 pb-6 pt-3 md:pb-10" aria-labelledby="hero-title">
          <div className="relative isolate flex min-h-[max(580px,calc(100svh-5rem))] flex-col justify-between overflow-hidden rounded-[32px] bg-inverse px-6 py-10 text-white shadow-lg sm:p-12 sm:rounded-[40px] lg:px-[max(4rem,calc((100%-80rem)/2+4rem))] lg:py-16">
            <div aria-hidden className="absolute inset-0 -z-10">
              {heroPhotos.length ? (
                <HeroSlideshow photos={heroPhotos} variant="flip" className="object-cover object-center opacity-60 mix-blend-overlay brightness-95" />
              ) : null}
              <div className="absolute inset-0 bg-black/55" />
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
              <p className="max-w-lg text-lg leading-relaxed text-white/85">Custom business website design and development, website redesign, and e-commerce websites for businesses working with us remotely.</p>
            </div>

            <div className="grid items-end gap-8 pt-16 lg:grid-cols-12">
              <div className="flex max-w-lg flex-col gap-6 lg:col-span-6">
                <p className="text-[15px] leading-relaxed text-white/85 sm:text-base">{brand.short}</p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <OpenMeetingButton data-hero-cta entryPoint="contact" className="px-7">
                    {meetingLabel} <ArrowRight aria-hidden className="size-[18px]" strokeWidth={2.75} />
                  </OpenMeetingButton>
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

        <section id="services" className={`${sectionSurfaces.cool} mt-10 pb-20 md:pb-28`} aria-labelledby="services-carousel-title">
          <KeywordMarquee items={services.map((s) => s.title)} secondary={capabilityGroups.flatMap((g) => g.items.map((c) => c.title))} />
          <SectionHeading className="mt-16 md:mt-20 max-w-5xl"
            eyebrow={landing.servicesEyebrow}
            titleId="services-carousel-title" title={showSamples ? landing.samplesTitle : landing.servicesTitle} bold={6}
          />
          {showSamples ? (
            <SampleSites samples={samples} initialIndex={activeSample} refToken={campaign?.token} />
          ) : (
            <ServicesCarousel services={services} photo={teamPhoto} closingPhoto={reviewPhoto} refToken={campaign?.token} />
          )}
        </section>

        <section className="relative py-10" aria-labelledby="fit-title">
          <ApproachStatement />
        </section>

        <section className="relative border-t border-line py-20 md:py-28" aria-labelledby="custom-title">
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

        <section id="approach" className={`${sectionSurfaces.warm} border-t border-line py-20 md:py-28`} aria-labelledby="approach-title">
          <SectionHeading
            eyebrow="Approach"
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
              <p className="rounded-xl border border-line bg-neutral-100 p-3 text-center font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted">
                Something real to review at every stage
              </p>
            </div>
            <div className="flex flex-col justify-between gap-10 rounded-xl bg-accent-200 p-8 text-ink sm:p-12 lg:col-span-5">
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

        <section id="capabilities" className="relative border-t border-line py-20 md:py-28" aria-labelledby="cap-title">
          <SectionHeading eyebrow="Capabilities" titleId="cap-title" title="The functionality your business needs." bold={3} />
          <div className="mt-10">
            <CapabilityTabs groups={capabilityGroups} />
          </div>
          <p className="mt-6 text-sm text-muted">Not seeing what you need? Most projects include something specific to the business. Tell us about yours.</p>
          <ModernTools />
        </section>

        <section id="all-services" className="relative border-t border-line py-20 md:py-28" aria-labelledby="services-title">
          <SectionHeading
            eyebrow="Explore every service"
            titleId="services-title" title="Practical systems, built around your business." bold={4}
            lead="Websites, customer applications, and business tools. Explore the work you need, then talk with us about the right scope."
          />
          <ServicesBook services={services} refToken={campaign?.token} />
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
          <SectionHeading eyebrow="What you can expect" tone="sage" titleId="expect-title" title="No pressure. Just a clear path forward." bold={5} />
          <ExpectationsAccordion items={expectations} />
        </section>

        <section id="contact" className="py-12 md:py-20" aria-labelledby="cta-title">
          <div data-contact-cta className="relative isolate grid gap-10 overflow-hidden rounded-xl bg-inverse px-7 py-14 text-on-inverse sm:p-14 lg:grid-cols-12 lg:items-center lg:p-16">
            <div className="flex flex-col items-start gap-5 lg:col-span-7">
              <p className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
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
                <OpenMeetingButton size="lg" variant="dark" entryPoint="contact">{meetingLabel}</OpenMeetingButton>
                <OpenInquiryButton size="lg" variant="outline" intent="CONSULTATION">Request a consultation</OpenInquiryButton>
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
        columns={[{ title: "Website services", links: servicePages.map((page) => ({ label: page.label, href: servicePageHref(page.serviceSlug, campaign?.token)! })) }, { title: "Veloce", links: [{ label: "About", href: withReferral("/about", campaign?.token) }] }]}
      />
      <QuickDock
        shortcuts={links}
        columns={[
          { title: "Explore", links: links },
          { title: "What we build", links: services.slice(0, 5).map((s) => ({ label: s.title, href: "#services" })) },
        ]}
      />
      <ConversationFab search={search} actionLabel="meeting">
        <OpenMeetingButton data-primary-cta entryPoint="contact" aria-label={meetingLabel} className={fabClass}>
          <CalendarDays aria-hidden className="size-6 shrink-0" strokeWidth={2} />
          <span aria-hidden className={fabLabelClass}>{meetingLabel}</span>
        </OpenMeetingButton>
      </ConversationFab>
    </MeetingProvider>
    </InquiryProvider>
  );
}
