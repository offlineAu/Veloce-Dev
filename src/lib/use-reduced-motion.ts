"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  // The visitor's choice is the data-motion attribute on <html> ("full" | "reduced" | unset = match device, see ThemeManager).
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion", "data-perf"] });
  return () => {
    mq.removeEventListener("change", cb);
    mo.disconnect();
  };
};

/** Resolves the visitor's motion choice against the device setting. Safe to call only in the browser. */
export function prefersReducedMotion(): boolean {
  const choice = document.documentElement.dataset.motion;
  if (choice === "full") return false;
  if (choice === "reduced") return true;
  // No explicit choice: follow the device, and treat a low-power device (data-perf="lite", see themeInitScript) as "reduce".
  return window.matchMedia(QUERY).matches || document.documentElement.dataset.perf === "lite";
}

/**
 * True when the visitor chose "Reduce animations", or has not chosen "Always play" and the device asks for reduced motion.
 * Hydration-safe: the server snapshot is always `false`, so the first client render matches the server HTML.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    prefersReducedMotion,
    () => false,
  );
}
