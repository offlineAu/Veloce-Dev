"use client";

import { useEffect } from "react";
import { PERF_STORAGE_KEY } from "@/lib/themes";

/*
 * Adaptive performance: watches real frame times and, if this device cannot keep up, switches the site to lite mode
 * (data-perf="lite": decorative motion freezes, grain and glow are dropped; see globals.css). It never fights the visitor:
 * with an explicit "Always play" / "Reduce animations" choice it does nothing. Lite lasts for this visit (sessionStorage),
 * and the next visit is measured again. Probes run after load and again at the first scroll, because that is when
 * low-end devices struggle.
 */
const WINDOW = 90; // frames per measurement (~1.5s at 60fps)
const SLOW_MS = 34; // average frame time above this (< ~30fps) counts as slow
const MAX_WINDOWS = 4;

function probe(onSlow: () => void): () => void {
  let raf = 0;
  let last = 0;
  let sum = 0;
  let n = 0;
  let slow = 0;
  let windows = 0;
  const tick = (t: number) => {
    const dt = t - last;
    // Ignore the first frame, background-tab gaps and huge stalls (not representative of steady animation cost).
    if (last && !document.hidden && dt < 250) {
      sum += dt;
      n++;
    }
    last = t;
    if (n >= WINDOW) {
      slow = sum / n > SLOW_MS ? slow + 1 : 0;
      sum = 0;
      n = 0;
      windows++;
      if (slow >= 2) return onSlow(); // two slow windows in a row: not a one-off hiccup
      if (windows >= MAX_WINDOWS) return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function PerfMonitor() {
  useEffect(() => {
    const d = document.documentElement;
    let stop = () => {};
    const run = () => {
      stop();
      if (d.dataset.perf === "lite" || d.dataset.motion) return; // already lite, or the visitor decided
      stop = probe(() => {
        d.dataset.perf = "lite";
        try {
          sessionStorage.setItem(PERF_STORAGE_KEY, "lite");
        } catch {
          /* ignore */
        }
      });
    };
    const start = window.setTimeout(run, 2000);
    window.addEventListener("scroll", run, { once: true, passive: true });
    return () => {
      window.clearTimeout(start);
      window.removeEventListener("scroll", run);
      stop();
    };
  }, []);
  return null;
}
