"use client";

import * as React from "react";
import { AnimatePresence, m } from "framer-motion";
import { useOnScreen } from "@/lib/use-on-screen";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Calendar, Check, CreditCard, LayoutDashboard, Plug, Workflow, type LucideIcon } from "lucide-react";
import { OpenInquiryButton } from "@/components/forms/inquiry";
import { cn } from "@/lib/utils";

/*
 * Bento grid adapted from VengeanceUI "research-bento-grid" (layout, grain, tile field, animated cursors).
 * Content is ours: the original shows prices, a subscription "pause" control and third-party brand logos,
 * none of which this business can claim, so those panels now show capability tiles, a scope card and a CTA.
 * Changes: themed with site tokens (no dark mode), 15px+ copy, autoplay stops on interaction or hover/focus,
 * decorative motion is aria-hidden and disabled under prefers-reduced-motion.
 */

const spring = { type: "spring", stiffness: 230, damping: 24 } as const;
const LIFTED = new Set([5, 14, 23, 34, 41, 53, 62, 71, 79, 88, 97, 108, 119, 131, 146, 157, 169, 184, 199, 213, 226, 241]);
const BRIGHT = new Set([17, 45, 76, 103, 138, 176, 205, 234]);

const TILES: { name: string; icon: LucideIcon; detail: string }[] = [
  { name: "Online booking", icon: Calendar, detail: "Scheduling built around your availability rules." },
  { name: "Payments", icon: CreditCard, detail: "Accept payments through the providers you choose." },
  { name: "Integrations", icon: Plug, detail: "Connect the tools and services you already use." },
  { name: "Dashboards", icon: LayoutDashboard, detail: "One place for your team to see what matters." },
  { name: "Automation", icon: Workflow, detail: "Hand repetitive steps to the system." },
];

/** False while a panel is off-screen or the tab is hidden: looping animations and timers inside it should idle. */
const PanelActive = React.createContext(true);

/** For a panel's owner: `still` is true when motion should not run (reduced motion, or the panel is not being looked at). */
function usePanelMotion() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const active = useOnScreen(ref);
  return { ref, active, still: reduce || !active };
}

/** For motion inside a panel (the panel provides whether it is on screen). */
function useStill() {
  const reduce = useReducedMotion();
  const active = React.useContext(PanelActive);
  return reduce || !active;
}

function Panel({ className, children, sectionRef, active }: { className?: string; children: React.ReactNode; sectionRef: React.Ref<HTMLElement>; active: boolean }) {
  const grainId = React.useId().replace(/:/g, "");
  return (
    <PanelActive.Provider value={active}>
    <section
      ref={sectionRef}
      className={cn(
        "relative isolate overflow-hidden rounded-xl border border-line bg-neutral-100",
        "shadow-[inset_0_1px_rgba(255,255,255,0.1),0_12px_32px_rgba(0,0,0,0.08)]",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_45%)]" />
      {children}
      <svg aria-hidden className="grain pointer-events-none absolute inset-0 z-50 size-full opacity-[0.07] mix-blend-soft-light">
        <filter id={grainId} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" seed="11" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.55" />
          </feComponentTransfer>
        </filter>
        <rect width="100%" height="100%" filter={`url(#${grainId})`} />
      </svg>
    </section>
    </PanelActive.Provider>
  );
}

