import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Heart, MessageCircle, MessageCircleMore } from "lucide-react";
import { env } from "@/config/env";
import { IntroductionProvider, OpenIntroductionButton } from "@/components/forms/introduction";
import { ShareActions } from "@/components/forms/share-actions";
import { ProcessStep, ReferralBadge, ReferralOfferCard, SectionHeading, ServiceCard } from "@/components/marketing/cards";
import { HighlightGrid } from "@/components/motion/highlight-grid";
import { Reveal } from "@/components/motion/reveal";
import { buildSearchEntries } from "@/lib/search";
import { BrowserMock } from "@/components/marketing/mockups";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { fabClass, fabLabelClass } from "@/components/site/cta-style";
import { ConversationFab } from "@/components/site/conversation-fab";
import { QuickDock } from "@/components/site/quick-dock";
import { buttonVariants } from "@/components/ui/button";
import { brand, philosophy, referralSteps } from "@/content/site";
import { formatOfferDate } from "@/lib/offer";
import { buildProspectLink, buildShareMessage } from "@/lib/share";
import { initials } from "@/lib/utils";
import { getPublicCampaign } from "@/server/services/campaign";
import { getCompanyProfile } from "@/server/services/company";
import { getServices } from "@/server/services/services";

// Personal pages: never indexed, never cached, no identifying details in metadata.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Introduce someone to us",
    description: "Share a web development team with someone who could use a better website.",
    robots: { index: false, follow: false, nocache: true },
    openGraph: { title: "Introduce someone to us", description: "Share a web development team with someone who could use a better website." },
  };
}

