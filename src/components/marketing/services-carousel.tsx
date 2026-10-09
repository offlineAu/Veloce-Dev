"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { landing, servicePaths, type ServiceItem } from "@/content/site";
import { OpenInquiryButton } from "@/components/forms/inquiry";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/*
 * "Tailored services" row from the reference design: one dark featured card, then a card per service, scrolled with
 * the arrow buttons (or swipe / trackpad). Scroll-snap keeps cards aligned; the arrows disable at either end.
 * The full interactive list stays in ServicesExplorer further down the page.
 */
const categoryOf = (slug: string) => servicePaths.find((p) => (p.slugs as readonly string[]).includes(slug))?.label ?? "Custom work";

export function ServicesCarousel({ services, photo, closingPhoto }: { services: ServiceItem[]; photo?: string; closingPhoto?: string }) {
  const track = React.useRef<HTMLUListElement>(null);
  const [edge, setEdge] = React.useState({ start: true, end: false });

  const update = React.useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  React.useEffect(() => {
    update();
    const el = track.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const step = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>("li");
    if (!el || !card) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && document.documentElement.dataset.motion !== "reduced";
    el.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: smooth ? "smooth" : "instant" });
  };

  const arrow =
    "grid size-11 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-neutral-200 disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="mt-10 flex flex-col gap-6">
      <div className="flex justify-end gap-2 md:-mt-24">
        <button type="button" className={arrow} onClick={() => step(-1)} disabled={edge.start}>
          <span className="sr-only">Previous services</span>
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <button type="button" className={arrow} onClick={() => step(1)} disabled={edge.end}>
          <span className="sr-only">Next services</span>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <ul
        ref={track}
        onScroll={update}
        aria-label="Services"
        className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] sm:-mx-10 sm:scroll-px-10 sm:px-10 lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <li className="relative flex min-h-[380px] w-[78vw] max-w-[300px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl bg-inverse p-6 text-on-inverse shadow-sm sm:w-[calc((100%-2*20px)/3)] lg:w-[calc((100%-3*20px)/4)] lg:max-w-none">
          {photo ? (
            <Image src={photo} unoptimized alt="" fill sizes="(min-width: 1024px) 300px, 78vw" className="object-cover opacity-80" />
          ) : (
            <div aria-hidden className="ring-pattern absolute -bottom-40 -right-40 size-[520px] rounded-full opacity-60 invert" />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <span className="relative self-end rounded bg-accent px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-on-accent shadow">
            {landing.featured.badge}
          </span>
          <div className="relative flex flex-col gap-3">
            <h3 className="text-xl font-bold tracking-tight text-on-inverse">{landing.featured.title}</h3>
            <p className="text-[13px] leading-relaxed text-on-inverse/75">{landing.featured.body}</p>
            <OpenInquiryButton size="sm" className="w-full">{landing.featured.cta}</OpenInquiryButton>
          </div>
        </li>
        {services.map((s) => (
          <li
            key={s.slug}
            className="group flex min-h-[380px] w-[78vw] max-w-[300px] shrink-0 snap-start flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-sm transition-shadow hover:shadow-md sm:w-[calc((100%-2*20px)/3)] lg:w-[calc((100%-3*20px)/4)] lg:max-w-none"
          >
            <div className="flex flex-col items-center text-center">
              <span className="mb-6 rounded border border-line bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                {categoryOf(s.slug)}
              </span>
              <h3 className="mb-5 text-lg font-bold leading-snug tracking-tight text-ink">{s.title}</h3>
              <div aria-hidden className="flex h-28 w-16 flex-col items-center justify-between rounded-xl border-2 border-line bg-neutral-100 p-2 shadow-inner transition-colors group-hover:border-ink/30">
                <span className="h-1.5 w-6 rounded-full bg-ink/15" />
                <span className="grid size-9 place-items-center rounded-lg bg-inverse text-accent">
                  <Icon name={s.icon} className="size-4" />
                </span>
                <span className="h-1.5 w-10 rounded-full bg-accent" />
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-line/60 pt-6 text-center">
              <OpenInquiryButton
                service={{ slug: s.slug, title: s.title }}
                variant="dark"
                size="sm"
                className="w-full"
                aria-label={`Ask about ${s.title}`}
              >
                Ask about this
              </OpenInquiryButton>
              <p className={cn("text-[12px] text-muted")}>{s.benefit}</p>
            </div>
          </li>
        ))}
        <li className="relative flex min-h-[380px] w-[78vw] max-w-[300px] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl bg-inverse p-6 text-on-inverse shadow-sm sm:w-[calc((100%-2*20px)/3)] lg:w-[calc((100%-3*20px)/4)] lg:max-w-none">
          {closingPhoto ? <Image src={closingPhoto} unoptimized alt="" fill sizes="(min-width: 1024px) 300px, 78vw" className="object-cover opacity-80" /> : null}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
          <div className="relative flex flex-col gap-3">
            <h3 className="text-xl font-bold tracking-tight text-on-inverse">{landing.closing.title}</h3>
            <p className="text-[13px] leading-relaxed text-on-inverse/75">{landing.closing.body}</p>
            <a href="#all-services" className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-on-inverse/25 bg-on-inverse/10 px-5 text-[15px] font-semibold text-on-inverse backdrop-blur-md transition-colors hover:bg-on-inverse/20">
              {landing.closing.cta}
            </a>
          </div>
        </li>
      </ul>
    </div>
  );
}
