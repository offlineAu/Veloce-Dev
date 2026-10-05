"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  // The "Always animate" choice is the data-motion="full" attribute on <html> (see ThemeManager).
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    mq.removeEventListener("change", cb);
    mo.disconnect();
  };
};

/**
 * True when the device asks for reduced motion and the visitor has not chosen "Always animate".
 * Hydration-safe: the server snapshot is always `false`, so the first client render matches the server HTML.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.motion !== "full" && window.matchMedia(QUERY).matches,
    () => false,
  );
}