function FeatureCopy({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("absolute inset-x-0 bottom-0 z-20 px-6 pb-6 sm:px-8 sm:pb-8", className)}>
      <h3 className="text-[20px] leading-tight sm:text-[24px]">{title}</h3>
      <p className="mt-2.5 max-w-[44ch] text-[15px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function ArrowCursor({ className, label, inverted, delay = 0, left }: { className?: string; label: string; inverted?: boolean; delay?: number; left?: string }) {
  const reduce = useStill();
  return (
    <m.div
      aria-hidden
      className={cn("absolute z-30 flex flex-col items-start", className)}
      animate={reduce ? undefined : left ? { left, y: [0, -3, 0], rotate: [0, 1.5, 0] } : { y: [0, -3, 0], rotate: [0, 1.5, 0] }}
      transition={
        left
          ? { left: spring, y: { duration: 4.6, delay, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 4.6, delay, repeat: Infinity, ease: "easeInOut" } }
          : { duration: 4.6, delay, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <svg width="26" height="30" viewBox="0 0 26 30" fill="none" className="h-auto w-[18px] drop-shadow-md sm:w-[24px]">
        <path d="M2.2 2.5 22 15.1l-9.4 2.1-4.1 9.1L2.2 2.5Z" className={cn("stroke-white", inverted ? "fill-ink" : "fill-accent")} strokeWidth="2.1" strokeLinejoin="round" />
      </svg>
      <span className={cn("ml-3 -mt-1 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold shadow-md sm:text-[14px]", inverted ? "bg-bg text-ink" : "bg-accent-600 text-on-accent")}>{label}</span>
    </m.div>
  );
}

function TilesPanel() {
  const pm = usePanelMotion();
  const reduce = pm.still;
  const [selected, setSelected] = React.useState(0);
  const [stopped, setStopped] = React.useState(false); // user took over, or is hovering/focused
  const [held, setHeld] = React.useState(false);

  React.useEffect(() => {
    if (reduce || stopped || held) return;
    const id = setInterval(() => setSelected((s) => (s + 1) % TILES.length), 2600);
    return () => clearInterval(id);
  }, [reduce, stopped, held]);

  // Cursor position is relative to the tile row, so it always sits on the selected tile.
  const stops = TILES.map((_, i) => `${((i + 0.5) / TILES.length) * 100}%`);

  return (
    <Panel sectionRef={pm.ref} active={pm.active} className="min-h-[360px] lg:col-span-12 lg:min-h-[320px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 grid h-[78%] grid-cols-[repeat(28,minmax(0,1fr))] grid-rows-[repeat(9,minmax(0,1fr))] gap-px overflow-hidden"
        style={{ maskImage: "linear-gradient(to bottom,black 0%,black 62%,transparent 100%)" }}
      >
        {Array.from({ length: 252 }, (_, i) => (
          <span key={i} className={cn("border border-ink/[0.035] bg-neutral-200", LIFTED.has(i) && "bg-neutral-300/70", BRIGHT.has(i) && "bg-neutral-300")} />
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[76%] bg-[radial-gradient(ellipse_at_50%_18%,transparent_12%,rgba(43,43,43,.12)_58%,var(--color-neutral-100)_100%)]" />

      <div
        role="group"
        aria-label="Examples of what a site can include"
        className="absolute inset-x-4 top-[9%] z-10 mx-auto flex max-w-[760px] items-center gap-2 sm:inset-x-8 sm:top-[12%] sm:gap-3 lg:inset-x-12"
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
      >
        {TILES.map((t, i) => {
          const on = selected === i;
          return (
            <m.button
              key={t.name}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setSelected(i);
                setStopped(true);
              }}
              className={cn(
                "relative flex aspect-square min-w-0 flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[10px] border bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300 shadow-[inset_0_1px_rgba(255,255,255,.1),0_12px_24px_rgba(0,0,0,.12)]",
                on ? "border-accent/60 text-accent-700" : "border-ink/10 text-ink",
              )}
              animate={reduce ? undefined : { y: on ? -3 : 0, scale: on ? 1.02 : 1 }}
              whileHover={reduce ? undefined : { y: -4, scale: 1.02 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={spring}
            >
              {on && !reduce ? (
                <m.span
                  aria-hidden
                  className="absolute inset-[12%] rounded-full bg-accent/20 blur-xl"
                  animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.9, 1.08, 0.9] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : null}
              <t.icon aria-hidden className="relative size-[34%]" strokeWidth={2.25} />
              <span className="relative hidden px-1 text-center text-[11px] font-semibold leading-tight sm:block lg:text-[13px]">{t.name}</span>
              <span className="sr-only sm:hidden">{t.name}</span>
            </m.button>
          );
        })}
      </div>

      {/* Cursors share the tile row's box (same insets) so percentages map to tiles. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-4 top-[9%] z-30 mx-auto max-w-[760px] sm:inset-x-8 sm:top-[12%] lg:inset-x-12">
        <div className="relative aspect-[5/1] w-full">
          <ArrowCursor label="You" className="top-[66%] ml-[5%]" left={stops[selected]} delay={0.2} />
          <ArrowCursor label="Your team" inverted className="left-[46%] top-[118%]" delay={0.9} />
        </div>
      </div>

      <FeatureCopy className="sm:right-[42%]" title="One team for the whole build">
        From design to launch, the pieces are planned together, so they fit your business and each other.
      </FeatureCopy>
      <div className="absolute bottom-6 right-6 z-20 hidden w-[36%] max-w-[300px] rounded-[10px] border border-ink/10 bg-bg/85 p-4 shadow-md backdrop-blur-sm sm:bottom-8 sm:right-8 sm:block">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent-700">{TILES[selected]?.name}</p>
        <p className="mt-1.5 text-[14.5px] leading-snug text-muted">{TILES[selected]?.detail}</p>
      </div>
    </Panel>
  );
}

const SCOPE_ITEMS = ["The problem to solve", "What to build first", "What can wait", "Timeline estimate", "Next steps"];

function ScopePanel() {
  const pm = usePanelMotion();
  const reduce = pm.still;
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setI((v) => (v + 1) % 2), 3900);
    return () => clearInterval(id);
  }, [reduce]);
  const idea = i === 0;

  return (
    <Panel sectionRef={pm.ref} active={pm.active} className="min-h-[420px] lg:col-span-7 lg:min-h-[340px]">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.055]" style={{ backgroundImage: "radial-gradient(circle,currentColor .65px,transparent .75px)", backgroundSize: "11px 11px" }} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[58%] overflow-hidden sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[53%]">
        <AnimatePresence initial={false} mode="wait">
          <m.div
            key={i}
            className="absolute left-[14%] top-5 h-[290px] w-[72%] overflow-hidden rounded-[10px] border border-ink/15 bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300 p-5 shadow-[inset_0_1px_rgba(255,255,255,.1),0_18px_42px_rgba(0,0,0,.14)] sm:left-auto sm:right-7 sm:w-[86%]"
            initial={reduce ? false : { y: 270, opacity: 0, rotate: -1.25 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { y: 285, opacity: 0, rotate: 1.1 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{idea ? "Your idea" : "Proposed scope"}</p>
            {idea ? (
              <>
                <p className="mt-3 font-heading text-[22px] leading-tight">Online booking for our clinic</p>
                <div className="mt-5 space-y-2.5">
                  {[64, 44, 70, 36].map((w, k) => (
                    <span key={k} className="block h-2.5 rounded-[3px] bg-ink/[0.07]" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </>
            ) : (
              <ul className="mt-4 space-y-3">
                {SCOPE_ITEMS.map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-[15px] font-medium">
                    <span className="grid size-5 place-items-center rounded-full bg-accent-600 text-on-accent">
                      <Check className="size-3" strokeWidth={3.5} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-b from-transparent to-neutral-300" />
          </m.div>
        </AnimatePresence>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[48%] bg-gradient-to-b from-transparent via-neutral-100/60 to-neutral-100" />
      <ol aria-hidden className="absolute left-6 top-6 z-20 hidden items-center gap-2 sm:left-8 sm:top-8 sm:flex">
        {["Idea", "Scope", "Build"].map((t, k) => (
          <li key={t} className="flex items-center gap-2 text-[12.5px] font-semibold">
            <span className={cn("rounded-full px-3 py-1 transition-colors", (idea ? 0 : 1) === k ? "bg-accent-600 text-on-accent" : "bg-neutral-200 text-muted")}>{t}</span>
            {k < 2 ? <span className="h-px w-3 bg-line" /> : null}
          </li>
        ))}
      </ol>
      <FeatureCopy className="sm:right-1/2 sm:pr-3" title="Clear scope, discussed openly">
        We agree what is and isn&apos;t included, then talk through timing and cost with you before anything is built.
      </FeatureCopy>
    </Panel>
  );
}

function ConversationPanel() {
  const pm = usePanelMotion();
  const reduce = pm.still;
  return (
    <Panel sectionRef={pm.ref} active={pm.active} className="min-h-[360px] lg:col-span-5 lg:min-h-[340px]">
      <div aria-hidden className="grain pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-soft-light" style={{ backgroundImage: "radial-gradient(circle at 20% 30%,currentColor 0 .45px,transparent .7px),radial-gradient(circle at 70% 65%,currentColor 0 .45px,transparent .75px)", backgroundSize: "4px 4px,5px 5px" }} />
      <div className="absolute inset-x-0 top-0 flex h-[62%] items-center justify-center">
        {Array.from({ length: 10 }, (_, ring) => (
          <m.div
            key={ring}
            aria-hidden
            className="absolute border border-ink/[0.07]"
            style={{ width: 170 + ring * 23, height: 90 + ring * 16, borderRadius: 23 + ring * 3, opacity: Math.max(0.18, 0.72 - ring * 0.05) }}
            animate={reduce ? undefined : { scale: [0.995, 1.008, 0.995] }}
            transition={{ duration: 5.2, delay: ring * 0.11, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <OpenInquiryButton size="lg" className="relative z-10 h-16 min-w-44 text-lg shadow-lg">
          Let&apos;s talk
        </OpenInquiryButton>
        <ArrowCursor label="You" className="left-[56%] top-[66%]" delay={0.5} />
      </div>
      <FeatureCopy title="Start with a conversation">Tell us what you want to build or fix. You&apos;re free to say no after we&apos;ve talked.</FeatureCopy>
    </Panel>
  );
}

export function CapabilityBento() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <TilesPanel />
      <ScopePanel />
      <ConversationPanel />
    </div>
  );
}
