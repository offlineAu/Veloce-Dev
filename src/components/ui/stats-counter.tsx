"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Count-up number triggered on scroll. Adapted from VengeanceUI "stats-counter".
 * Changes: respects prefers-reduced-motion, and the final value is always present in the DOM for
 * assistive tech, search engines and no-JS visitors (the animated digits are decorative).
 */
export interface StatsCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export default function StatsCounter({ value, duration = 1.5, prefix = "", suffix = "", decimals = 0, className }: StatsCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });
  const [display, setDisplay] = useState<number | null>(null);

  useEffect(() => {
    if (isInView && !reduce) motionValue.set(value);
  }, [isInView, reduce, value, motionValue]);

  useEffect(() => springValue.on("change", (latest) => setDisplay(latest)), [springValue]);

  const final = `${prefix}${value.toFixed(decimals)}${suffix}`;
  const animating = display !== null && !reduce;
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      <span className="sr-only">{final}</span>
      <span aria-hidden>{animating ? `${prefix}${display.toFixed(decimals)}${suffix}` : final}</span>
    </span>
  );
}
