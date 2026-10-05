"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Subtle once-only reveal: fades in and rises 16px as it enters the viewport.
 * Opacity and transform only (no layout shift). Under prefers-reduced-motion the global MotionConfig drops the
 * transform, leaving a plain fade. `data-reveal` lets the <noscript> rule in the layout show content without JS.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
  cell = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section";
  /** Mark as a HighlightGrid cell. */
  cell?: boolean;
}) {
  const Comp = motion[as];
  return (
    <Comp
      data-reveal
      data-cell={cell || undefined}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}