export default async function ReferralPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [campaign, company, services] = await Promise.all([
    getPublicCampaign(token, { audience: "referrer" }),
    getCompanyProfile(),
    getServices(),
  ]);
  if (!campaign) notFound();

  const name = campaign.referrerName;
  const offerActive = campaign.offer.state === "active";
  const link = buildProspectLink(env().NEXT_PUBLIC_SITE_URL, campaign.token);
  const message = buildShareMessage({
    companyName: company.name,
    link,
    offerTitle: offerActive ? campaign.offer.title : null,
  });
  const validUntil = campaign.offer.expiresAt ? formatOfferDate(campaign.offer.expiresAt, company.timezone) : null;

  const links = [
    { href: "#what-we-do", label: "What we do" },
    ...(offerActive ? [{ href: "#offer", label: "The offer" }] : []),
    { href: "#share", label: "Share" },
  ];
  const search = buildSearchEntries({ links, services, email: company.contactEmail, ctaLabel: "Make an introduction" });

  return (
    <IntroductionProvider companyName={company.name} contactEmail={company.contactEmail} refToken={campaign.token}>
      <SiteHeader
        companyName={company.name}
        links={links}
        menuCta={<OpenIntroductionButton className="w-full">Make an introduction</OpenIntroductionButton>}
      />
      <main id="main" className="mx-auto max-w-page px-5 sm:px-10 lg:px-16">
        <section className="grid items-center gap-12 py-16 md:grid-cols-2 md:py-28" aria-labelledby="hero-title">
          <div className="flex flex-col items-start gap-6">
            <p className="rounded-full bg-accent-100 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-accent-800">
              Client referral
            </p>
            <h1 id="hero-title" className="text-[clamp(38px,5.2vw,66px)] leading-[1.06] tracking-tight">
              Your idea shouldn&apos;t stay an idea.
            </h1>
            <p className="max-w-[46ch] text-[18px] leading-relaxed text-muted">
              Know a business with an idea, a process or a problem that software could fix? Introduce them to {company.name}. You can send
              them a ready-made message, or tell us about them directly.
            </p>
            <div className="flex flex-wrap gap-3">
              <OpenIntroductionButton size="lg" data-hero-cta>
                Make an introduction <ArrowRight aria-hidden className="size-[18px]" strokeWidth={2.75} />
              </OpenIntroductionButton>
              <a href="#share" className={buttonVariants({ variant: "outline", size: "lg" })}>Share a message</a>
            </div>
            {name ? <ReferralBadge name={name} initials={initials(name)} /> : null}
          </div>
          <div aria-hidden className="relative mx-auto w-full max-w-md">
            <div className="absolute right-0 -top-8 size-56 rounded-full bg-sage-200" />
            <div className="absolute -bottom-6 left-0 size-32 rounded-full bg-accent-200" />
            <BrowserMock className="relative" />
          </div>
        </section>

        <section className="grid gap-8 py-12 md:grid-cols-3 md:py-20" aria-labelledby="note-title">
          <SectionHeading eyebrow="A personal note" titleId="note-title" title="Passed along by someone you know." className="md:col-span-1" />
          <figure className="flex flex-col gap-6 rounded-xl bg-surface p-8 sm:p-12 md:col-span-2">
            <MessageCircle aria-hidden className="size-9 text-accent" strokeWidth={2} />
            <blockquote className="max-w-[44ch] text-[clamp(19px,2vw,24px)] leading-relaxed">
              &ldquo;{campaign.personalMessage ??
                `I wanted to pass along a web development team, in case you or someone in your network is looking to build or improve a website.`}&rdquo;
            </blockquote>
            {name ? (
              <figcaption className="flex items-center gap-3.5 text-[15px]">
                <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-sage-700 font-bold text-on-sage">{initials(name)}</span>
                <span className="flex flex-col">
                  <strong className="font-semibold">{name}</strong>
                  {campaign.referrerRole || campaign.referrerCompany ? (
                    <span className="text-muted">{[campaign.referrerRole, campaign.referrerCompany].filter(Boolean).join(" · ")}</span>
                  ) : null}
                </span>
              </figcaption>
            ) : null}
          </figure>
        </section>

        <section id="what-we-do" className="py-16 md:py-24" aria-labelledby="wwd-title">
          <SectionHeading
            eyebrow="What we do"
            titleId="wwd-title" title="Fast, practical systems built around the business."
            lead={brand.short}
          />
          <HighlightGrid className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.slice(0, 4).map((s, i) => (
              <Reveal key={s.slug} cell delay={i * 0.06} className="h-full">
                <ServiceCard index={i} title={s.title} description={s.description} icon={s.icon} />
              </Reveal>
            ))}
          </HighlightGrid>
        </section>

        <section className="py-12 md:py-20" aria-labelledby="why-title">
          <SectionHeading eyebrow="Why work with us" tone="sage" titleId="why-title" title="Build fast. Build what works." />
          <ul className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {philosophy.map((x, i) => (
              <Reveal as="li" delay={(i % 3) * 0.06} key={x.title} className="flex gap-4">
                <span aria-hidden className="mt-2 size-3.5 shrink-0 rounded-full bg-sage" />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[21px] leading-tight">{x.title}</h3>
                  <p className="text-[15.5px] leading-relaxed text-muted">{x.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </section>

        <section id="offer" className="py-12 md:py-20" aria-label="Referral offer">
          {offerActive ? (
            <ReferralOfferCard
              variant="dark"
              title={campaign.offer.title}
              description={campaign.offer.description}
              validUntil={validUntil}
              blocks={[
                { label: "What you get", text: "The offer described above, for the person you introduce." },
                { label: "Why you get it", text: "It is attached to introductions made through your link." },
                { label: "How to claim", text: "Share the link below. When someone gets in touch through it, the offer is attached to their inquiry automatically." },
              ]}
              claim="Share the link below. When someone gets in touch through it, the offer is attached to their inquiry automatically."
            >
              <OpenIntroductionButton variant="light" size="lg">Claim with an introduction</OpenIntroductionButton>
            </ReferralOfferCard>
          ) : campaign.offer.state === "expired" ? (
            <p className="rounded-lg bg-neutral-200 p-6 text-[15px] text-muted">
              The offer attached to this link has ended. Introductions are still welcome.
            </p>
          ) : null}
        </section>

        <section className="py-12 md:py-20" aria-labelledby="how-title">
          <SectionHeading eyebrow="How it works" titleId="how-title" title="Three steps. No sales funnel." />
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {referralSteps.map((s, i) => <ProcessStep key={s.title} n={i + 1} title={s.title} body={s.body} />)}
          </ol>
        </section>

        <section id="share" className="grid gap-10 py-16 md:grid-cols-3 md:py-24" aria-labelledby="share-title">
          <SectionHeading
            eyebrow="Ready to share"
            titleId="share-title" title="We wrote the message. You just send it."
            lead="Copy it as it is or make it your own. Paste it into a text, an email or wherever you usually talk."
            className="md:col-span-1"
          />
          <div className="md:col-span-2">
            <ShareActions initialMessage={message} link={link} emailSubject={`A website team I'd recommend`} />
          </div>
        </section>

        <section className="py-12 md:py-20" aria-labelledby="cta-title">
          <div className="flex flex-col items-start gap-5 rounded-xl bg-sage-100 p-8 sm:p-14">
            <h2 id="cta-title" className="max-w-[20ch] text-[clamp(30px,4vw,50px)] leading-[1.08]">Know someone whose idea should be working software?</h2>
            <p className="max-w-[44ch] text-[18px] leading-relaxed text-sage-800">Introduce them to our team and we&apos;ll explore what we can build together.</p>
            <OpenIntroductionButton size="lg">Make an introduction</OpenIntroductionButton>
          </div>
        </section>

        <section className="max-w-3xl py-12 md:py-20">
          <Heart aria-hidden className="mb-4 size-8 text-accent" strokeWidth={2} />
          <p className="font-heading text-[clamp(22px,2.6vw,32px)] leading-snug">
            Thanks for helping us connect with people in your network. We appreciate the introduction.
          </p>
          <p className="mt-4 text-muted">The {company.name} team</p>
        </section>
      </main>
      <SiteFooter name={company.name} description={company.description} email={company.contactEmail} websiteUrl={company.websiteUrl} channels={company.channels} />
      <QuickDock
        shortcuts={links}
        columns={[
          { title: "Explore", links },
          { title: "What we build", links: services.slice(0, 4).map((s) => ({ label: s.title, href: "#what-we-do" })) },
        ]}
      />
      <ConversationFab search={search}>
        <OpenIntroductionButton data-primary-cta aria-label="Make an introduction" className={fabClass}>
          <MessageCircleMore aria-hidden className="size-6 shrink-0" strokeWidth={2} />
          <span aria-hidden className={fabLabelClass}>Make an introduction</span>
        </OpenIntroductionButton>
      </ConversationFab>
    </IntroductionProvider>
  );
}
