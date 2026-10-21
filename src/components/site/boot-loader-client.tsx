"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createIntroSound, type IntroSound } from "@/lib/intro-sound";
import { cn } from "@/lib/utils";
import { BOOT_STORAGE_KEY } from "./boot-constants";
import styles from "./boot-loader.module.css";

/** One screen on the intro's laptop. `screen`: a website capture, pinned to its top rather than centred. */
export type IntroFrame = { src: string; title: string; screen: boolean };

/*
 * Homepage intro. It opens on a gate ("turn up your volume", click to enter) while the page loads behind it; browsers
 * only allow sound after a gesture, so the click is what starts the score (lib/intro-sound.ts). The frames (the
 * "Tailored services" sample sites) then step through the laptop screen on the beat (124 BPM eighth notes), never ahead
 * of the real load signals (DOM parsed, fonts ready, the intro's images decoded, window load), so sound and picture stay
 * together even on a slow connection. The last frame is the hero's photo: at 100% the screen zooms to full bleed and the
 * overlay dissolves into the hero (boot-loader.module.css). Whether it shows at all is decided before paint by the
 * script in boot-loader.tsx.
 */
type Phase = "gate" | "playing" | "exit" | "gone";

const WEIGHTS = { dom: 15, fonts: 25, images: 30, load: 30 } as const;
const STEP_MS = 242; // an eighth note at 124 BPM
const MIN_BEATS = 8; // few frames hold for several beats each, so the sequence never feels rushed
const SOFT_CAP = 94; // stay under 100 until every signal is in
const GIVE_UP_MS = 6_000; // a stuck signal must not hold the intro open
const HOLD_MS = 120;
const DISSOLVE_AT_MS = 950; // when the overlay starts to fade (its transition-delay in boot-loader.module.css)
const EXIT_MS = 1_700; // the dissolve's delay plus its duration

const label = (p: number) => `[ ${String(Math.floor(p)).padStart(2, "0")} Percent ]`;
const caption = (frames: IntroFrame[], i: number) =>
  `${String(i + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}${frames[i]?.title ? ` · ${frames[i].title}` : ""}`;

/** Film position (0-1) for progress (0-100): each frame moves on at the start of its step, on the beat, then holds. */
const film = (p: number, frames: number) => {
  if (frames < 2) return 0;
  const x = (p / 100) * (frames - 1);
  const i = Math.floor(x);
  const t = Math.min(1, (x - i) / 0.4);
  return Math.min(1, (i + t * t * (3 - 2 * t)) / (frames - 1));
};

