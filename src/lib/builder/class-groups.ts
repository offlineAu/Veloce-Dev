/*
 * Friendly style controls over a piece's class list. Each control reads and rewrites only its own group of classes
 * (padding, gap, columns…), so the design's other classes (and its hover, dark-mode and other state variants) stay
 * as they were. Classes are `vt:`-prefixed Tailwind v4 utilities; anything added is compiled on demand
 * (/api/builder/css). No React, no Node.
 *
 * Screen sizes: a control shows what larger screens get (the largest breakpoint present) and writes one value for
 * every screen size, except where it offers "on phones" explicitly (columns, row direction, visibility), which writes
 * the phone value bare and the larger-screen value under `md:`.
 */
import { CLASS_PREFIX } from "./template-package";

export const BREAKPOINTS = ["sm", "md", "lg", "xl", "2xl"] as const;
const BP_RANK: Record<string, number> = { "": 0, sm: 1, md: 2, lg: 3, xl: 4, "2xl": 5 };
/** Where "phones" end. */
export const WIDE = "md";

export interface ParsedClass {
  raw: string;
  /** Variants besides the prefix, outermost first (`md`, `hover`, `dark`…). */
  variants: string[];
  utility: string;
}

/** Splits `vt:md:hover:p-4` into variants and utility (colons inside [brackets] don't count). Null if not ours. */
export function parseClass(raw: string): ParsedClass | null {
  if (!raw.startsWith(CLASS_PREFIX)) return null;
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of raw.slice(CLASS_PREFIX.length)) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    if (ch === ":" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (!cur) return null;
  return { raw, variants: parts, utility: cur };
}

/** The screen size a class applies from ("" for all), or null when it has other variants (hover:, dark:…). */
function breakpointOf(p: ParsedClass): string | null {
  if (!p.variants.length) return "";
  return p.variants.length === 1 && p.variants[0]! in BP_RANK ? p.variants[0]! : null;
}

const tokens = (className: string) => className.split(/\s+/).filter(Boolean);
const join = (list: string[]) => [...new Set(list)].join(" ");

/** Names the design's theme defines, which decide what `text-…`, `bg-…` and `font-…` mean. */
export interface Scales {
  colors: { name: string; value: string }[];
  textSizes: string[];
  fonts: string[];
  radii: string[];
}

export const DEFAULT_TEXT_SIZES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"];
export const DEFAULT_RADII = ["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"];
const WEIGHTS = ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"];

/** The design's colours, type scale, fonts and radii, read from its compiled stylesheet's theme variables. */
export function scalesFromCss(css: string): Scales {
  const colors = new Map<string, string>();
  const sizes = new Set<string>();
  const fonts = new Set<string>();
  const radii = new Set<string>();
  for (const m of css.matchAll(/--vt-(color|text|font|radius)-([a-zA-Z0-9][\w-]*?):([^;}]+)/g)) {
    const [, kind, name, value] = m as unknown as [string, string, string, string];
    if (kind === "color") colors.set(name, value.trim());
    else if (kind === "text" && !/--/.test(name) && !name.endsWith("-line-height") && !name.endsWith("-letter-spacing") && !name.endsWith("-font-weight")) sizes.add(name);
    else if (kind === "font" && !/^weight-/.test(name)) fonts.add(name);
    else if (kind === "radius") radii.add(name);
  }
  return {
    colors: [...colors].map(([name, value]) => ({ name, value })),
    textSizes: [...new Set([...DEFAULT_TEXT_SIZES, ...sizes])],
    fonts: [...fonts],
    radii: [...new Set([...DEFAULT_RADII, ...radii])],
  };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const oneOf = (names: string[]) => names.map(esc).join("|");

