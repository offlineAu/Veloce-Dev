"use client";

import * as React from "react";
import { AnimatePresence, m } from "framer-motion";
import { Plus } from "lucide-react";
import type { SearchEntry } from "@/lib/search";
import { SearchPalette } from "./search-palette";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/*
 * Floating action button for the page's main call to action. The button itself is passed in (it needs the form
 * provider); this wrapper reveals chat and site search above a hoverable launcher:
 *  - hidden (inert, so not focusable) while the hero call to action or closing contact card is on screen, then it
 *    fades in once the visitor scrolls past; it never covers those controls
 *  - on phone/tablet it sits above the quick dock, on desktop in the bottom-right corner
 *  - clicking it grows an accent wash out of the button while the form rises (skipped under reduced motion)
 * On a hover-capable desktop (lg and up) hovering opens the controls; everywhere else (phones, tablets, narrow windows,
 * touch) only a tap, click or Enter toggles them. Hover must not apply there: a mouse hover would open the panel and the
 * click that follows would shut it again, and touch fires pointerleave on release, which collapsed the panel before
 * taps on its buttons landed. Escape closes them.
 */
const HOVER_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 1024px)";
const hoverCapable = (event: React.PointerEvent) => event.pointerType === "mouse" && window.matchMedia(HOVER_QUERY).matches;

export function ConversationFab({ children, search = [] }: { children: React.ReactNode; search?: SearchEntry[] }) {
  const reduce = useReducedMotion();
  const [heroVisible, setHeroVisible] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);
  const panelId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [ripple, setRipple] = React.useState<{ x: number; y: number; id: number } | null>(null);

  React.useEffect(() => {
    const els = [...document.querySelectorAll("[data-hero-cta], [data-contact-cta]")];
    if (!els.length || typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setHeroVisible(false));
      return () => cancelAnimationFrame(id);
    }
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting);
      setHeroVisible([...seen.values()].some(Boolean));
    });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [expanded]);

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    setRipple({ x: r.left + r.width / 2, y: r.top + r.height / 2, id: Date.now() });
  };

  return (
    <div
      ref={rootRef}
      data-conversation-fab
      aria-hidden={heroVisible}
      {...(heroVisible ? { inert: true } : {})}
      onPointerEnter={(event) => { if (hoverCapable(event)) setExpanded(true); }}
      onPointerLeave={(event) => { if (hoverCapable(event) && !rootRef.current?.contains(document.activeElement)) setExpanded(false); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setExpanded(false);
          rootRef.current?.querySelector<HTMLButtonElement>("[data-fab-toggle]")?.focus();
        }
      }}
      className={cn(
        "fixed bottom-24 right-4 z-30 transition-[opacity,transform] duration-300 sm:right-6 lg:bottom-6 motion-reduce:transition-none",
        heroVisible && "pointer-events-none translate-y-4 scale-90 opacity-0",
      )}
    >
      {!heroVisible && !reduce ? (
        <span aria-hidden className="pointer-events-none absolute right-0 top-0 size-14 animate-ping rounded-full bg-accent/40 [animation-iteration-count:3]" />
      ) : null}
      <div
        id={panelId}
        {...(!expanded ? { inert: true } : {})}
        aria-hidden={!expanded}
        className={cn(
          "absolute bottom-full right-0 flex w-[min(18rem,calc(100vw-2rem))] origin-bottom-right flex-col items-end gap-3 pb-4 transition-[opacity,transform,visibility] duration-300 motion-reduce:transition-none",
          expanded ? "visible translate-y-0 scale-100 opacity-100" : "pointer-events-none invisible translate-y-6 scale-95 opacity-0",
        )}
      >
        {search.length ? <SearchPalette entries={search} variant="bar" /> : null}
        <div onClickCapture={onClickCapture}>{children}</div>
      </div>
      <button
        type="button"
        data-fab-toggle
        aria-label={expanded ? "Close chat and search" : "Open chat and search"}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
        className="relative grid size-14 place-items-center rounded-full border border-accent-300/40 bg-gradient-to-br from-accent-300 via-accent-600 to-accent-700 text-on-accent shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none"
      >
        <Plus aria-hidden className={cn("size-6 transition-transform duration-300 motion-reduce:transition-none", expanded && "rotate-45")} />
      </button>
      <AnimatePresence>
        {ripple ? (
          <m.span
            key={ripple.id}
            aria-hidden
            className="pointer-events-none fixed z-40 size-14 rounded-full bg-accent"
            style={{ left: ripple.x - 28, top: ripple.y - 28 }}
            initial={{ scale: 1, opacity: 0.55 }}
            animate={{ scale: 48, opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setRipple(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
