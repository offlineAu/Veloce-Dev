"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, m, type Variants } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// "flip" slide motion, adapted from Aceternity's images-slider: the next photo scales and tilts in while the last one flies off the top.
const flip: Variants = {
  enter: { scale: 0.85, opacity: 0, rotateX: 45 },
  show: { scale: 1, opacity: 1, rotateX: 0, transition: { duration: 0.5, ease: [0.645, 0.045, 0.355, 1] } },
  exit: { y: "-150%", transition: { duration: 1 } },
};

/**
 * Background photo carousel for the hero: moves to the next photo every `interval` ms, with no
 * dots or controls. Decorative (the parent is aria-hidden). "fade" crossfades with opacity only; "flip" uses the
 * slide motion above and relies on the parent clipping overflow. Under prefers-reduced-motion it stays on the
 * first photo. Only the first photo loads eagerly.
 * Hero photos should be at least 1920px wide; smaller sources look soft once stretched across the screen.
 */
export function HeroSlideshow({ photos, interval = 10_000, variant = "fade", className }: {
  photos: string[];
  interval?: number;
  variant?: "fade" | "flip";
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || photos.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % photos.length), interval);
    return () => clearInterval(id);
  }, [reduce, photos.length, interval]);

  const current = photos[index];
  if (variant === "flip" && !reduce && current) {
    const next = photos[(index + 1) % photos.length];
    return (
      <div className="absolute inset-0" style={{ perspective: "1000px" }}>
        {/* initial={false}: the first photo is simply there on load, so the motion starts with slide 2. */}
        <AnimatePresence initial={false}>
          <m.div key={index} className="absolute inset-0" variants={flip} initial="enter" animate="show" exit="exit">
            <Image
              // Unoptimized: see below.
              src={current} alt="" fill sizes="100vw" unoptimized
              loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"}
              className={className}
            />
          </m.div>
        </AnimatePresence>
        {/* Fetches the upcoming photo ahead of time so it doesn't pop in half-loaded mid-animation. */}
        {next && next !== current ? <Image src={next} alt="" fill sizes="100vw" unoptimized loading="lazy" className="opacity-0" /> : null}
      </div>
    );
  }

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