/** What each control owns, as utility patterns. */
export function groupMatchers(s: Scales) {
  const size = new RegExp(`^text-(${oneOf(s.textSizes)}|\\[[^\\]]+\\])(\\/[\\w.[\\]-]+)?$`);
  const align = /^text-(left|center|right|justify|start|end)$/;
  const textOther = /^text-(wrap|nowrap|balance|pretty|ellipsis|clip)$/;
  const bgNotColor = /^bg-(cover|contain|auto|center|top|bottom|left|right|left-top|left-bottom|right-top|right-bottom|no-repeat|repeat(-[xy]|-round|-space)?|fixed|local|scroll|clip-\w+|origin-\w+|blend-\w+|none|linear-.*|radial.*|conic.*|gradient-.*|\[url.*)$/;
  return {
    display: /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root)$/,
    direction: /^flex-(row|col)(-reverse)?$/,
    cols: /^grid-cols-/,
    gap: /^gap-/,
    items: /^items-/,
    justify: /^justify-(start|end|center|between|around|evenly|stretch|normal)$/,
    textAlign: align,
    px: /^p[xlrse]?-/,
    py: /^p[ytb]?-/,
    width: /^(max-w-|w-|mx-auto$)/,
    bg: (u: string) => /^bg-/.test(u) && !bgNotColor.test(u),
    color: (u: string) => /^text-/.test(u) && !size.test(u) && !align.test(u) && !textOther.test(u),
    textSize: size,
    weight: new RegExp(`^font-(${WEIGHTS.join("|")})$`),
    font: (u: string) => /^font-/.test(u) && !new RegExp(`^font-(${WEIGHTS.join("|")})$`).test(u) && !/^font-(stretch|features|variant)/.test(u),
    rounded: /^rounded(-|$)/,
    shadow: /^shadow(-(2xs|xs|sm|md|lg|xl|2xl|none|inner))?$/,
  } satisfies Record<string, RegExp | ((u: string) => boolean)>;
}

export type Group = keyof ReturnType<typeof groupMatchers>;
type Matcher = RegExp | ((u: string) => boolean);
const test = (m: Matcher, u: string) => (typeof m === "function" ? m(u) : m.test(u));

/** Classes of a group that apply by screen size only, with the screen size each starts at. */
function sized(className: string, m: Matcher): { p: ParsedClass; bp: string }[] {
  const out: { p: ParsedClass; bp: string }[] = [];
  for (const raw of tokens(className)) {
    const p = parseClass(raw);
    const bp = p ? breakpointOf(p) : null;
    if (p && bp !== null && test(m, p.utility)) out.push({ p, bp });
  }
  return out;
}

/** What a group is set to: on phones (no breakpoint) and on larger screens (the largest breakpoint present). */
export function readGroup(className: string, m: Matcher): { phone?: string; wide?: string; all: string[] } {
  const list = sized(className, m);
  const phone = list.filter((x) => x.bp === "").map((x) => x.p.utility);
  const wide = [...list].sort((a, b) => BP_RANK[b.bp]! - BP_RANK[a.bp]!)[0];
  return { phone: phone.at(-1), wide: wide?.p.utility, all: list.map((x) => x.p.utility) };
}

/**
 * Replaces a group's screen-size classes. `wide` alone applies everywhere; with `phone` too, phones get `phone` and
 * larger screens `wide`. Undefined clears the group. Classes with other variants (hover:, dark:) are kept.
 */
export function writeGroup(className: string, m: Matcher, wide: string | undefined, phone?: string): string {
  const drop = new Set(sized(className, m).map((x) => x.p.raw));
  const kept = tokens(className).filter((t) => !drop.has(t));
  const add: string[] = [];
  if (phone !== undefined && wide !== undefined && phone !== wide) add.push(CLASS_PREFIX + phone, `${CLASS_PREFIX}${WIDE}:${wide}`);
  else if (wide !== undefined) add.push(CLASS_PREFIX + wide);
  else if (phone !== undefined) add.push(CLASS_PREFIX + phone);
  return join([...kept, ...add]);
}

/* ------------------------------------------------------------------------------------------------------------------
 * The controls. Each reads a friendly value from the class list and writes it back.
 * ---------------------------------------------------------------------------------------------------------------- */

export type Arrange = "plain" | "stack" | "row" | "grid";
export type Visibility = "all" | "hide-phones" | "phones-only";

export interface StyleValues {
  arrange: Arrange;
  /** Grid columns, or "row" wrapping to a column, become one column on phones. */
  stackOnPhones: boolean;
  columns?: number;
  visibility: Visibility;
  gap?: string;
  padX?: string;
  padY?: string;
  items?: string;
  justify?: string;
  textAlign?: string;
  width?: "full" | "wide" | "medium" | "narrow" | "custom";
  bg?: string;
  color?: string;
  textSize?: string;
  weight?: string;
  font?: string;
  rounded?: string;
  shadow?: string;
}

const suffix = (u: string | undefined, prefix: string) => (u?.startsWith(prefix) ? u.slice(prefix.length) : undefined);

const WIDTHS = { wide: "max-w-7xl", medium: "max-w-4xl", narrow: "max-w-2xl" } as const;

function readPad(className: string, axis: "x" | "y", g: ReturnType<typeof groupMatchers>): string | undefined {
  const own = readGroup(className, new RegExp(`^p${axis}-`)).wide;
  if (own) return own.slice(3);
  const both = readGroup(className, /^p-/).wide;
  return both ? both.slice(2) : readGroup(className, axis === "x" ? g.px : g.py).all.length ? "custom" : undefined;
}

