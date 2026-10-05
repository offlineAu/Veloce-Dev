"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** App-wide client providers. Every framer-motion animation honours reduced motion unless the visitor chose "Always animate". */
export function Providers({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "never"}>
      {children}
      <Toaster />
    </MotionConfig>
  );
}
