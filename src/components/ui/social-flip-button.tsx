"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { FaDiscord, FaEnvelope, FaFacebook, FaGithub, FaInstagram, FaLinkedin, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export type SocialKind = "email" | "whatsapp" | "facebook" | "instagram" | "linkedin" | "github" | "x" | "discord";

export interface SocialItem {
  kind: SocialKind;
  label: string;
  /** No link yet: the tile still shows (and flips) but is not clickable and says so. */
  href?: string;
}

const icons: Record<SocialKind, React.ComponentType> = {
  email: FaEnvelope,
  whatsapp: FaWhatsapp,
  facebook: FaFacebook,
  instagram: FaInstagram,
  linkedin: FaLinkedin,
  github: FaGithub,
  x: FaXTwitter,
  discord: FaDiscord,
};

/*
 * Flip row. Complete port of VengeanceUI "social-flip-button" (MIT): letter tiles that flip to channel icons with a
 * staggered spring, hover tooltips with an arrow, and two light streaks sweeping the top and bottom borders.
 * Veloce changes:
 *  - the front letters spell the brand name, one letter per channel (repeats if there are more channels than letters)
 *  - themed with site tokens (no dark-mode classes); links have accessible names (the letters are decorative)
 *  - flips on keyboard focus as well as hover, tooltip also shows on focus
 *  - honours prefers-reduced-motion: no flip animation, no border streaks (icons simply show on hover/focus)
 *  - channels without a link yet stay visible as inactive tiles (dimmed icon, "not set up yet" tooltip); nothing is made up
 *  - mailto links open in place, other links open a new tab with rel="noopener noreferrer"
 */
export default function SocialFlipButton({ items, word = "VELOCE", className }: { items: SocialItem[]; word?: string; className?: string }) {
  const [flipped, setFlipped] = useState(false);
  const [tip, setTip] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const letters = (word.trim() || "VELOCE").toUpperCase().split("");

  return (
    <div
      className={cn("relative grid w-fit max-w-full grid-cols-3 items-center gap-2 rounded-2xl border border-line bg-neutral-100 p-3 shadow-sm sm:inline-flex sm:flex-wrap", className)}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => {
        setFlipped(false);
        setTip(null);
      }}
      onFocus={() => setFlipped(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setFlipped(false);
          setTip(null);
        }
      }}
    >
      {reduce ? null : (
        <div aria-hidden className="pointer-events-none absolute -inset-px overflow-hidden rounded-2xl">
          <m.div
            className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          />
          <m.div
            className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent"
            animate={{ x: ["100%", "-100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}

      {items.map((item, i) => {
        const Glyph = icons[item.kind];
        const live = Boolean(item.href);
        const external = live && !item.href!.startsWith("mailto:") && !item.href!.startsWith("tel:");
        const Tile = live ? "a" : "span";
        const show = flipped;
        return (
          <Tile
            key={item.kind}
            {...(live ? { href: item.href, "aria-label": item.label } : { role: "img", "aria-label": `${item.label} (not set up yet)` })}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="relative block size-11 shrink-0 rounded-lg [perspective:1000px]"
            onMouseEnter={() => setTip(i)}
            onMouseLeave={() => setTip(null)}
            onFocus={() => setTip(i)}
            onBlur={() => setTip(null)}
          >
            <AnimatePresence>
              {show && tip === i ? (
                <m.span
                  aria-hidden
                  initial={reduce ? false : { opacity: 0, y: 10, scale: 0.8, x: "-50%" }}
                  animate={{ opacity: 1, y: -52, scale: 1, x: "-50%" }}
                  exit={{ opacity: 0, y: 10, scale: 0.8, x: "-50%" }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="pointer-events-none absolute left-1/2 top-0 z-50 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-bg shadow-xl"
                >
                  {live ? item.label : `${item.label}, not set up yet`}
                  <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-ink" />
                </m.span>
              ) : null}
            </AnimatePresence>

            <m.span
              aria-hidden
              className="relative block size-full"
              initial={false}
              animate={reduce ? undefined : { rotateY: show ? 180 : 0 }}
              transition={{ duration: 0.8, type: "spring", stiffness: 120, damping: 15, delay: i * 0.08 }}
              style={{ transformStyle: "preserve-3d" }}
            >
              <span
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-neutral-200 font-heading text-xl text-ink shadow-sm"
                style={{ backfaceVisibility: "hidden", ...(reduce && show ? { visibility: "hidden" } : {}) }}
              >
                {letters[i % letters.length]}
              </span>
              <span
                className={cn("absolute inset-0 flex items-center justify-center rounded-lg bg-accent-600 text-lg text-on-accent", !live && "opacity-50")}
                style={reduce ? { visibility: show ? "visible" : "hidden" } : { backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <Glyph />
              </span>
            </m.span>
          </Tile>
        );
      })}
    </div>
  );
}
