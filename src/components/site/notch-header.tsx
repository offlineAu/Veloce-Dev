"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, Palette, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PaletteChoices, ThemeManager, useThemeChoice } from "./theme-manager";

/*
 * Notched header. Shape after VengeanceUI "notch-navbar": two thin side bars joined by a taller centre "notch"
 * with curved shoulders and hairline rules. Tweaks for Veloce:
 *  - themed with the page tokens instead of zinc/black, no theme toggle, no login/sign-up
 *  - scroll-spy: the link for the section in view is marked (aria-current="location")
 *  - mobile menu is a shadcn Sheet; the conversation call to action is a floating button (ConversationFab), not part of the bar
 *  - below lg, once the quick dock is on screen the bar keeps only the logo (the dock then owns links and palette, so there is one menu, not two)
 *  - the menu holds the section links, the colour palette picker and the conversation call to action
 *  - fixed to the top with a spacer so layout does not jump; shadow only under the bar
 */
export interface NavLink {
  href: string;
  label: string;
}

const RULE = "text-ink";

export function useActiveSection(links: NavLink[]) {
  const [active, setActive] = React.useState<string | null>(null);
  React.useEffect(() => {
    const ids = links.map((l) => l.href).filter((h) => h.startsWith("#")).map((h) => h.slice(1));
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        const best = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
        setActive(best && best[1] > 0 ? `#${best[0]}` : null);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.1, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [links]);
  return active;
}

function Rules({ y1, y2 }: { y1: number; y2: number }) {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="none">
      <line x1="0" y1={y1} x2="100%" y2={y1} stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.75} className={RULE} />
      <line x1="0" y1={y2} x2="100%" y2={y2} stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.75} className={RULE} />
    </svg>
  );
}

function Corner({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <div className={cn("relative h-full w-[50px] shrink-0", !left && "-ml-px")}>
      <div
        className="absolute inset-0 bg-neutral-100"
        style={{ clipPath: left ? "path('M0 0 H50 V64 C25 64 25 40 0 40 Z')" : "path('M0 0 H50 V40 C25 40 25 64 0 64 Z')" }}
      />
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 50 64">
        <path
          d={left ? "M0 39.5 C25 39.5 25 63.5 50 63.5" : "M0 63.5 C25 63.5 25 39.5 50 39.5"}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={0.75}
          className={RULE}
        />
      </svg>
    </div>
  );
}

function NavItem({ link, active, register }: { link: NavLink; active: boolean; register: (href: string, el: HTMLElement | null) => void }) {
  return (
    <a
      ref={(el) => register(link.href, el)}
      href={link.href}
      aria-current={active ? "location" : undefined}
      className={cn(
        "relative z-10 -mx-3 whitespace-nowrap rounded-full px-3 py-1.5 text-[15px] font-medium transition-colors duration-200 hover:text-ink",
        active ? "text-ink" : "text-muted",
      )}
    >
      {link.label}
    </a>
  );
}

