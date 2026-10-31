"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SearchEntry } from "@/lib/search";
import { NavigationLink } from "./navigation-link";
import { ThemeManager } from "./theme-manager";
import { SearchPalette } from "./search-palette";

export interface NavLink { href: string; label: string }

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


export function NotchHeader({ companyName, links, menuCta, homeHref = "/", search = [] }: {
  companyName: string; links: NavLink[]; menuCta?: React.ReactNode; homeHref?: string; compactOnScroll?: boolean; search?: SearchEntry[];
}) {
  const active = useActiveNavigation(links);
  const [menu, setMenu] = React.useState(false);
  const meetingSelected = React.useRef(false);
  const destination = React.useRef<string | null>(null);
  return <>
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 max-w-page items-center gap-4 px-5 sm:px-10 lg:px-16">
        <Link href={homeHref} className="flex shrink-0 items-center gap-2.5 font-heading text-lg font-bold tracking-tight text-ink" aria-label={`${companyName} home`}><LogoMark className="size-7" />{companyName}</Link>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-6 lg:flex">{links.map(link => <NavigationLink key={link.href} href={link.href} aria-current={active === link.href ? (link.href.startsWith("#") ? "location" : "page") : undefined} className="min-h-11 inline-flex items-center text-sm font-medium text-muted hover:text-ink aria-[current]:text-ink aria-[current]:underline aria-[current]:decoration-accent-700 aria-[current]:underline-offset-8">{link.label}</NavigationLink>)}</nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-3">
          {search.length ? <SearchPalette entries={search} /> : null}
          <ThemeManager />
          {menuCta ? <div className="hidden lg:block">{menuCta}</div> : null}
          <Sheet open={menu} onOpenChange={setMenu}>
            <SheetTrigger asChild><button type="button" aria-label="Open menu" className="grid size-11 place-items-center rounded-lg text-ink hover:bg-neutral-200 lg:hidden"><Menu aria-hidden className="size-5" /></button></SheetTrigger>
            <SheetContent side="right" className="w-[min(90vw,380px)] gap-0 bg-bg p-0" onCloseAutoFocus={event => {
              if (meetingSelected.current) {
                event.preventDefault(); meetingSelected.current = false;
                requestAnimationFrame(() => { document.getElementById("veloce-meeting-panel")?.scrollIntoView({ block: "center" }); document.getElementById("veloce-meeting-title")?.focus({ preventScroll: true }); });
              } else if (destination.current) {
                event.preventDefault(); const id = destination.current; destination.current = null;
                requestAnimationFrame(() => { const target = document.getElementById(id); if (!target) return; target.tabIndex = -1; target.scrollIntoView({ block: "start", behavior: "instant" }); target.focus({ preventScroll: true }); });
              }
            }}>
              <SheetHeader className="border-b border-line p-5"><SheetTitle>{companyName}</SheetTitle><SheetDescription>Navigation and contact</SheetDescription></SheetHeader>
              <nav aria-label="Mobile" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">{links.map(link => <SheetClose asChild key={link.href}><NavigationLink href={link.href} onClick={() => { destination.current = link.href.startsWith("#") ? link.href.slice(1) : null; }} aria-current={active === link.href ? "page" : undefined} className="flex min-h-12 items-center rounded-lg px-3 font-medium text-ink hover:bg-neutral-200">{link.label}</NavigationLink></SheetClose>)}</nav>
              {menuCta ? <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={event => { meetingSelected.current = event.target instanceof Element && !!event.target.closest("[data-meeting-trigger]"); setMenu(false); }}>{menuCta}</div> : null}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  </>;
}
