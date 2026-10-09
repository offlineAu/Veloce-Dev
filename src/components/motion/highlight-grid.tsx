"use client";

import * as React from "react";
import { m } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/*
 * A grid whose hover/focus highlight glides between cells. Concept after VengeanceUI "highlight-grid" (MIT),
 * implemented independently: one absolutely positioned outline follows the active cell (pointer OR keyboard focus),
 * transform-only, pointer-events none, no motion under prefers-reduced-motion. The cells themselves stay plain.
 * Mark each cell with data-cell.
 */
export function HighlightGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [box, setBox] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const target = (e: React.SyntheticEvent) => {
    const root = ref.current;
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
    if (!root || !cell || !root.contains(cell)) return;
    const r = root.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    setBox({ x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height });
  };

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      onPointerOver={target}
      onFocusCapture={target}
      onPointerLeave={() => setBox(null)}
      onBlurCapture={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) setBox(null);
      }}
    >
      {children}
      <m.span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-10 rounded-lg border-2 border-accent/70 bg-accent/5"
        initial={false}
        animate={box ? { x: box.x, y: box.y, width: box.w, height: box.h, opacity: 1 } : { opacity: 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
      />
    </div>
  );
}