export function readStyle(className: string, s: Scales): StyleValues {
  const g = groupMatchers(s);
  const display = readGroup(className, g.display);
  const dir = readGroup(className, g.direction);
  const cols = readGroup(className, g.cols);
  const wideDisplay = display.wide ?? display.phone;
  let arrange: Arrange = "plain";
  if (wideDisplay === "grid" || wideDisplay === "inline-grid") arrange = "grid";
  else if (wideDisplay === "flex" || wideDisplay === "inline-flex") arrange = (dir.wide ?? dir.phone ?? "flex-row").startsWith("flex-col") ? "stack" : "row";
  // "Hidden on phones": hidden bare, shown from a breakpoint up; "phones only": hidden from a breakpoint up.
  const visibility: Visibility = display.phone === "hidden" && display.wide && display.wide !== "hidden" ? "hide-phones" : display.wide === "hidden" && display.phone && display.phone !== "hidden" ? "phones-only" : "all";
  const colN = Number(suffix(cols.wide ?? cols.phone, "grid-cols-"));
  const stackOnPhones = arrange === "grid" ? cols.phone === "grid-cols-1" && !!cols.wide && cols.wide !== cols.phone : arrange === "row" && dir.phone === "flex-col" && !!dir.wide?.startsWith("flex-row");

  const maxW = readGroup(className, /^max-w-/).wide;
  const w = readGroup(className, /^w-/).wide;
  const width = maxW ? ((Object.entries(WIDTHS).find(([, v]) => v === maxW)?.[0] as StyleValues["width"]) ?? "custom") : w === "w-full" ? "full" : undefined;

  return {
    arrange,
    stackOnPhones,
    columns: Number.isFinite(colN) && colN > 0 ? colN : undefined,
    visibility,
    gap: suffix(readGroup(className, g.gap).wide, "gap-") ?? (readGroup(className, /^gap-[xy]-/).all.length ? "custom" : undefined),
    padX: readPad(className, "x", g),
    padY: readPad(className, "y", g),
    items: suffix(readGroup(className, g.items).wide, "items-"),
    justify: suffix(readGroup(className, g.justify).wide, "justify-"),
    textAlign: suffix(readGroup(className, g.textAlign).wide, "text-"),
    width,
    bg: suffix(readGroup(className, g.bg).wide, "bg-"),
    color: suffix(readGroup(className, g.color).wide, "text-"),
    textSize: suffix(readGroup(className, g.textSize).wide, "text-")?.replace(/\/.*$/, ""),
    weight: suffix(readGroup(className, g.weight).wide, "font-"),
    font: suffix(readGroup(className, g.font).wide, "font-"),
    rounded: (() => {
      const r = readGroup(className, g.rounded);
      const plain = r.wide && /^rounded(-(none|xs|sm|md|lg|xl|[2-4]xl|full|[a-z][\w-]*))?$/.test(r.wide) && !/^rounded-(t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee)(-|$)/.test(r.wide);
      return r.wide ? (plain ? (r.wide === "rounded" ? "DEFAULT" : r.wide.slice(8)) : "custom") : undefined;
    })(),
    shadow: (() => {
      const v = readGroup(className, g.shadow).wide;
      return v ? (v === "shadow" ? "DEFAULT" : v.slice(7)) : undefined;
    })(),
  };
}

