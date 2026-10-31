"use client";

import { useEffect, useRef } from "react";
import { SCREEN_SIZE, drawScreen, preloadScreens } from "./screen";
import type { ShowStore, ShowcaseItem } from "./store";

/**
 * The same display as the 3D laptop's (or, with `paint`, the phone's), drawn into a plain 2D canvas for the poster: used where WebGL is
 * missing or unsuitable (and by automated browsers), so the build still plays there. Redraws on change only.
 */
export function FlatScreen({ store, items, size = SCREEN_SIZE, paint = drawScreen }: { store: ShowStore; items: ShowcaseItem[]; size?: { width: number; height: number }; paint?: typeof drawScreen }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d", { willReadFrequently: paint !== drawScreen });
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const fonts = { mono: css.getPropertyValue("--font-mono").trim() || "ui-monospace, monospace", sans: css.getPropertyValue("--font-body").trim() || "system-ui, sans-serif" };
    let mix = store.get().phase === "site" ? 1 : 0;
    let frame = 0;
    let last = performance.now();
    const draw = () => {
      frame = 0;
      const now = performance.now();
      const s = store.get();
      const target = s.phase === "site" ? 1 : 0;
      mix += (target - mix) * Math.min(1, ((now - last) / 1000) * 5);
      last = now;
      if (Math.abs(mix - target) < 0.01) mix = target;
      const item = items[s.active] ?? items[0];
      if (item) paint(ctx, s, item, mix, fonts, schedule);
      if (mix !== target) schedule();
    };
    const schedule = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(draw); } };
    preloadScreens(items, schedule);
    const off = store.subscribe(schedule);
    const blink = setInterval(() => { if (store.get().phase === "code") schedule(); }, 500);
    schedule();
    return () => { off(); clearInterval(blink); cancelAnimationFrame(frame); };
  }, [store, items, paint]);
  return <canvas ref={canvas} width={size.width} height={size.height} className="absolute inset-0 size-full" aria-hidden />;
}
