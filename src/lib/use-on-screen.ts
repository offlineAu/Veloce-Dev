"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element is near the viewport and the tab is visible. Drive looping animations and timers from it so
 * they stop costing CPU/GPU when nobody can see them. Starts false (nothing runs before the first observation).
 */
export function useOnScreen(ref: RefObject<Element | null>, margin = "100px"): boolean {
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(!!e?.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return near && visible;
}
