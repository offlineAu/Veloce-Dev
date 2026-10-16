import type { CSSProperties, ReactNode } from "react";
import { flipDelay } from "@/lib/builder/behaviours";

/*
 * Text effects as React renders them (no script rewrites the text): a heading's words in their own boxes to slide in
 * (`data-vt-split`), a title's letters doubled to roll on hover (`data-vt-roll`), letters that flip over once
 * (`data-vt-flip`). Class names follow the common convention (`vt-w`, `vt-roll`/`vt-ch`, `vt-wd`/`vt-fc`), which a
 * design's own CSS may style (the importer renames a template's `.w`, `.roll`… to these); otherwise the builder's
 * simple looks apply (BEHAVIOUR_CSS). The runtime (behaviours.tsx) only marks when they play.
 */

export type TextEffect = "split" | "roll" | "flip";

const v = (name: string, value: string | number) => ({ [name]: value }) as CSSProperties;

export function textEffectOf(attrs: Record<string, unknown> | undefined): TextEffect | undefined {
  if (!attrs) return undefined;
  if ("data-vt-split" in attrs) return "split";
  if ("data-vt-roll" in attrs) return "roll";
  if ("data-vt-flip" in attrs) return "flip";
  return undefined;
}

/** The text with the effect's spans. Letters are hidden from screen readers; the element should carry the text as a label. */
export function effectText(effect: TextEffect, text: string): ReactNode[] {
  const parts = text.split(/(\s+)/);
  if (effect === "split") {
    let i = 0;
    return parts.map((w, k) => (/^\s+$/.test(w) || !w ? w : <span key={k} className="vt-w"><span style={v("--vt-i", i++)}>{w}</span></span>));
  }
  if (effect === "roll") {
    return [
      <span key="r" className="vt-roll" aria-hidden="true">
        {[...text].map((c, i) => <span key={i} className="vt-ch" data-c={c} style={v("--vt-c", i)}>{c === " " ? " " : c}</span>)}
      </span>,
    ];
  }
  const total = text.length;
  let idx = 0;
  return parts.map((w, k) => {
    if (/^\s+$/.test(w) || !w) {
      idx += w.length;
      return w;
    }
    return (
      <span key={k} className="vt-wd" aria-hidden="true">
        {[...w].map((c, j) => <span key={j} className="vt-fc" data-c={c} style={v("--vt-fd", `${flipDelay(idx++, total).toFixed(3)}s`)}>{c}</span>)}
      </span>
    );
  });
}
