"use client";

import { useEffect, useId, useState } from "react";
import { LOGO_POLYGONS } from "@/components/brand/logo";
import { LOGO_CELLS, MARK_HEIGHT, MARK_WIDTH } from "@/components/brand/pixel-logo-loader-geometry";
import { prefersReducedMotion, useReducedMotion } from "@/lib/use-reduced-motion";
import { BOOT_STORAGE_KEY } from "./boot-constants";

/*
 * First-visit loader. Progress is a weighted estimate of real load signals (DOM parsed, fonts ready, window load), not a byte count.
 * "Always play" / Adaptive build the logo tile by tile in step with the percentage, so the mark is whole exactly at 100%; the rate cap
 * also means the build always has time to finish. "Reduce animations" (or a device that asks for less motion) shows the finished
 * mark and a bar that steps with each signal: no easing, no fade, no minimum wait.
 */
type Phase = "loading" | "fading" | "gone";

const WEIGHTS = { dom: 25, fonts: 25, load: 50 } as const;
const MAX_RATE = 75; // percent per second: 0 to 100 takes at least ~1.3s, long enough to finish building
const MIN_RATE = 20; // percent per second: never stall once a target is ahead
const SOFT_CAP = 94; // stay under 100 until every signal is in
const GIVE_UP_MS = 10_000; // a stuck signal must not trap the visitor behind the overlay
const HOLD_MS = 250;
const FADE_MS = 350;
const LAST_STEP = 30;

export function BootLoaderClient() {
  const clipId = `boot-logo-${useId()}`;
  const [progress, setProgress] = useState(0);
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    if (document.documentElement.dataset.booted) return; // already seen this session: hidden by CSS, nothing to track
    const motionOff = prefersReducedMotion();
    const signals = { dom: document.readyState !== "loading", fonts: !document.fonts, load: document.readyState === "complete" };
    const earned = () => (signals.dom ? WEIGHTS.dom : 0) + (signals.fonts ? WEIGHTS.fonts : 0) + (signals.load ? WEIGHTS.load : 0);
    const timers: number[] = [];
    let raf = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      setProgress(100);
      try {
        sessionStorage.setItem(BOOT_STORAGE_KEY, "1");
      } catch {
        /* private mode: the loader simply shows again next visit */
      }
      if (motionOff) return setPhase("gone");
      timers.push(window.setTimeout(() => setPhase("fading"), HOLD_MS));
      timers.push(window.setTimeout(() => setPhase("gone"), HOLD_MS + FADE_MS));
    };

    // Reduced motion: the bar jumps when a signal arrives.
    const step = () => {
      const e = earned();
      setProgress(Math.min(e, SOFT_CAP));
      if (e >= 100) finish();
    };
    const mark = (key: keyof typeof signals) => () => {
      signals[key] = true;
      if (motionOff) step();
    };

    const onDom = mark("dom");
    const onLoad = mark("load");
    document.addEventListener("DOMContentLoaded", onDom);
    window.addEventListener("load", onLoad);
    document.fonts?.ready.then(mark("fonts"), mark("fonts"));
    timers.push(window.setTimeout(() => { signals.dom = signals.fonts = signals.load = true; if (motionOff) step(); }, GIVE_UP_MS));

    if (motionOff) {
      step();
    } else {
      const start = performance.now();
      let last = start;
      let p = 0;
      const tick = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const e = earned();
        const target = e >= 100 ? 100 : Math.min(SOFT_CAP, e + ((now - start) / 1000) * 4);
        const move = Math.min(MAX_RATE * dt, Math.max((target - p) * dt * 6, MIN_RATE * dt));
        p = Math.min(target, p + move);
        setProgress(p);
        if (p >= 100) return finish();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      document.removeEventListener("DOMContentLoaded", onDom);
      window.removeEventListener("load", onLoad);
      cancelAnimationFrame(raf);
      timers.forEach(window.clearTimeout);
    };
  }, []);

  if (phase === "gone") return null;
  const pct = Math.floor(progress);
  const done = progress >= 100;
  const animated = !reduced;

  return (
    <div
      data-boot-loader=""
      data-boot-mode={reduced ? "reduced" : "full"}
      data-boot-phase={phase}
      className="fixed inset-0 z-[100] grid place-items-center bg-bg text-ink"
      style={{ opacity: phase === "fading" ? 0 : 1, transition: animated ? `opacity ${FADE_MS}ms ease` : "none" }}
    >
      <div
        role="progressbar"
        aria-label="Loading Veloce"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="flex flex-col items-center gap-6"
      >
        <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`} width={96} height={96} fill="currentColor">
          <defs>
            <clipPath id={clipId}>
              {LOGO_POLYGONS.map((points) => <polygon key={points} points={points} />)}
            </clipPath>
          </defs>
          {animated ? (
            <g clipPath={`url(#${clipId})`}>
              {LOGO_CELLS.page.map(({ step, ...cell }) => (
                <rect
                  key={`${cell.x}-${cell.y}`}
                  {...cell}
                  style={{ opacity: (step / LAST_STEP) * 100 <= progress ? 1 : 0, transition: "opacity 120ms linear" }}
                />
              ))}
            </g>
          ) : null}
          {/* The exact mark takes over once complete (or throughout, without motion), so there are no tile seams. */}
          <g style={{ opacity: done || !animated ? 1 : 0, transition: animated ? "opacity 200ms linear" : "none" }}>
            {LOGO_POLYGONS.map((points) => <polygon key={points} points={points} />)}
          </g>
        </svg>
        <div className="flex w-56 flex-col items-center gap-3">
          <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full w-full origin-left rounded-full bg-accent-700" style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <p aria-hidden className="text-sm font-semibold tabular-nums text-muted">{pct}%</p>
        </div>
      </div>
    </div>
  );
}
