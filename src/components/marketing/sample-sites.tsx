"use client";
import { portfolioImageUrl } from "@/lib/security/portfolio-images";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { landing } from "@/content/site";
import type { ShowcaseSample } from "@/content/samples";
import { withReferral } from "@/content/seo";
import { OpenInquiryButton } from "@/components/forms/inquiry";
import { Button } from "@/components/ui/button";
import { CursorCard } from "@/components/ui/cursor-card";
import { DiagonalCarousel } from "@/components/ui/diagonal-carousel";

/*
 * "Tailored services" as sample websites: a diagonal carousel of each sample's home screen, landscape and framed as a
 * browser window. The active slide links to
 * the live preview and, on pointer devices, hovering any slide shows a cursor card with another page of the sample. The text
 * column repeats the active sample's details and links, so nothing depends on hover (touch, keyboard, screen readers).
 */
const useWide = () =>
  React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 640px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 640px)").matches,
    () => true,
  );

export function SampleSites({ samples, initialIndex = 0, refToken }: { samples: ShowcaseSample[]; initialIndex?: number; refToken?: string }) {
  const [active, setActive] = React.useState(initialIndex);
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).has("sample") && window.location.hash === "#services") {
      document.getElementById("examples")?.scrollIntoView();
    }
  }, []);
  // Announce the sample only when the visitor changed it, not on every auto-advance.
  const [announce, setAnnounce] = React.useState(false);
  const wide = useWide();
  const sample = samples[active] ?? samples[0]!;
  const copy = landing.samples;

  return (
    <div className="mt-10 grid items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-4" aria-live={announce ? "polite" : "off"}>
        <p className="text-[14px] font-medium text-muted">
          {copy.label} {active + 1} of {samples.length}
        </p>
        <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">{sample.title}</h3>
        <p className="text-[15px] leading-relaxed text-muted">{sample.description}</p>
        {sample.pages.length > 1 ? (
          <p className="text-[13px] text-muted">{sample.pages.map((p) => p.title).join(" · ")}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild variant="dark" size="sm">
            <Link href={sample.href}>
              {copy.previewCta}
              <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </Button>
          {sample.startSlug ? (
            <Button asChild variant="outline" size="sm">
              <Link href={withReferral(`/build?template=${encodeURIComponent(sample.startSlug)}`, refToken)}>{copy.startCta}</Link>
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 pt-1">
          <OpenInquiryButton variant="ghost" className="h-auto min-h-11 px-0 text-[14px] font-medium text-accent-700 underline-offset-4 hover:bg-transparent hover:underline">{copy.inquiryCta}</OpenInquiryButton>
          <a href="#all-services" className="inline-flex min-h-11 items-center text-[14px] font-medium text-accent-700 underline-offset-4 hover:underline">
            {copy.exploreCta}
          </a>
        </div>
      </div>

      <div className="relative isolate overflow-hidden rounded-xl bg-inverse">
        <DiagonalCarousel
          aria-label="Sample websites"
          items={samples.map((s) => ({ src: portfolioImageUrl(s.thumbnail), title: s.title, alt: `${s.title} home page`, href: s.href }))}
          activeIndex={active}
          onActiveIndexChange={(index, reason) => {
            setActive(index);
            setAnnounce(reason === "user");
          }}
          loop
          autoPlay={5000}
          slideSize={wide ? 470 : 260}
          slideAspect="16/10"
          rotationStep={24}
          inactiveScale={0.8}
          verticalStep={wide ? 128 : 84}
          className="h-[380px] rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink sm:h-[500px]"
          trackClassName="top-[45%]"
          viewportClassName="[--fade:linear-gradient(to_bottom,black_80%,transparent)] [mask-image:var(--fade)]"
          imageClassName="rounded-none object-top shadow-none"
          labelClassName="text-sm font-semibold text-white"
          wrapSlide={(slide, item, index, isActive) => {
            const s = samples[index]!;
            const inner = s.pages[1] ?? s.pages[0]!;
            return (
              <CursorCard
                image={portfolioImageUrl(inner.thumbnail ?? s.thumbnail)}
                title={s.pages.length > 1 ? `${item.title}: ${inner.title}` : item.title}
                description={`${s.description} ${isActive ? copy.hint : copy.selectHint}`}
                width={300}
                imageAspect="aspect-[16/10]"
              >
                <BrowserFrame>{slide}</BrowserFrame>
              </CursorCard>
            );
          }}
        />
      </div>
    </div>
  );
}

/* A browser window around a slide: a title bar with the three window dots and an address pill, then the screen. */
function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg bg-neutral-900 shadow-2xl ring-1 ring-white/20 sm:rounded-xl">
      <div aria-hidden className="flex h-4 items-center gap-1 border-b border-white/10 bg-neutral-800 px-2 sm:h-[22px] sm:gap-1.5 sm:px-2.5">
        <span className="size-1.5 rounded-full bg-[#ff5f57] sm:size-2" />
        <span className="size-1.5 rounded-full bg-[#febc2e] sm:size-2" />
        <span className="size-1.5 rounded-full bg-[#28c840] sm:size-2" />
        <span className="mx-auto h-2 w-2/5 rounded-full bg-white/10 sm:h-3" />
      </div>
      {children}
    </div>
  );
}
