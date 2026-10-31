"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Laptop, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { portfolioImageUrl } from "@/lib/security/portfolio-images";
import { FlatScreen } from "./flat-screen";
import { PHONE_SIZE, drawPhone, glowFor } from "./screen";
import { DEPLOY_STEPS, SNIPPETS, TIMING, VERB, createShowStore, useShow, type Bus, type ShowcaseItem } from "./store";

export type { ShowcaseItem } from "./store";

// three.js and the scene load only on the client, after the page is up; the poster stands in until then.
const LaptopScene = dynamic(() => import("./scene"), { ssr: false });

/**
 * Whether to load the 3D laptop: WebGL must be there, and automated browsers (whose WebGL is software-rendered, a few
 * frames a second) get the flat laptop unless localStorage "veloce-3d" is "on".
 */
const wants3D = () => {
  try {
    if (navigator.webdriver && localStorage.getItem("veloce-3d") !== "on") return false;
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
};

/**
 * The hero visual: a 3D laptop that opens, types a page in an editor (its keys pressing in time), deploys it, then
 * shows the finished sample, for a website, an online store and a business system in turn. Visitors can pick a build,
 * pause, close or open the lid, move over the trackpad to drive the on-screen cursor (a click opens the sample), and
 * type while hovering to press the keys. Reduced motion shows the finished site, still. Without WebGL a flat laptop
 * plays the same build on a 2D canvas; without JavaScript it shows the finished sample. The status line and links
 * below carry everything for assistive tech.
 */
/**
 * Light from the screens on a box larger than the stage: a bright core behind the laptop's display, a wide halo, and a
 * smaller pool behind the phone. Every gradient reaches transparent inside the box, so the light has no edge.
 */
const screenGlow = (colour: string) => {
  const c = (amount: number) => `color-mix(in srgb, ${colour} ${amount}%, transparent)`;
  return [
    `radial-gradient(closest-side at 57% 40%, ${c(95)}, ${c(55)} 45%, transparent)`,
    `radial-gradient(closest-side at 30% 60%, ${c(70)}, transparent)`,
    `radial-gradient(ellipse 48% 44% at 52% 46%, ${c(60)}, ${c(22)} 60%, transparent)`,
  ].join(", ");
};

const EDGE_FADE = "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent), linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent)";

export function LaptopShowcase({ items }: { items: ShowcaseItem[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const [store] = useState(() => createShowStore({ active: 0, phase: "site", typed: 0, deployed: 0, paused: false, lid: true, cursor: null, holding: false }));
  const s = useShow(store);
  const [mode, setMode] = useState<"pending" | "flat" | "3d">("pending");
  // The light each sample's screen casts, sampled from its screenshot once it loads.
  const [glow, setGlow] = useState<Record<number, string>>({});
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [live, setLive] = useState(false);
  // Announce the status only after the visitor changed the build, not on every autoplay step.
  const [announce, setAnnounce] = useState(false);
  const hovering = useRef(false);
  const busRef = useRef<Bus>({ press: null, open: null, pointer: { x: 0, y: 0 }, invalidate: null });
  // When the current snippet started typing; typing follows the clock so slow frames never stall the build.
  const typingFrom = useRef(0);
  const item = items[s.active] ?? items[0];

  useEffect(() => {
    const bus = busRef.current;
    bus.open = () => { const current = items[store.get().active]; if (current) router.push(current.sample.href); };
    return () => { bus.open = null; };
  }, [store, items, router]);

  useEffect(() => {
    let alive = true;
    items.forEach((it, index) => glowFor(it).then((colour) => { if (alive) setGlow((g) => ({ ...g, [index]: colour })); }));
    return () => { alive = false; };
  }, [items]);

  // Shortly after the page is up: load the 3D scene if it suits this browser, otherwise play on the flat laptop. The 3D
  // laptop arrives shut and blank, so its first frame is already the start of the intro.
  useEffect(() => {
    if (mode !== "pending") return;
    const id = setTimeout(() => {
      const three = wants3D();
      if (three && !reduce) store.set({ lid: false, phase: "code", typed: 0, deployed: 0 });
      setMode(three ? "3d" : "flat");
    }, 200);
    return () => clearTimeout(id);
  }, [mode, reduce, store]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The flat laptop starts building straight away.
  useEffect(() => {
    if (mode !== "flat" || reduce) return;
    const start = setTimeout(() => { store.set({ phase: "code", typed: 0, deployed: 0 }); setLive(true); }, 600);
    return () => clearTimeout(start);
  }, [mode, reduce, store]);

  // The intro, in one direction: the shut laptop fades and rises in, the lid swings open, then typing starts.
  useEffect(() => {
    if (!ready || reduce) return;
    const open = setTimeout(() => store.set({ lid: true }), 700);
    const start = setTimeout(() => setLive(true), 2100);
    return () => { clearTimeout(open); clearTimeout(start); };
  }, [ready, reduce, store]);

  // Reduced motion: the finished site, lid open, nothing moving.
  useEffect(() => {
    if (reduce) store.set({ phase: "site", lid: true });
  }, [reduce, store]);

  const running = live && !reduce && !s.paused && s.lid && visible;
  useEffect(() => {
    if (!running || !item) return;
    if (s.phase === "code") {
      const code = SNIPPETS[item.kind];
      typingFrom.current = performance.now() - store.get().typed * TIMING.char;
      const id = setInterval(() => {
        const { typed } = store.get();
        if (typed >= code.length) { clearInterval(id); store.set({ phase: "deploy", deployed: 0 }); return; }
        const next = Math.min(code.length, Math.floor((performance.now() - typingFrom.current) / TIMING.char));
        if (next <= typed) return;
        busRef.current.press?.(code[next - 1]!);
        store.set({ typed: next });
      }, TIMING.char);
      return () => clearInterval(id);
    }
    if (s.phase === "deploy") {
      const id = setTimeout(() => store.set(s.deployed + 1 >= DEPLOY_STEPS ? { phase: "site" } : { deployed: s.deployed + 1 }), TIMING.deployStep);
      return () => clearTimeout(id);
    }
    if (s.phase === "site") {
      if (s.holding) return;
      const id = setTimeout(() => store.set({ phase: "clear" }), TIMING.site);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => { setAnnounce(false); store.set((st) => ({ phase: "code", typed: 0, deployed: 0, active: (st.active + 1) % items.length })); }, TIMING.clear);
    return () => clearTimeout(id);
  }, [running, s.phase, s.deployed, s.holding, s.active, item, items.length, store]);

  // Typing while the pointer is over the laptop presses its keys.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!hovering.current || event.metaKey || event.ctrlKey || (event.target as HTMLElement).closest?.("input, textarea, select, [contenteditable=true]")) return;
      busRef.current.press?.(event.key);
      if (event.key === " ") event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  if (!item) return null;

  // Picking a build always builds it (and opens the lid), unless the loop is paused or motion is reduced.
  function choose(index: number) {
    setAnnounce(true);
    const still = reduce || s.paused;
    store.set({ active: index, typed: 0, deployed: 0, phase: still ? "site" : "code", ...(still ? {} : { lid: true }) });
    if (!still && mode === "flat") setLive(true);
  }

  function point(event: PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType !== "mouse") return;
    const r = event.currentTarget.getBoundingClientRect();
    busRef.current.pointer = { x: (event.clientX - r.left) / r.width - 0.5, y: (event.clientY - r.top) / r.height - 0.5 };
    busRef.current.invalidate?.();
  }

  const status = s.phase === "code" ? `Coding ${VERB[item.kind]}…` : s.phase === "deploy" ? "Deploying…" : `Sample build: ${item.sample.title}`;

  return (
    <div data-laptop-showcase className="flex min-w-0 flex-col gap-5">
      <div
        ref={stage}
        className="relative aspect-[4/3] lg:aspect-[6/5]"
        onPointerEnter={() => { hovering.current = true; store.set({ holding: true }); }}
        onPointerMove={point}
        onPointerLeave={() => { hovering.current = false; busRef.current.pointer = { x: 0, y: 0 }; busRef.current.invalidate?.(); store.set({ holding: false, cursor: null }); }}
      >
        {/* Light from the screens, behind everything on the page (no box, so no edge): editor blue while coding and
            deploying, then the colour of the sample on screen, dimmed while the lid is shut. Two layers cross-fade
            because gradients do not animate. */}
        <div data-laptop-glow aria-hidden className="pointer-events-none absolute -inset-[18%] -z-10 transition-opacity duration-[1600ms]" style={{ opacity: mode === "flat" || ready ? (s.lid ? 1 : 0.15) : 0 }}>
          <div className="absolute inset-0 animate-[screen-glow_6s_ease-in-out_infinite]">
            <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: s.phase === "site" ? 0 : 1, background: screenGlow("rgb(96 140 255)") }} />
            <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: s.phase === "site" ? 1 : 0, background: screenGlow(glow[s.active] ?? "var(--color-accent)") }} />
          </div>
        </div>
        {/* Flat laptop and phone: the finished sample without JavaScript, and the build itself where the 3D scene does
            not load. Hidden while the page decides, so a 3D-capable browser never sees it swap out. */}
        <div data-laptop-poster className="pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-700" style={{ opacity: mode === "flat" ? 1 : 0 }} aria-hidden>
          <div className="relative w-[70%] translate-x-[6%]">
            <div className="rounded-[14px] bg-[#111214] p-[2.4%] shadow-xl">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[4px]">
                <Image src={portfolioImageUrl(item.sample.thumbnail)} alt="" fill sizes="(min-width: 1024px) 400px, 70vw" className="object-cover object-top" />
                {mode === "flat" ? <FlatScreen store={store} items={items} /> : null}
              </div>
            </div>
            <div className="mx-[-7%] h-3.5 rounded-b-2xl bg-gradient-to-b from-[#dfe2e5] to-[#a9aeb3]" />
            <div className="absolute -bottom-[6%] -left-[16%] w-[24%] rounded-[18%/8.5%] bg-[#111214] p-[1.6%] shadow-xl ring-2 ring-[#c9ccd1]">
              <div className="relative aspect-[540/1169] overflow-hidden rounded-[15%/7%]">
                <Image src={portfolioImageUrl(item.sample.phone ?? item.sample.thumbnail)} alt="" fill sizes="120px" className="object-cover object-top" />
                {mode === "flat" ? <FlatScreen store={store} items={items} size={PHONE_SIZE} paint={drawPhone} /> : null}
              </div>
            </div>
          </div>
        </div>
        {mode === "3d" ? (
          // The edges fade out, so the soft shadows never end in a line where the canvas stops.
          <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: ready ? 1 : 0, maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" }}>
            <LaptopScene store={store} busRef={busRef} items={items} active={visible} rise={!reduce} onReady={() => setReady(true)} />
          </div>
        ) : null}
      </div>

      <div data-showcase-controls className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5 sm:gap-2" role="group" aria-label="Choose what to build">
          {items.map((it, index) => (
            <button key={it.kind} type="button" aria-label={it.label} aria-pressed={s.active === index} onClick={() => choose(index)}
              className="min-h-11 rounded-full border border-line bg-neutral-100 px-3 text-[14px] font-medium text-ink transition-colors duration-150 hover:border-ink/35 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700 sm:px-4 sm:text-[15px]">
              <span className="sm:hidden">{it.short}</span><span className="hidden sm:inline">{it.label}</span>
            </button>
          ))}
        </div>
        {mode !== "pending" && !reduce ? (
          <div className="flex shrink-0 gap-1.5 sm:gap-2">
            {mode === "3d" ? <button type="button" aria-label={s.lid ? "Close the lid" : "Open the lid"} aria-pressed={!s.lid} onClick={() => store.set({ lid: !s.lid })}
              className="grid size-10 place-items-center rounded-full border border-line sm:size-11 bg-neutral-100 text-ink hover:border-ink/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700">
              <Laptop aria-hidden className="size-4" />
            </button> : null}
            <button type="button" aria-label={s.paused ? "Play the build loop" : "Pause the build loop"} onClick={() => store.set({ paused: !s.paused })}
              className="grid size-10 place-items-center rounded-full border border-line sm:size-11 bg-neutral-100 text-ink hover:border-ink/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700">
              {s.paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
            </button>
          </div>
        ) : null}
      </div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[15px] text-muted" aria-live={announce ? "polite" : "off"}>
        <span>{status}</span>
        <Link href={item.sample.href} aria-label={`View the ${item.sample.title} sample`} className="font-semibold text-accent-700 underline-offset-4 hover:underline">
          View sample <ArrowUpRight aria-hidden className="inline size-4" />
        </Link>
      </p>
      <noscript><style>{`[data-showcase-controls] { display: none !important; } [data-laptop-poster], [data-laptop-glow] { opacity: 1 !important; }`}</style></noscript>
    </div>
  );
}
