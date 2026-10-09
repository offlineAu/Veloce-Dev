"use client";

import { useEffect, type ReactNode } from "react";
import { LazyMotion, MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { PerfMonitor } from "@/components/site/perf-monitor";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** App-wide client providers. Every framer-motion animation honours reduced motion unless the visitor chose "Always animate". */
export function Providers({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  // Lets CSS pause every looping animation while the tab is in the background.
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute("data-tab-hidden", document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return (
    <LazyMotion features={() => import("./motion/features").then((f) => f.default)} strict>
      <MotionConfig reducedMotion={reduce ? "always" : "never"}>
        {children}
        <PerfMonitor />
        <Toaster />
      </MotionConfig>
    </LazyMotion>
  );
}
