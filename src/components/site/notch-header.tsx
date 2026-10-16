"use client";

import * as React from "react";
import Link from "next/link";
import { m } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, Palette, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NavigationLink } from "./navigation-link";
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
  // Header and dock can pass newly allocated arrays without restarting the observers.
  const sectionKey = [...new Set(links.map(link => link.href).filter(href => href.startsWith("#")))].join(" ");
  React.useEffect(() => {
    const els = sectionKey.split(" ").map(href => document.getElementById(href.slice(1)))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const ordered = els.map(el => {
        const bounds = el.getBoundingClientRect();
        return { el, top: bounds.top, bottom: bounds.bottom };
      }).sort((a, b) => a.top - b.top);
      const current = ordered.filter(item => item.top <= offset + 2).at(-1);
      setActive(current && current.bottom > offset + 2 ? `#${current.el.id}` : null);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    els.forEach(el => observer.observe(el));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [sectionKey]);
  return active;
}

export function useActiveNavigation(links: NavLink[]) {
  const section = useActiveSection(links);
  const pathname = usePathname();
  const page = links.find(link => link.href.startsWith("/") && !link.href.includes("#") && link.href.split("?")[0] === pathname);
  return section ?? page?.href ?? null;
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

function NavItem({ link, active, selected, onSelect, register }: { link: NavLink; active: boolean; selected: boolean; onSelect: (href: string) => void; register: (href: string, el: HTMLElement | null) => void }) {
  return (
    <NavigationLink
      ref={(el) => register(link.href, el)}
      href={link.href}
      onClick={event => {
        if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && link.href.startsWith("#")) onSelect(link.href);
      }}
      aria-current={active ? (link.href.startsWith("#") ? "location" : "page") : undefined}
      className={cn(
        "relative z-10 -mx-3 whitespace-nowrap rounded-full px-3 py-1.5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-700",
        selected ? "text-on-inverse delay-100" : "text-muted hover:text-ink",
      )}
    >
      {link.label}
    </NavigationLink>
  );
}

export function NotchHeader({
  companyName,
  links,
  menuCta,
  homeHref = "/",
  compactOnScroll = true,
}: {
  companyName: string;
  homeHref?: string;
  compactOnScroll?: boolean;
  links: NavLink[];
  /** Labelled call to action shown at the bottom of the mobile menu. */
  menuCta?: React.ReactNode;
}) {
  const active = useActiveNavigation(links);
  const reduce = useReducedMotion();
  const [destination, setDestination] = React.useState<string | null>(null);
  const highlighted = destination ?? active;
  // Keep a clicked destination highlighted while native smooth scrolling crosses other sections.
  React.useEffect(() => {
    if (!destination) return;
    const finish = () => setDestination(null);
    let quiet = window.setTimeout(finish, 250);
    const onScroll = () => {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(finish, 150);
    };
    const deadline = window.setTimeout(finish, 2000);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", finish);
    return () => {
      window.clearTimeout(quiet);
      window.clearTimeout(deadline);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", finish);
    };
  }, [destination]);
  const palette = useThemeChoice();
  const [menu, setMenu] = React.useState(false);
  // Same threshold as the quick dock: once it is on screen, the header keeps only the logo and the conversation button.
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    const on = () => setCompact(compactOnScroll && window.scrollY > 480);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [compactOnScroll]);
  // Sliding pill: one absolutely positioned element, moved to the active link's box (links live in two nav groups).
  const barRef = React.useRef<HTMLDivElement>(null);
  const items = React.useRef(new Map<string, HTMLElement>());
  const register = React.useCallback((href: string, el: HTMLElement | null) => {
    if (el) items.current.set(href, el);
    else items.current.delete(href);
  }, []);
  const [pill, setPill] = React.useState<{ x: number; y: number; w: number; h: number; visible: boolean } | null>(null);
  const [pillReady, setPillReady] = React.useState(false);
  const measure = React.useCallback(() => {
    const bar = barRef.current;
    const el = highlighted ? items.current.get(highlighted) : null;
    if (!bar || !el || !el.offsetWidth) {
      setPill(previous => previous?.visible ? { ...previous, visible: false } : previous);
      return;
    }
    const b = bar.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({ x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, visible: true });
  }, [highlighted]);
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
      <header className="fixed inset-x-0 top-0 z-40 flex h-[var(--site-header-height)] [filter:drop-shadow(0_6px_8px_rgba(42,39,51,0.07))]">
        <div className="relative z-20 h-10 min-w-0 flex-1 bg-neutral-100">
          <Rules y1={39.5} y2={39.5} />
        </div>

        <div className="relative z-10 -ml-px flex h-16 w-full max-w-[1120px] shrink-0 md:w-[min(100%,1120px)]">
          <Corner side="left" />
          <div className="relative -ml-px min-w-0 flex-1">
            <div className="absolute inset-0 bg-neutral-100">
              <Rules y1={63.5} y2={63.5} />
            </div>
            {/* Equal outer tracks keep the logo dead-centre whatever sits on either side. */}
            <div ref={barRef} className="relative grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-2 pb-2 md:px-6">
              <m.span
                aria-hidden
                data-nav-highlight
                initial={false}
                className="pointer-events-none absolute left-0 top-0 z-0 rounded-full bg-inverse shadow-[inset_0_1px_0_#ffffff26,0_2px_5px_#201e1d24]"
                animate={{
                  x: pill?.x ?? 0,
                  y: pill?.y ?? 0,
                  width: pill?.w ?? 0,
                  height: pill?.h ?? 0,
                  opacity: pill?.visible ? 1 : 0,
                }}
                transition={reduce || !pillReady ? { duration: 0 } : {
                  type: "spring", stiffness: 420, damping: 38, mass: 0.7,
                  opacity: { duration: 0.16 },
                }}
              >
                <span className="absolute inset-x-3 bottom-[3px] mx-auto h-0.5 w-4 rounded-full bg-accent-300" />
              </m.span>
              <div className="flex min-w-0 items-center justify-self-start">
                <nav aria-label="Main" className={cn("hidden items-center gap-7", compact ? "lg:flex" : "md:flex")}>
                  {left.map((l) => (
                    <NavItem key={l.href} link={l} active={active === l.href} selected={highlighted === l.href} onSelect={setDestination} register={register} />
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
                            <NavigationLink
                              href={l.href}
                              aria-current={active === l.href ? (l.href.startsWith("#") ? "location" : "page") : undefined}
                              className={cn(
                                "group flex min-h-12 items-center justify-between rounded-xl border px-3 text-base font-medium transition-colors",
                                active === l.href ? "border-inverse bg-inverse text-on-inverse shadow-sm" : "border-transparent text-ink hover:bg-ink/5",
                              )}
                            >
                              {l.label}
                              <ArrowUpRight aria-hidden className={cn("size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5", active === l.href ? "text-accent-300" : "text-muted")} />
                            </NavigationLink>
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
              </div>

              <Link href={homeHref} className="flex shrink-0 items-center gap-2.5 justify-self-center font-heading text-lg text-ink" aria-label={`${companyName} home`}>
                <LogoMark className="size-7" />
                <span>{companyName}</span>
              </Link>

              <div className="flex min-w-0 items-center gap-1 justify-self-end md:gap-3">
                <nav aria-label="More" className={cn("hidden items-center gap-7", compact ? "lg:flex" : "md:flex")}>
                  {right.map((l) => (
                    <NavItem key={l.href} link={l} active={active === l.href} selected={highlighted === l.href} onSelect={setDestination} register={register} />
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
      <div aria-hidden className="h-[var(--site-header-height)]" />
    </>
  );
}
