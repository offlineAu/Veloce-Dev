"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Background photo carousel for the hero: crossfades to the next photo every `interval` ms, with no
 * dots or controls. Decorative (the parent is aria-hidden). Opacity only; under prefers-reduced-motion it
 * stays on the first photo. Only the first photo loads eagerly.
 * Hero photos should be at least 1920px wide; smaller sources look soft once stretched across the screen.
 */
export function HeroSlideshow({ photos, interval = 10_000, className }: { photos: string[]; interval?: number; className?: string }) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || photos.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % photos.length), interval);
    return () => clearInterval(id);
  }, [reduce, photos.length, interval]);

  return photos.map((src, i) => (
    <Image
      // Unoptimized: the files are already prepared WebP; a second lossy pass by the optimizer makes them grainy.
      key={src} src={src} alt="" fill sizes="100vw" unoptimized
      loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"}
      className={`${className ?? ""} transition-opacity duration-[1500ms] ease-in-out`}
      // Inline so the hidden state always beats the opacity in `className`; only the active photo shows.
      style={i === index ? undefined : { opacity: 0 }}
    />
  ));
}
