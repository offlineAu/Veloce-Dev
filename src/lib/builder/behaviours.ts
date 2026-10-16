/*
 * Interactions the builder runs itself (components/builder/behaviours.tsx). A template's own scripts never run, so
 * what they did (reveal on scroll, count-ups, an endless photo wall, a menu that opens…) is described with one
 * allow-listed attribute per behaviour, `data-vt-<name>="<value>"`, on the element it applies to. Every layer agrees
 * on these through this file: the importer writes them, pieces and locked sections keep them, the server checks them,
 * the editor's Interactions panel sets them and the runtime reads them. No React.
 *
 * The runtime keeps what it changes out of React's way: element state goes in `data-vt-state` (space-separated tokens,
 * which the design's own CSS is rewritten to use: `.open` → `[data-vt-state~="open"]`), positions and timings in
 * `--vt-*` custom properties, and marquee copies at the end of their container (marked `data-vt-clone`).
 */

export const STATE_ATTR = "data-vt-state";
export const CLONE_ATTR = "data-vt-clone";
/** Runtime state tokens. */
export const STATES = ["in", "open", "on", "hit", "dim", "invalid"] as const;
export type StateToken = (typeof STATES)[number];

const ID = /^[A-Za-z][\w-]{0,63}$/;
const num = (s: string | undefined, min: number, max: number): number | null => {
  if (s === undefined || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Math.min(max, Math.max(min, n));
};
const words = (v: string) => v.trim().split(/\s+/).filter(Boolean);
const flag = (tokens: string[], ...allowed: string[]) => tokens.every((t) => allowed.includes(t));

/** Each behaviour's value grammar: the normalised value, or null when it isn't valid. */
const GRAMMAR = {
  /** Shows when scrolled into view. `[delayMs] [stagger:ms] [from:start|center]`: stagger sets `--vt-d` on children. */
  reveal: (v: string) => {
    const out: string[] = [];
    for (const t of words(v)) {
      const stagger = /^stagger:(\d{1,4})$/.exec(t);
      const from = /^from:(start|center)$/.exec(t);
      if (stagger) out.push(`stagger:${Math.min(1000, Number(stagger[1]))}`);
      else if (from) out.push(t);
      else if (num(t, 0, 5000) !== null) out.push(String(num(t, 0, 5000)));
      else return null;
    }
    return out.join(" ");
  },
  /** A heading whose words slide in one after another (rendered as spans by text-effects.tsx). */
  split: (v: string) => (["", "words"].includes(v.trim()) ? "words" : null),
  /** A title whose letters roll on hover. */
  roll: (v: string) => (v.trim() === "" ? "" : null),
  /** A heading whose letters flip over once, when scrolled into view. */
  flip: (v: string) => (v.trim() === "" ? "" : null),
  /** A number that counts up from 0 when scrolled into view (its own text: "$1,600", "4.9"). */
  count: (v: string) => (v.trim() === "" ? "" : null),
  /** An endless scroll of the element's first child: `x|y up|down|left|right speedPxPerSecond [pause]`. */
  marquee: (v: string) => {
    const [axis, dir, speed, ...rest] = words(v);
    if (axis !== "x" && axis !== "y") return null;
    if (!(axis === "y" ? ["up", "down"] : ["left", "right"]).includes(dir ?? "")) return null;
    const s = num(speed, 4, 400);
    if (s === null || !flag(rest, "pause")) return null;
    return [axis, dir, s, ...new Set(rest)].join(" ");
  },
  /**
   * A button that opens and closes another element: `targetId [close-links] [on]` (closes when a link inside is used;
   * marks the open target "on" instead of "open", for designs that show it with `.on`).
   */
  toggle: (v: string) => {
    const [id, ...rest] = words(v);
    return id && ID.test(id) && flag(rest, "close-links", "on") ? [id, ...new Set(rest)].join(" ") : null;
  },
  /** A list whose items open and close (each item's first button): `single` keeps one open at a time. */
  accordion: (v: string) => (["", "single", "multi"].includes(v.trim()) ? v.trim() || "single" : null),
  /** Text shown instead while the nearest opened item is open ("+" → "−"). */
  alt: (v: string) => (v.length <= 12 && !/[<>]/.test(v) ? v : null),
  /** A list whose items switch the panels of another element (one per item, in order): `panelsId [hover]`. */
  tabs: (v: string) => {
    const [id, ...rest] = words(v);
    return id && ID.test(id) && flag(rest, "hover") ? [id, ...new Set(rest)].join(" ") : null;
  },
  /** A stack of cards, the top one shown: `[swipe] [status:id]` (an element that reads "2 of 5"). */
  stack: (v: string) => {
    const out: string[] = [];
    for (const t of words(v)) {
      const status = /^status:([A-Za-z][\w-]{0,63})$/.exec(t);
      if (t === "swipe" || status) out.push(t);
      else return null;
    }
    return out.join(" ");
  },
  /**
   * A carousel of its children, the current one in front: `[linked:id,…] [dots:id] [status:id] [auto:ms] [swipe]`.
   * Each child gets `--vt-pos` (0 in front, then 1, 2… behind it; -1 for the one just left, which is "dim") and the
   * current one is "on"; the design's CSS places them. Linked elements (a headline and a price, one child per slide)
   * show their matching child "on"; the dots mark the current one "on" and those before it "hit"; the status reads
   * "02 / 06"; it moves on by itself every `auto` ms (paused while pointed at, the dots "dim" then).
   */
  carousel: (v: string) => {
    const out: string[] = [];
    for (const t of words(v)) {
      const ref = /^(linked|dots|status):([\w-]+(?:,[\w-]+){0,3})$/.exec(t);
      const auto = /^auto:(\d{1,5})$/.exec(t);
      if (ref && ref[2]!.split(",").every((id) => ID.test(id)) && (ref[1] === "linked" || !ref[2]!.includes(","))) out.push(t);
      else if (auto) out.push(`auto:${Math.min(60000, Math.max(1500, Number(auto[1])))}`);
      else if (t === "swipe") out.push(t);
      else return null;
    }
    return [...new Set(out)].join(" ");
  },
  /** A button that moves the stack (or carousel) its `aria-controls` names: `next|prev`. */
  step: (v: string) => (["next", "prev"].includes(v.trim()) ? v.trim() : null),
  /** A navigation whose link to the section in view is marked (and an underline moves to it). */
  spy: (v: string) => (v.trim() === "" ? "" : null),
  /** A glow that follows the pointer along the element (`--vt-sx`, `--vt-so`). */
  spotlight: (v: string) => (v.trim() === "" ? "" : null),
  /** A light that follows the pointer inside each child (`--vt-x`, `--vt-y`). */
  pointer: (v: string) => (v.trim() === "" ? "" : null),
  /** Children appear one after another once in view: `startMs stepMs`. */
  seq: (v: string) => {
    const [a, b, ...rest] = words(v);
    const start = num(a, 0, 10_000);
    const step = num(b, 50, 10_000);
    return start !== null && step !== null && !rest.length ? `${start} ${step}` : null;
  },
  /** A child of a sequence that shows, then makes way for the next (a typing indicator). */
  transient: (v: string) => (v.trim() === "" ? "" : null),
  /** A text field that highlights the matching items of a list: `listId`. */
  filter: (v: string) => (ID.test(v.trim()) ? v.trim() : null),
  /** A form that checks its required fields and then shows a thank-you element: `successId`. It never sends. */
  form: (v: string) => (ID.test(v.trim()) ? v.trim() : null),
} satisfies Record<string, (v: string) => string | null>;

export type BehaviourName = keyof typeof GRAMMAR;
export const BEHAVIOUR_NAMES = Object.keys(GRAMMAR) as BehaviourName[];
/**
 * A design's own data attribute that its stylesheet styles by (`.head[data-mark]::before{content:attr(data-mark)}`),
 * kept as `data-vt-x-<name>`. Short plain text; it does nothing by itself.
 */
export const DESIGN_DATA_ATTR = /^data-vt-x-[a-z][a-z0-9-]{0,30}$/;
export const designDataAttr = (name: string) => `data-vt-x-${name.replace(/^data-/, "")}`;
/** `data-vt-<behaviour>` attribute names, and design data attributes. */
export const BEHAVIOUR_ATTR = new RegExp(`^data-vt-(${BEHAVIOUR_NAMES.join("|")}|x-[a-z][a-z0-9-]{0,30})$`);
export const behaviourAttr = (name: BehaviourName) => `data-vt-${name}`;

/** A behaviour attribute's normalised value, or null when the attribute or its value isn't allowed. */
export function parseBehaviour(attr: string, value: unknown): string | null {
  const m = BEHAVIOUR_ATTR.exec(attr);
  if (!m) return null;
  const v = value === true ? "" : typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
  if (v === null || v.length > 120) return null;
  if (DESIGN_DATA_ATTR.test(attr)) return /[<>\p{Cc}]/u.test(v) ? null : v;
  return GRAMMAR[m[1] as BehaviourName](v);
}

/** The behaviours on an attribute map (normalised), skipping anything invalid. */
export function behavioursOf(attrs: Record<string, unknown> | undefined): Partial<Record<BehaviourName, string>> {
  const out: Partial<Record<BehaviourName, string>> = {};
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (DESIGN_DATA_ATTR.test(k)) continue;
    const parsed = parseBehaviour(k, v);
    if (parsed !== null) out[k.slice("data-vt-".length) as BehaviourName] = parsed;
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Maths the runtime uses (pure, so it can be tested).
 * ---------------------------------------------------------------------------------------------------------------- */

/** How far one copy of a marquee moves, and how many copies fill the container. */
export function marqueeLayout(setSize: number, gap: number, containerSize: number, speed: number) {
  const shift = Math.max(1, setSize + gap);
  return { shift, copies: Math.max(1, Math.ceil(containerSize / shift) + 1), seconds: Math.max(2, shift / Math.max(1, speed)) };
}

/**
 * Where a marquee starts in its loop, 0..1: side-by-side ones (a wall of columns) each start at a different point, so
 * none of them begins lined up with the others at its first item.
 */
export const marqueeStart = (index: number) => (0.31 + index * 0.37) % 1;

/** A number in text ("from $1,600", "4.9"): its parts, so it can be shown counting up in the same format. */
export function countParts(text: string): { before: string; value: number; decimals: number; grouped: boolean; after: string } | null {
  const m = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/.exec(text);
  if (!m) return null;
  const whole = m[2]!;
  return { before: m[1]!, value: Number(whole.replace(/,/g, "") + (m[3] ?? "")), decimals: m[3] ? m[3].length - 1 : 0, grouped: whole.includes(","), after: m[4]! };
}

export function formatCount(p: NonNullable<ReturnType<typeof countParts>>, value: number): string {
  const fixed = value.toFixed(p.decimals);
  const [i, d] = fixed.split(".");
  const int = p.grouped ? i!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : i!;
  return `${p.before}${int}${d ? `.${d}` : ""}${p.after}`;
}

/** Ease-out cubic, 0..1. */
export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** A card's place in a stack shown from `top`: 0 for the top card, then 1, 2… behind it. */
export const stackOffset = (index: number, top: number, count: number) => (((index - top) % count) + count) % count;

/** Each letter's start delay for a flip, in seconds: slow at first, quicker towards the end (up to .45s). */
export const flipDelay = (index: number, total: number) => Math.sin((index / Math.max(1, total)) * (Math.PI / 2)) * 0.45;

/** Column of each child (0-based) from their left edges, for staggering a grid from its middle. */
export function columnsOf(lefts: number[]): number[] {
  const distinct = [...new Set(lefts.map((l) => Math.round(l)))].sort((a, b) => a - b);
  return lefts.map((l) => distinct.indexOf(Math.round(l)));
}

/**
 * The part of a document's viewport that's on screen, in its own coordinates. Inside the editor the page is an iframe,
 * drawn smaller than it is (a 1280px page in a narrower canvas) and partly off the editor's window: what's visible is
 * where the frame meets that window, converted back to the page's own pixels.
 */
export function visibleRange(frame: { top: number; height: number } | null, ownHeight: number, outerHeight: number): { top: number; bottom: number } {
  if (!frame || !frame.height) return { top: 0, bottom: ownHeight };
  const scale = frame.height / Math.max(1, ownHeight);
  return { top: Math.max(0, -frame.top / scale), bottom: Math.max(0, Math.min(ownHeight, (outerHeight - frame.top) / scale)) };
}

/* ------------------------------------------------------------------------------------------------------------------
 * CSS: the mechanics (unlayered), and simple looks for behaviours a design doesn't style itself (in the base layer,
 * below the design's own CSS). Motion only runs when the root has `data-vt-motion` (set by the runtime unless the
 * visitor prefers reduced motion), so without the runtime everything shows in its finished state.
 * ---------------------------------------------------------------------------------------------------------------- */

export const BEHAVIOUR_CSS =
  // Endless scroll: the runtime adds copies and sets how far and how fast.
  // Each one starts part-way through its loop (--vt-start, a negative delay), so a wall of them is already mid-stream.
  "[data-vt-motion] [data-vt-marquee][style*='--vt-shift']{animation-timing-function:linear;animation-iteration-count:infinite;animation-duration:var(--vt-dur,30s);animation-delay:var(--vt-start,0s);will-change:transform}" +
  "[data-vt-motion] [data-vt-marquee~='y'][style*='--vt-shift']{animation-name:vt-marquee-y}" +
  "[data-vt-motion] [data-vt-marquee~='x'][style*='--vt-shift']{animation-name:vt-marquee-x}" +
  "[data-vt-motion] [data-vt-marquee~='down'],[data-vt-motion] [data-vt-marquee~='right']{animation-direction:reverse}" +
  "[data-vt-marquee~='pause']:hover,[data-vt-busy] [data-vt-marquee]{animation-play-state:paused!important}" +
  // In the editor, Puck hides anything inside a block that isn't one of its blocks (opacity 0); a marquee's copies
  // aren't, on purpose. They take the design's own opacity instead (revert-layer skips Puck's unlayered rule).
  "[data-vt-clone][data-vt-clone][data-vt-clone][data-vt-clone]{opacity:revert-layer}" +
  "@keyframes vt-marquee-y{from{transform:translateY(0)}to{transform:translateY(calc(var(--vt-shift,0px)*-1))}}" +
  "@keyframes vt-marquee-x{from{transform:translateX(0)}to{transform:translateX(calc(var(--vt-shift,0px)*-1))}}" +
  // A stack of cards: the runtime numbers them from the top (--vt-k); without it only the first shows.
  "[data-vt-stack]{position:relative}" +
  "[data-vt-stack][data-vt-state~='on']>*{transform:translate(calc(var(--vt-k,0)*16px),calc(var(--vt-k,0)*10px)) scale(calc(1 - var(--vt-k,0)*.05)) rotate(var(--vt-r,0deg));z-index:calc(10 - var(--vt-k,0));opacity:clamp(0,calc(4 - var(--vt-k,0)),1);transition:transform .5s cubic-bezier(.22,1,.36,1),opacity .4s}" +
  "[data-vt-stack]:not([data-vt-state~='on'])>*:not(:first-child){visibility:hidden}" +
  "@layer base{" +
  // Looks for behaviours added in the editor, for designs without their own.
  "[data-vt-motion] [data-vt-reveal]:not([data-vt-state~='in']){opacity:0;transform:translateY(24px)}" +
  "[data-vt-reveal]{transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1);transition-delay:calc(var(--vt-d,0)*1ms)}" +
  "[data-vt-reveal][data-vt-reveal*='stagger']>*{transition:opacity .7s,transform .7s;transition-delay:calc(var(--vt-d,0)*1ms)}" +
  "[data-vt-motion] [data-vt-reveal*='stagger']:not([data-vt-state~='in'])>*{opacity:0;transform:translateY(24px)}" +
  "[data-vt-motion] [data-vt-reveal*='stagger']:not([data-vt-state~='in']){opacity:1;transform:none}" +
  "[data-vt-split] .vt-w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.06em}" +
  "[data-vt-split] .vt-w>span{display:inline-block;transition:transform .8s cubic-bezier(.22,1,.36,1);transition-delay:calc(var(--vt-i,0)*55ms)}" +
  "[data-vt-motion] [data-vt-split]:not([data-vt-state~='in']) .vt-w>span{transform:translateY(105%)}" +
  "[data-vt-roll] .vt-roll{display:inline-flex;overflow:hidden}" +
  "[data-vt-roll] .vt-ch{display:inline-block;position:relative;transition:transform .35s;transition-delay:calc(var(--vt-c,0)*18ms)}" +
  "[data-vt-roll] .vt-ch::after{content:attr(data-c);position:absolute;left:0;top:100%}" +
  "[data-vt-motion] :hover>[data-vt-roll] .vt-ch,[data-vt-motion] [data-vt-roll]:hover .vt-ch{transform:translateY(-100%)}" +
  "[data-vt-state~='invalid'] :is(input,select,textarea){border-color:#b42318}" +
  "}" +
  "@media (prefers-reduced-motion:reduce){[data-vt-marquee]{animation:none!important}}";
