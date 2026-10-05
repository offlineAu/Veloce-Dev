"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveSection } from "./notch-header";

/*
 * Quick dock: a glass pill fixed to the bottom with inline shortcuts and a "More" button that expands upward into a
 * mega-menu. Behaviour from VengeanceUI "awwwards-nav" (MIT), rebuilt with framer-motion (no GSAP dependency).
 * Veloce changes:
 *  - appears only after the visitor scrolls past the hero, so it never competes with the header at the top
 *  - the shortcut for the section in view is highlighted (scroll-spy)
 *  - keyboard/screen-reader support: real <button>, aria-expanded/controls, Esc and outside click close it, focus
 *    returns to the button, the closed menu is not focusable
 *  - mobile and tablet only (hidden from the lg breakpoint up, where the header already shows every link)
 *  - no call-to-action button here: the conversation call to action lives in the header
 *  - reduced motion: no slide or height animation, the menu just toggles
 */
export interface DockLink {
  label: string;
  href: string;
}
export interface DockColumn {
  title: string;
  links: DockLink[];
}

export function QuickDock({
  shortcuts,
  columns,
  moreLabel = "More",
}: {
  shortcuts: DockLink[];
  columns: DockColumn[];
  moreLabel?: string;
}) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLElement>(null);
  const toggle = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();
  const active = useActiveSection([...shortcuts, ...columns.flatMap((c) => c.links)]);

  React.useEffect(() => {
    const on = () => setVisible(window.scrollY > 480);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const down = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", down);
    };
  }, [open]);

  const shown = visible || open;

  return (
    <motion.nav
      ref={root}
      aria-label="Quick links"
      initial={false}
      animate={reduce ? { opacity: shown ? 1 : 0 } : { opacity: shown ? 1 : 0, y: shown ? 0 : 24 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: shown ? "auto" : "none" }}
      // `inert` keeps the hidden dock out of the tab order until it is shown.
      {...(shown ? {} : { inert: true })}
      className="fixed bottom-4 left-1/2 z-30 lg:hidden w-[min(680px,92vw)] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-neutral-100/85 shadow-lg backdrop-blur-xl"
    >
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={menuId}
            key="menu"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-5 p-5">
              {columns.map((col) => (
                <div key={col.title} className="flex min-w-0 flex-col gap-0.5">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                    <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                    {col.title}
                  </p>
                  {col.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      aria-current={active === l.href ? "location" : undefined}
                      className={cn(
                        "block min-h-9 rounded-md py-1.5 text-[15px] leading-snug hover:text-accent-700",
                        active === l.href ? "text-accent-700" : "text-ink",
                      )}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              ))}
            </div>
            <div aria-hidden className="mx-4 border-t border-dashed border-line" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex items-stretch gap-1.5 p-2">
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center gap-2 sm:flex-none rounded-xl border border-line px-4 text-sm font-medium transition-colors hover:bg-ink/10",
            open ? "bg-ink/10 text-ink" : "bg-ink/5 text-muted",
          )}
        >
          {open ? <X aria-hidden className="size-4" /> : <Menu aria-hidden className="size-4" />}
          <span>{open ? "Close" : moreLabel}</span>
        </button>
        <div className="flex min-w-0 flex-1 gap-1.5">
          {shortcuts.map((s) => (
            <a
              key={s.href}
              href={s.href}
              aria-current={active === s.href ? "location" : undefined}
              className={cn(
                "hidden min-h-11 min-w-0 flex-1 items-center justify-center truncate rounded-xl border px-2 text-sm transition-colors sm:flex",
                active === s.href ? "border-accent/70 text-ink" : "border-line text-muted hover:border-ink/40 hover:text-ink",
              )}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </motion.nav>
  );
}