/** Writes one control's new value into the class list, leaving every other class as it was. */
export function writeStyle<K extends keyof StyleValues>(className: string, s: Scales, key: K, value: StyleValues[K]): string {
  const g = groupMatchers(s);
  const cur = readStyle(className, s);
  const next = { ...cur, [key]: value } as StyleValues;
  const opt = (prefix: string, v: string | undefined) => (v === undefined || v === "" ? undefined : prefix + v);

  switch (key) {
    case "arrange":
    case "visibility":
    case "stackOnPhones":
    case "columns":
      return writeLayout(className, g, next);
    case "gap":
      return writeGroup(writeGroup(className, /^gap-[xy]-/, undefined), g.gap, opt("gap-", next.gap));
    case "padX":
    case "padY": {
      // p-N splits into px-N + py-N when only one axis changes.
      const both = readGroup(className, /^p-/).wide;
      let c = className;
      if (both) {
        c = writeGroup(c, /^p-/, undefined);
        const n = both.slice(2);
        if (key === "padX" && !readGroup(c, /^py-/).wide) c = writeGroup(c, /^py-/, `py-${n}`);
        if (key === "padY" && !readGroup(c, /^px-/).wide) c = writeGroup(c, /^px-/, `px-${n}`);
      }
      return key === "padX"
        ? writeGroup(writeGroup(c, /^p[lrse]-/, undefined), /^px-/, opt("px-", next.padX))
        : writeGroup(writeGroup(c, /^p[tb]-/, undefined), /^py-/, opt("py-", next.padY));
    }
    case "items":
      return writeGroup(className, g.items, opt("items-", next.items));
    case "justify":
      return writeGroup(className, g.justify, opt("justify-", next.justify));
    case "textAlign":
      return writeGroup(className, g.textAlign, opt("text-", next.textAlign));
    case "width": {
      let c = writeGroup(writeGroup(writeGroup(className, /^max-w-/, undefined), /^w-/, undefined), /^mx-auto$/, undefined);
      const w = next.width;
      if (w === "full") c = writeGroup(c, /^w-/, "w-full");
      else if (w === "wide" || w === "medium" || w === "narrow") c = writeGroup(writeGroup(writeGroup(c, /^w-/, "w-full"), /^max-w-/, WIDTHS[w]), /^mx-auto$/, "mx-auto");
      return c;
    }
    case "bg":
      return writeGroup(className, g.bg, opt("bg-", next.bg));
    case "color":
      return writeGroup(className, g.color, opt("text-", next.color));
    case "textSize":
      return writeGroup(className, g.textSize, opt("text-", next.textSize));
    case "weight":
      return writeGroup(className, g.weight, opt("font-", next.weight));
    case "font":
      return writeGroup(className, g.font, opt("font-", next.font));
    case "rounded":
      return writeGroup(className, g.rounded, next.rounded === "DEFAULT" ? "rounded" : opt("rounded-", next.rounded));
    case "shadow":
      return writeGroup(className, g.shadow, next.shadow === "DEFAULT" ? "shadow" : opt("shadow-", next.shadow));
    default:
      return className;
  }
}

/** Arrangement, columns, "stack on phones" and visibility share the display/direction/columns classes. */
function writeLayout(className: string, g: ReturnType<typeof groupMatchers>, v: StyleValues): string {
  const inline = readGroup(className, g.display).wide?.startsWith("inline-") ?? false;
  const shown = v.arrange === "grid" ? (inline ? "inline-grid" : "grid") : v.arrange === "plain" ? "block" : inline ? "inline-flex" : "flex";
  const display = v.visibility === "hide-phones" ? { phone: "hidden", wide: shown } : v.visibility === "phones-only" ? { phone: shown, wide: "hidden" } : { phone: undefined, wide: v.arrange === "plain" ? undefined : shown };
  // A plain element that is shown everywhere needs no display class at all.
  let c = writeGroup(className, g.display, display.wide, display.phone);

  if (v.arrange === "row") c = writeGroup(c, g.direction, "flex-row", v.stackOnPhones ? "flex-col" : undefined);
  else if (v.arrange === "stack") c = writeGroup(c, g.direction, "flex-col");
  else c = writeGroup(c, g.direction, undefined);

  if (v.arrange === "grid") {
    const n = Math.min(12, Math.max(1, v.columns ?? 2));
    c = writeGroup(c, g.cols, `grid-cols-${n}`, v.stackOnPhones && n > 1 ? "grid-cols-1" : undefined);
  } else c = writeGroup(c, g.cols, undefined);
  return c;
}

/* ------------------------------------------------------------------------------------------------------------------
 * The raw class list (Advanced): shown without the prefix, written back with it.
 * ---------------------------------------------------------------------------------------------------------------- */

const CLASS_TOKEN = /^[\w:/[\]().%#,!'"&>*+~=@-]{1,200}$/;

/** Readable classes: `vt:md:p-4 vt-material-symbols` → `md:p-4 vt-material-symbols`. */
export const showClasses = (className: string) => tokens(className).map((t) => (t.startsWith(CLASS_PREFIX) ? t.slice(CLASS_PREFIX.length) : t)).join(" ");

/** Typed classes back to stored ones; returns the ones that were refused. */
export function storeClasses(typed: string): { className: string; refused: string[] } {
  const refused: string[] = [];
  const out: string[] = [];
  for (const t of tokens(typed)) {
    // The design's own helper classes (vt-material-symbols…) keep their name; everything else is a Tailwind class.
    const stored = t.startsWith("vt-") || t.startsWith(CLASS_PREFIX) ? t : CLASS_PREFIX + t;
    if (CLASS_TOKEN.test(stored) && !/[<>]/.test(stored)) out.push(stored);
    else refused.push(t);
  }
  return { className: join(out), refused };
}
