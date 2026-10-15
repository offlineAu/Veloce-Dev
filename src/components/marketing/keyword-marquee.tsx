import type { CSSProperties } from "react";
import { PauseOffscreen } from "@/components/motion/pause-offscreen";

/**
 * Ribbon of words scrolling sideways along the top of a section band (see .section-band in globals.css). The main row is set
 * like the site's headings (light, then bold) with the eyebrow's square marker between words; the optional second row is set
 * like the eyebrow itself (mono, uppercase) and runs the other way. Each list is rendered twice so the loop is seamless, and its
 * duration grows with its length so every row moves at an even reading pace. A row pauses while hovered. The whole strip is
 * decorative, since the same words appear elsewhere on the page. Static under reduced motion.
 */
export function KeywordMarquee({ items, secondary }: { items: string[]; secondary?: string[] }) {
  return (
    <div aria-hidden className="marquee-strip">
      <PauseOffscreen />
      <Row items={items} secondsPerChar={0.14}
        className="py-5 font-heading text-[clamp(20px,2.2vw,28px)] tracking-[-0.03em]"
        word={(i) => (i % 2 ? "px-7 font-bold text-ink" : "px-7 font-light text-muted")}
        marker="size-2 bg-accent-700" />
      {secondary?.length ? (
        <Row items={secondary} secondsPerChar={0.3} reverse
          className="marquee-row-rule py-3 font-mono text-[11px] uppercase tracking-[0.18em] sm:text-xs"
          word={() => "px-5 font-semibold text-muted"}
          marker="size-1.5 bg-accent-700/60" />
      ) : null}
    </div>
  );
}

function Row({ items, secondsPerChar, reverse, className, word, marker }: {
  items: string[];
  secondsPerChar: number;
  reverse?: boolean;
  className: string;
  word: (i: number) => string;
  marker: string;
}) {
  const duration = Math.max(20, Math.round(items.join("").length * secondsPerChar));
  const list = (
    <ul className="flex shrink-0 items-center">
      {items.map((t, i) => (
        <li key={t} className="flex items-center whitespace-nowrap">
          <span className={`${word(i)} transition-colors duration-300 hover:text-accent-700`}>{t}</span>
          <span className={`shrink-0 ${marker}`} />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`marquee-row ${className}`}>
      <div className={`marquee-track flex w-max${reverse ? " marquee-track-reverse" : ""}`} style={{ "--marquee-duration": `${duration}s` } as CSSProperties}>
        {list}
        {list}
      </div>
    </div>
  );
}
