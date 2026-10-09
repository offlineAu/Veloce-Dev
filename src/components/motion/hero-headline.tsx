import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Hero headline with a CSS-only word rise (no JavaScript, so it never waits for hydration and does not delay LCP
 * beyond the ~0.7s animation). Each word slides up out of a clipped line; delays are staggered. Under
 * prefers-reduced-motion the words simply appear (see .hero-word in globals.css). The text stays real text,
 * read normally by assistive tech. `bold`: how many trailing words are set bold on their own line.
 */
export function HeroHeadline({ text, bold = 0 }: { text: string; bold?: number }) {
  const words = text.split(" ");
  const boldFrom = bold > 0 ? Math.max(0, words.length - bold) : words.length;
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          {i === boldFrom && i > 0 ? <br /> : null}
          <span className={cn("-mb-[0.1em] inline-block overflow-hidden pb-[0.1em] align-top", i >= boldFrom && "font-bold")}>
            <span className="hero-word inline-block" style={{ animationDelay: `${120 + i * 90}ms` }}>
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          </span>
        </Fragment>
      ))}
    </>
  );
}
