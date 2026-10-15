"use client";

import * as React from "react";
import Image from "next/image";
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
 * "Tailored services" as sample websites: a diagonal carousel of each sample's home screen. The active slide links to
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

export function SampleSites({ samples, photo, initialIndex = 0, refToken }: { samples: ShowcaseSample[]; photo?: string; initialIndex?: number; refToken?: string }) {
  const [active, setActive] = React.useState(initialIndex);
  const wide = useWide();
  const sample = samples[active] ?? samples[0]!;
  const copy = landing.samples;

  return (
    <div className="mt-10 grid items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-4" aria-live="polite">
        <span className="w-fit rounded border border-line bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
          {copy.label} {active + 1} / {samples.length}
        </span>
        <h3 className="text-2xl font-bold tracking-tight text-ink">{sample.title}</h3>
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
          <OpenInquiryButton size="sm" variant="ghost">{copy.inquiryCta}</OpenInquiryButton>
        </div>
        <a href="#all-services" className="w-fit text-[14px] font-semibold text-accent-700 underline-offset-4 hover:underline">
          {copy.exploreCta}
        </a>
      </div>

      <div className="relative isolate overflow-hidden rounded-3xl bg-inverse [--stage-y:157px] sm:[--stage-y:204px]">
        <StageBackdrop photo={photo} />
        <DiagonalCarousel
          aria-label="Sample websites"
          items={samples.map((s) => ({ src: s.thumbnail, title: s.title, alt: `${s.title} home page`, href: s.href }))}
          activeIndex={active}
          onActiveIndexChange={setActive}
          loop
          slideSize={wide ? 240 : 170}
          slideAspect="3/4"
          verticalStep={wide ? 140 : 100}
          className="h-[440px] rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink sm:h-[520px]"
          trackClassName="top-4"
          viewportClassName="[--fade:linear-gradient(to_bottom,black_80%,transparent)] [mask-image:var(--fade)]"
          imageClassName="object-top"
          labelClassName="font-semibold text-white"
          wrapSlide={(slide, item, index, isActive) => {
            const s = samples[index]!;
            const inner = s.pages[1] ?? s.pages[0]!;
            return (
              <CursorCard
                image={inner.thumbnail ?? s.thumbnail}
                title={s.pages.length > 1 ? `${item.title}: ${inner.title}` : item.title}
                description={`${s.description} ${isActive ? copy.hint : copy.selectHint}`}
              >
                {slide}
              </CursorCard>
            );
          }}
        />
      </div>
    </div>
  );
}

/*
 * The stage behind the carousel: a darkened studio photo (a plain dark panel without one), a solid deep disc that the
 * front slide sits on, a hand-dashed orbit around it with two small accent nodes, and a few sparkles. Line work is
 * light so it reads on the dark photo; the accent follows the palette.
 */
function StageBackdrop({ photo }: { photo?: string }) {
  const sparkle = "M10 0c.6 5.6 4.4 9.4 10 10-5.6.6-9.4 4.4-10 10-.6-5.6-4.4-9.4-10-10C5.6 9.4 9.4 5.6 10 0Z";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {photo ? (
        <>
          <Image src={photo} alt="" fill sizes="(min-width: 768px) 60vw, 100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-black/30" />
        </>
      ) : null}
      <div className="absolute left-1/2 top-[calc(var(--stage-y)+44px)] size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-deep/45 shadow-2xl ring-1 ring-white/15 backdrop-blur-[2px] sm:size-[400px]" />
      <svg viewBox="0 0 560 560" fill="none" className="absolute left-1/2 top-[calc(var(--stage-y)+44px)] size-[420px] -translate-x-1/2 -translate-y-1/2 text-white sm:size-[560px]">
        <circle cx="280" cy="280" r="270" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" strokeDasharray="2 9" strokeLinecap="round" />
        <circle cx="38" cy="160" r="9" className="fill-accent" stroke="currentColor" strokeWidth="2" />
        <circle cx="522" cy="400" r="9" className="fill-accent" stroke="currentColor" strokeWidth="2" />
      </svg>
      <svg viewBox="0 0 20 20" className="absolute left-[10%] top-[14%] size-5 fill-white opacity-60"><path d={sparkle} /></svg>
      <svg viewBox="0 0 20 20" className="absolute bottom-[18%] right-[9%] size-7 fill-white opacity-50"><path d={sparkle} /></svg>
      <svg viewBox="0 0 20 20" className="absolute right-[18%] top-[8%] size-3 fill-white opacity-40"><path d={sparkle} /></svg>
    </div>
  );
}
