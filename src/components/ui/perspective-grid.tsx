"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * Perspective grid, inspired by VengeanceUI "perspective-grid" (MIT): a tilted plane with a radial fade.
 * Veloce changes:
 *  - straight "floor" tilt (rotateX only) instead of the original rotateY/rotateZ skew, which looked crooked at full width
 *  - themed (page tokens instead of white/black/gray) and decorative (aria-hidden, no pointer capture)
 *  - light on devices: the grid lines are one CSS background (no per-tile DOM nodes; the old version rendered 1,600 of them),
 *    and the pointer glow reuses a small pool of cells instead of hit-testing the 3D plane on every move
 *  - the glow follows the pointer wherever it is on the host section (content sits above the grid); lit cells fade out slowly = a trail
 *  - under reduced motion the glow stays (it is only a colour change, no movement) but fades quickly, no long trail
 *  - no glow on touch devices (no hover) or low-power devices (data-perf="lite"), so no listeners there
 */
interface PerspectiveGridProps {
  className?: string;
  /** Number of tiles per row/column (default 40). */
  gridSize?: number;
  showOverlay?: boolean;
  /** Fade radius percentage for the overlay (default 80). */
  fadeRadius?: number;
}

// Plane geometry. Keep in sync with the inline style below.
const PERSPECTIVE = 2000;
const TILT = (58 * Math.PI) / 180;
const SCALE = 2.4;
const TOP = 0.62; // plane centre, as a fraction of the container height
const POOL = 24; // glow cells alive at once (they fade for ~1.5s)

export function PerspectiveGrid({ className, gridSize = 40, showOverlay = true, fadeRadius = 80 }: PerspectiveGridProps) {
  const root = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const pool = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = root.current;
    const host = el?.parentElement;
    const grid = plane.current;
    if (!el || !host || !grid || window.matchMedia("(pointer: coarse)").matches || document.documentElement.dataset.perf === "lite") return;
    const timers = new Map<HTMLElement, number>();
    let raf = 0;
    let next = 0;
    let last = -1;
    let pt: { x: number; y: number } | null = null;

    // Inverts the plane's transform (perspective -> rotateX -> scale) to find the grid cell under a screen point.
    const cellAt = (clientX: number, clientY: number) => {
      const box = el.getBoundingClientRect();
      const u = clientX - box.left - box.width / 2;
      const v = clientY - box.top - box.height / 2;
      const dy = (TOP - 0.5) * box.height;
      const sin = Math.sin(TILT);
      const y = (v - dy) / (SCALE * (Math.cos(TILT) + (v * sin) / PERSPECTIVE));
      const w = 1 - (y * SCALE * sin) / PERSPECTIVE;
      if (!(w > 0)) return null;
      const x = (u * w) / SCALE;
      const size = grid.offsetWidth;
      const col = Math.floor(((x + size / 2) / size) * gridSize);
      const row = Math.floor(((y + size / 2) / size) * gridSize);
      return col < 0 || row < 0 || col >= gridSize || row >= gridSize ? null : { col, row };
    };

    const frame = () => {
      raf = 0;
      if (!pt) return;
      const c = cellAt(pt.x, pt.y);
      if (!c || c.row * gridSize + c.col === last) return;
      last = c.row * gridSize + c.col;
      const cell = pool.current[next++ % POOL];
      if (!cell) return;
      window.clearTimeout(timers.get(cell));
      cell.style.left = `${(c.col / gridSize) * 100}%`;
      cell.style.top = `${(c.row / gridSize) * 100}%`;
      cell.classList.add("lit");
      timers.set(cell, window.setTimeout(() => cell.classList.remove("lit"), 120));
    };
    const move = (e: PointerEvent) => {
      pt = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(frame);
    };
    host.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", move);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [gridSize]);

  const line = "color-mix(in srgb, var(--color-ink) 15%, transparent)";
  const cell = `${100 / gridSize}%`;
  return (
    <div
      ref={root}
      aria-hidden
      className={cn("pointer-events-none absolute inset-x-0 top-0 -z-10 h-[820px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]", className)}
      style={{ perspective: `${PERSPECTIVE}px` }}
    >
      <div
        ref={plane}
        className="absolute aspect-square w-[80rem] origin-center"
        style={{
          left: "50%",
          top: `${TOP * 100}%`,
          transform: `translate(-50%, -50%) rotateX(58deg) scale(${SCALE})`,
          backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
          backgroundSize: `${cell} ${cell}`,
        }}
      >
        {Array.from({ length: POOL }, (_, i) => (
          <div key={i} ref={(n) => { pool.current[i] = n; }} className="tile absolute" style={{ width: cell, height: cell }} />
        ))}
      </div>
      {showOverlay ? (
        <div className="absolute inset-0 z-10" style={{ background: `radial-gradient(circle, transparent 25%, var(--color-bg) ${fadeRadius}%)` }} />
      ) : null}
    </div>
  );
}

export default PerspectiveGrid;