export function BootLoaderClient({ name, frames }: { name: string; frames: IntroFrame[] }) {
  const root = useRef<HTMLDivElement>(null);
  const device = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const ambient = useRef<HTMLDivElement>(null);
  const percent = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const start = useRef<(withSound: boolean) => void>(() => {});
  const [phase, setPhase] = useState<Phase>("gate");

  useEffect(() => {
    const html = document.documentElement;
    // Skipped before paint (hidden by CSS), or hydration came too late and the failsafe is fading it out.
    if (html.dataset.booted || html.dataset.intro === "timeout") return;
    html.dataset.intro = "gate"; // took over from the pre-paint failsafe
    enterButton.current?.focus({ preventScroll: true });

    const n = frames.length;
    const steps = Math.max(n - 1, 1);
    const beatsPerFrame = Math.max(1, Math.round(MIN_BEATS / steps));
    const signals = { dom: document.readyState !== "loading", fonts: !document.fonts, images: false, load: document.readyState === "complete" };
    const earned = () => (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((sum, k) => sum + (signals[k] ? WEIGHTS[k] : 0), 0);
    const timers: number[] = [];
    let raf = 0;
    let cancelled = false;
    let started = false;
    let sound: IntroSound | null = null;

    const mark = (key: keyof typeof signals) => () => { signals[key] = true; };
    const onDom = mark("dom");
    const onLoad = mark("load");
    document.addEventListener("DOMContentLoaded", onDom);
    window.addEventListener("load", onLoad);
    document.fonts?.ready.then(mark("fonts"), mark("fonts"));
    const imgs = Array.from(screen.current?.querySelectorAll("img") ?? []);
    Promise.all(imgs.map((img) => img.decode().catch(() => {}))).then(mark("images"));
    timers.push(window.setTimeout(() => { signals.dom = signals.fonts = signals.images = signals.load = true; }, GIVE_UP_MS));

    // The frame on screen: lights its glow in the backdrop and names it in the caption. DOM only, no re-render.
    const show = (i: number) => {
      ambient.current?.querySelectorAll<HTMLElement>("[data-frame]").forEach((el, k) => { el.dataset.active = String(k === i); });
      if (captionRef.current) captionRef.current.textContent = caption(frames, i);
    };

    const finish = () => {
      try {
        sessionStorage.setItem(BOOT_STORAGE_KEY, "1");
      } catch {
        /* private mode: the intro simply plays again next visit */
      }
      timers.push(window.setTimeout(() => {
        if (cancelled) return;
        // Move the screen's centre to the viewport's centre and scale it until it covers the viewport.
        const d = device.current;
        const s = screen.current?.getBoundingClientRect();
        if (d && s?.width) {
          const box = d.getBoundingClientRect();
          const scale = 1.04 * Math.max(innerWidth / s.width, innerHeight / s.height);
          const cx = s.left + s.width / 2;
          const cy = s.top + s.height / 2;
          d.style.transformOrigin = `${cx - box.left}px ${cy - box.top}px`;
          d.style.setProperty("--zoom", `translate(${innerWidth / 2 - cx}px, ${innerHeight / 2 - cy}px) scale(${scale})`);
        }
        sound?.drop();
        html.dataset.intro = "exit"; // unlocks scrolling; the hero headline still waits for the dissolve
        setPhase("exit");
      }, HOLD_MS));
      timers.push(window.setTimeout(() => {
        if (!cancelled) html.dataset.intro = "reveal"; // the hero headline rises as the overlay dissolves
      }, HOLD_MS + DISSOLVE_AT_MS));
      timers.push(window.setTimeout(() => {
        if (cancelled) return;
        delete html.dataset.intro;
        html.dataset.booted = "1"; // client navigation back to "/" keeps it hidden
        setPhase("gone");
      }, HOLD_MS + EXIT_MS));
    };

    start.current = (withSound) => {
      if (started) return;
      started = true;
      if (withSound) sound = createIntroSound(); // must happen inside the click
      html.dataset.intro = "playing";
      setPhase("playing");
      const t0 = performance.now();
      const beats = steps * beatsPerFrame;
      let beat = -1;
      const tick = (now: number) => {
        const e = earned();
        const p = Math.min(((now - t0) / (STEP_MS * beats)) * 100, e >= 100 ? 100 : Math.min(SOFT_CAP, e));
        // Per frame, without re-rendering the images.
        if (percent.current) percent.current.textContent = label(p);
        root.current?.style.setProperty("--p", String(film(p, n)));
        const b = Math.floor((p / 100) * beats);
        if (b > beat && p < 100) {
          beat = b;
          sound?.step(b, p / 100);
          if (b % beatsPerFrame === 0) show(Math.min(n - 1, b / beatsPerFrame + 1)); // the frame now moving in
        }
        if (p >= 100) return finish();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    return () => {
      cancelled = true;
      start.current = () => {};
      document.removeEventListener("DOMContentLoaded", onDom);
      window.removeEventListener("load", onLoad);
      cancelAnimationFrame(raf);
      timers.forEach(window.clearTimeout);
      sound?.close();
      if (html.dataset.intro) delete html.dataset.intro; // never leave the page locked or the hero headline held
    };
  }, [frames]);

  if (phase === "gone") return null;
  const gate = phase === "gate";
  return (
    <div
      ref={root} data-boot-loader="" data-boot-phase={phase} className={styles.wrapper}
      role={gate ? "dialog" : undefined} aria-modal={gate || undefined} aria-label={gate ? `Welcome to ${name}` : undefined}
      aria-hidden={gate ? undefined : true}
      style={{ "--n": frames.length } as CSSProperties}
    >
      <div className={styles.bg}>
        {/* The frame on screen, blurred into a glow around the laptop. */}
        <div ref={ambient} className={styles.ambient}>
          {frames.map((f, i) => (
            <div key={f.src} data-frame="" data-active={String(i === 0)}>
              <Image src={f.src} alt="" fill sizes="64px" loading="eager" fetchPriority="low" className={cn("object-cover", f.screen && "object-top")} />
            </div>
          ))}
        </div>
        <div className={styles.grid} />
        <div className={styles.grain} />
      </div>

      <div className={styles.layout}>
        <span className={styles.label}><span>[ {name} ]</span></span>
        <div ref={device} className={styles.device}>
          <div className={styles.lid}>
            <div ref={screen} className={styles.screen}>
              <div className={styles.column}>
                {frames.map((f) => (
                  <div key={f.src} className={styles.frame}>
                    <Image
                      src={f.src} alt="" fill sizes="(max-width: 640px) 80vw, 560px" loading="eager" fetchPriority="low"
                      className={cn("object-cover", f.screen && "object-top")}
                    />
                  </div>
                ))}
              </div>
              <div className={styles.loadbar}><span /></div>
            </div>
          </div>
          <div className={styles.base} />
          <p ref={captionRef} className={cn(styles.caption, "tabular-nums")}>{caption(frames, 0)}</p>
        </div>
        <span className={styles.label}>
          {gate ? <span>[ ♪ Turn up your volume ]</span> : <span ref={percent} className="tabular-nums">{label(0)}</span>}
        </span>
        <div className={styles.gate}>
          <button ref={enterButton} type="button" className={styles.enter} onClick={() => start.current(true)} aria-label="Enter with sound">
            [ <span className={styles.pointer}>Click</span><span className={styles.touch}>Tap</span> to enter ]
          </button>
          <button type="button" className={styles.silent} onClick={() => start.current(false)}>Enter without sound</button>
        </div>
      </div>
    </div>
  );
}
