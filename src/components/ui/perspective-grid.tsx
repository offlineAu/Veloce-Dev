"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/*
 * Perspective grid, VengeanceUI "perspective-grid" (MIT): a tilted plane of real tiles with a radial fade.
 * Veloce changes:
 *  - straight "floor" tilt (rotateX only) instead of the original rotateY/rotateZ skew, which looked crooked at full width
 *  - themed (page tokens instead of white/black/gray) and decorative (aria-hidden, no pointer capture)
 *  - the tiles light up under the pointer wherever it is on the host section, not only when it is over the grid
 *    (content sits above the grid, so plain :hover would almost never fire); lit tiles fade out slowly = a trail
 *  - under prefers-reduced-motion the glow stays (it is only a colour change, no movement) but fades quickly, no long trail
 */
interface PerspectiveGridProps {
  className?: string;
  /** Number of tiles per row/column (default 40). */
  gridSize?: number;
  showOverlay?: boolean;
  /** Fade radius percentage for the overlay (default 80). */
  fadeRadius?: number;
}

const subscribeNone = () => () => {};

export function PerspectiveGrid({ className, gridSize = 40, showOverlay = true, fadeRadius = 80 }: PerspectiveGridProps) {
  // false during SSR/hydration, true afterwards: the 1,600 tiles are client-only so the HTML stays small.
  const mounted = useSyncExternalStore(subscribeNone, () => true, () => false);
  const root = useRef<HTMLDivElement>(null);
  const tiles = useMemo(() => Array.from({ length: gridSize * gridSize }), [gridSize]);

  useEffect(() => {
    const el = root.current;
    const host = el?.parentElement;
    if (!mounted || !el || !host) return;
    const lit = new Map<Element, number>();
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const t of document.elementsFromPoint(e.clientX, e.clientY)) {
          if (!el.contains(t) || !t.classList.contains("tile")) continue;
          t.classList.add("lit");
          window.clearTimeout(lit.get(t));
          lit.set(t, window.setTimeout(() => { t.classList.remove("lit"); lit.delete(t); }, 120));
          break;
        }
      });
    };
    host.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", move);
      lit.forEach((id) => window.clearTimeout(id));
    };
  }, [mounted]);

  return (
    <div
      ref={root}
      aria-hidden
      className={cn("pointer-events-none absolute inset-x-0 top-0 -z-10 h-[820px] overflow-hidden", className)}
      style={{ perspective: "2000px", transformStyle: "preserve-3d" }}
    >
      <div
        className="absolute grid aspect-square w-[80rem] origin-center"
        style={{
          left: "50%",
          top: "62%",
          transform: "translate(-50%, -50%) rotateX(58deg) scale(2.4)",
          transformStyle: "preserve-3d",
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize}, 1fr)`,
        }}
      >
        {mounted && tiles.map((_, i) => <div key={i} className="tile min-h-px min-w-px border border-ink/15 bg-transparent" />)}
      </div>
      {showOverlay ? (
        <div className="absolute inset-0 z-10" style={{ background: `radial-gradient(circle, transparent 25%, var(--color-bg) ${fadeRadius}%)` }} />
      ) : null}
    </div>
  );
}

export default PerspectiveGrid;
