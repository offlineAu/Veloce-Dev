"use client";

import { Fragment } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";

/*
 * Word-by-word rise for section headings. Adapted from VengeanceUI "stagger-text" (MIT).
 * Changes: the full text is exposed once to assistive tech (sr-only) and the animated copy is aria-hidden;
 * under reduced motion the words are simply shown (CSS, see .stagger-word in globals.css; the markup never changes, so switching
 * the setting does not remount or flicker the heading); only used below the fold so the hero is never held back.
 */
const EASE = [0.22, 1, 0.36, 1] as const;

/** `bold`: how many trailing words to set bold on their own line (the editorial "light / **bold**" split). */
export function StaggerText({ text, delay = 0, bold = 0 }: { text: string; delay?: number; bold?: number }) {
  const words = text.split(" ");
  const boldFrom = bold > 0 ? Math.max(0, words.length - bold) : words.length;
  return (
    <>
      <span className="sr-only">{text}</span>
      <m.span
        aria-hidden
        data-reveal
        className="inline"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "0px 0px -8% 0px" }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: delay } } }}
      >
        {words.map((w, i) => (
          <Fragment key={i}>
            {i === boldFrom && i > 0 ? <br className="hidden sm:inline" /> : null}
            <span className={cn("-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-top", i >= boldFrom && "font-bold")}>
              <m.span
                className="stagger-word inline-block"
                variants={{ hidden: { y: "110%" }, show: { y: "0%", transition: { duration: 0.6, ease: EASE } } }}
              >
                {w}
                {i < words.length - 1 ? " " : ""}
              </m.span>
            </span>
          </Fragment>
        ))}
      </m.span>
    </>
  );
}