export function NotchHeader({
  companyName,
  links,
  menuCta,
}: {
  companyName: string;
  links: NavLink[];
  /** Labelled call to action shown at the bottom of the mobile menu. */
  menuCta?: React.ReactNode;
}) {
  const active = useActiveSection(links);
  const palette = useThemeChoice();
  const [menu, setMenu] = React.useState(false);
  // Same threshold as the quick dock: once it is on screen, the header keeps only the logo and the conversation button.
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    const on = () => setCompact(window.scrollY > 480);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // Sliding pill: one absolutely positioned element, moved to the active link's box (links live in two nav groups).
  const barRef = React.useRef<HTMLDivElement>(null);
  const items = React.useRef(new Map<string, HTMLElement>());
  const register = React.useCallback((href: string, el: HTMLElement | null) => {
    if (el) items.current.set(href, el);
    else items.current.delete(href);
  }, []);
  const [pill, setPill] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pillReady, setPillReady] = React.useState(false);
  const measure = React.useCallback(() => {
    const bar = barRef.current;
    const el = active ? items.current.get(active) : null;
    if (!bar || !el || !el.offsetWidth) return setPill(null);
    const b = bar.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({ x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height });
  }, [active]);
  React.useLayoutEffect(measure, [measure, compact]);
  React.useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [measure]);
  // Skip the glide for the very first placement so the pill does not fly in from the corner.
  React.useEffect(() => {
    if (!pill || pillReady) return;
    const frame = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(frame);
  }, [pill, pillReady]);
  const half = Math.ceil(links.length / 2);
  const left = links.slice(0, half);
  const right = links.slice(half);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 [filter:drop-shadow(0_6px_8px_rgba(42,39,51,0.07))]">
        <div className="relative z-20 h-10 min-w-0 flex-1 bg-neutral-100">
          <Rules y1={39.5} y2={39.5} />
        </div>

        <div className="relative z-10 -ml-px flex h-16 w-full max-w-[1120px] shrink-0 md:w-[min(100%,1120px)]">
          <Corner side="left" />
          <div className="relative -ml-px min-w-0 flex-1">
            <div className="absolute inset-0 bg-neutral-100">
              <Rules y1={63.5} y2={63.5} />
            </div>
            <div ref={barRef} className={cn("relative flex h-full items-center justify-between gap-3 px-2 pb-2 md:px-6", compact && "max-lg:justify-center")}>
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-0 top-0 z-0 rounded-full bg-accent/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-accent)_25%,transparent)] motion-reduce:transition-none",
                  pillReady && "transition-[transform,width,height,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                )}
                style={{
                  width: pill?.w ?? 0,
                  height: pill?.h ?? 0,
                  transform: `translate(${pill?.x ?? 0}px, ${pill?.y ?? 0}px)`,
                  opacity: pill ? 1 : 0,
                }}
              />
              <nav aria-label="Main" className={cn("hidden items-center gap-7", compact ? "lg:flex" : "md:flex")}>
                {left.map((l) => (
                  <NavItem key={l.href} link={l} active={active === l.href} register={register} />
                ))}
              </nav>

              <Sheet open={menu} onOpenChange={setMenu}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      "md:hidden",
                      compact && "hidden",
                    )}
                  >
                    <span className="sr-only">Open menu</span>
                    <Menu aria-hidden className="size-6" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" showCloseButton={false} className="w-[min(86vw,360px)] gap-0 border-line bg-bg p-0">
                  <SheetHeader className="flex-row items-center gap-3 border-b border-line p-4 pr-3">
                    <LogoMark className="size-7 text-ink" />
                    <div className="min-w-0 flex-1">
                      <SheetTitle className="truncate font-heading text-xl">{companyName}</SheetTitle>
                      <SheetDescription className="sr-only">Site navigation, colour palette and contact</SheetDescription>
                    </div>
                    <SheetClose className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
                      <X aria-hidden className="size-5" />
                      <span className="sr-only">Close menu</span>
                    </SheetClose>
                  </SheetHeader>
                  <div className="flex flex-1 flex-col overflow-y-auto">
                    <nav aria-label="Mobile" className="flex flex-col gap-1 p-3">
                      <p className="flex items-center gap-2 px-3 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                        <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                        Explore
                      </p>
                      {links.map((l) => (
                        <SheetClose asChild key={l.href}>
                          <a
                            href={l.href}
                            aria-current={active === l.href ? "location" : undefined}
                            className={cn(
                              "group flex min-h-12 items-center justify-between rounded-xl border px-3 text-base font-medium transition-colors",
                              active === l.href ? "border-accent/40 bg-accent/10 text-ink" : "border-transparent text-ink hover:bg-ink/5",
                            )}
                          >
                            {l.label}
                            <ArrowUpRight aria-hidden className="size-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                          </a>
                        </SheetClose>
                      ))}
                    </nav>
                    <section aria-labelledby="menu-palette" className="mx-3 mt-1 rounded-2xl border border-line bg-neutral-100 p-3">
                      <h2 id="menu-palette" className="mb-3 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                        <Palette aria-hidden className="size-4" />
                        Colour palette
                      </h2>
                      <PaletteChoices compact theme={palette.theme} onSelect={palette.set} />
                      <p className="mt-2.5 px-1 text-[13px] text-muted">Remembered in this browser.</p>
                    </section>
                  </div>
                  {menuCta ? (
                    <div className="border-t border-line bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={() => setMenu(false)}>
                      {menuCta}
                    </div>
                  ) : null}
                </SheetContent>
              </Sheet>

              <Link href="/" className="flex shrink-0 items-center gap-2.5 font-heading text-lg text-ink" aria-label={`${companyName} home`}>
                <LogoMark className="size-7" />
                <span>{companyName}</span>
              </Link>

              <div className="flex items-center gap-1 md:gap-3">
                <nav aria-label="More" className={cn("hidden items-center gap-7", compact ? "lg:flex" : "md:flex")}>
                  {right.map((l) => (
                    <NavItem key={l.href} link={l} active={active === l.href} register={register} />
                  ))}
                </nav>
                <ThemeManager className={cn("hidden md:grid", compact && "max-lg:hidden")} />
              </div>
            </div>
          </div>
          <Corner side="right" />
        </div>

        <div className="relative z-20 -ml-px h-10 min-w-0 flex-1 bg-neutral-100">
          <Rules y1={39.5} y2={39.5} />
        </div>
      </header>
      <div aria-hidden className="h-16" />
    </>
  );
}
