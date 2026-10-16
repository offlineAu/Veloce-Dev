/*
 * Animations a visitor gives a design piece, stored as one class each (no script needed anywhere):
 *   entrance  plays as the piece scrolls into view (CSS scroll-driven animation, `animation-timeline: view()`);
 *             browsers without it just show the piece
 *   hover     a small change while the pointer is over it
 * Both are off for visitors who ask for reduced motion. They animate `transform` and `opacity`, which Tailwind v4's
 * own translate/scale/rotate utilities (separate properties) don't use, so a piece keeps its own placement. No React.
 */

export const ENTRANCES = [
  { value: "", label: "None" },
  { value: "vt-enter-fade", label: "Fade in" },
  { value: "vt-enter-rise", label: "Rise" },
  { value: "vt-enter-scale", label: "Grow in" },
  { value: "vt-enter-left", label: "From the left" },
  { value: "vt-enter-right", label: "From the right" },
] as const;

export const HOVERS = [
  { value: "", label: "None" },
  { value: "vt-hover-lift", label: "Lift" },
  { value: "vt-hover-grow", label: "Grow" },
  { value: "vt-hover-dim", label: "Dim" },
] as const;

const ENTER = /^vt-enter-[a-z]+$/;
const HOVER = /^vt-hover-[a-z]+$/;
const ENTER_SET = new Set<string>(ENTRANCES.map((e) => e.value).filter(Boolean));
const HOVER_SET = new Set<string>(HOVERS.map((e) => e.value).filter(Boolean));

const tokens = (className: string) => className.split(/\s+/).filter(Boolean);

export function readMotion(className: string): { enter: string; hover: string } {
  const list = tokens(className);
  return { enter: list.find((t) => ENTER_SET.has(t)) ?? "", hover: list.find((t) => HOVER_SET.has(t)) ?? "" };
}

/** `className` with its entrance or hover animation replaced (empty removes it). */
export function writeMotion(className: string, kind: "enter" | "hover", value: string): string {
  const pattern = kind === "enter" ? ENTER : HOVER;
  const allowed = kind === "enter" ? ENTER_SET : HOVER_SET;
  const kept = tokens(className).filter((t) => !pattern.test(t));
  return [...kept, ...(allowed.has(value) ? [value] : [])].join(" ");
}

export const MOTION_CSS =
  "@media (prefers-reduced-motion:no-preference){" +
  "@supports (animation-timeline:view()){" +
  ":is(.vt-enter-fade,.vt-enter-rise,.vt-enter-scale,.vt-enter-left,.vt-enter-right){animation:veloce-enter linear both;animation-timeline:view();animation-range:entry 0% entry 70%}" +
  ".vt-enter-fade{--veloce-from:none}" +
  ".vt-enter-rise{--veloce-from:translateY(2.5rem)}" +
  ".vt-enter-scale{--veloce-from:scale(.9)}" +
  ".vt-enter-left{--veloce-from:translateX(-3rem)}" +
  ".vt-enter-right{--veloce-from:translateX(3rem)}" +
  "@keyframes veloce-enter{from{opacity:0;transform:var(--veloce-from)}}" +
  "}" +
  ":is(.vt-hover-lift,.vt-hover-grow,.vt-hover-dim){transition:transform .25s ease,box-shadow .25s ease,opacity .25s ease}" +
  ".vt-hover-lift:hover{transform:translateY(-4px);box-shadow:0 14px 30px -14px rgb(0 0 0/.4)}" +
  ".vt-hover-grow:hover{transform:scale(1.04)}" +
  ".vt-hover-dim:hover{opacity:.75}" +
  "}";
