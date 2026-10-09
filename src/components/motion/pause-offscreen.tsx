"use client";

import { useEffect, useRef } from "react";

/**
 * Render inside an element with a CSS animation: while that element is away from the viewport it gets data-offscreen,
 * which pauses its animations (see globals.css). Renders nothing itself; observes its parent.
 */
export function PauseOffscreen({ margin = "100px" }: { margin?: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = marker.current?.parentElement;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute("data-offscreen", !e?.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => {
      io.disconnect();
      el.removeAttribute("data-offscreen");
    };
  }, [margin]);
  return <span ref={marker} hidden />;
}
