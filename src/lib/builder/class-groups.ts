/*
 * Friendly style controls over a piece's class list. Each control reads and rewrites only its own group of classes
 * (padding, gap, columns…), so the design's other classes (and its hover, dark-mode and other state variants) stay
 * as they were. Classes are `vt:`-prefixed Tailwind v4 utilities; anything added is compiled on demand
 * (/api/builder/css). No React, no Node.
 *
 * Devices: the editor shows a site on a phone (375px), a tablet (768px) or a desktop (1280px), and most controls read
 * and write the value for the device being edited. Changes cascade desktop-first, as in Wix or Webflow: setting a
 * value on the desktop also sets it on the tablet and phone unless they have their own, and a tablet value reaches
 * phones the same way. Stored mobile-first as Tailwind does: the phone value bare, the tablet's under `md:` and the
 * desktop's under `lg:`, each only when it differs. The arrangement controls (columns that stack on phones, rows
 * that wrap, visibility) still write phone and larger-screen values together.
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
  /** `label`: a display name (colour styles, whose class name is a variable). */
  colors: { name: string; value: string; label?: string }[];
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
const BORDER_WIDTH = /^border(-(0|2|4|8|\[[^\]]+\]))?$/;
const BORDER_STYLE = /^border-(solid|dashed|dotted|double|hidden|none)$/;
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
    marginTop: /^-?mt-/,
    marginBottom: /^-?mb-/,
    marginX: /^-?mx-/,
    height: /^h-/,
    minHeight: /^min-h-/,
    borderWidth: BORDER_WIDTH,
    borderStyle: BORDER_STYLE,
    borderColor: (u: string) => /^border-/.test(u) && !BORDER_WIDTH.test(u) && !BORDER_STYLE.test(u) && !/^border-(x|y|t|r|b|l|s|e|spacing|collapse|separate)(-|$)/.test(u),
    opacity: /^opacity-/,
    blur: /^blur(-|$)/,
    position: /^(static|relative|absolute|fixed|sticky)$/,
    top: /^-?top-/,
    right: /^-?right-/,
    bottom: /^-?bottom-/,
    left: /^-?left-/,
    z: /^-?z-/,
    leading: /^leading-/,
    tracking: /^tracking-/,
    textCase: /^(uppercase|lowercase|capitalize|normal-case)$/,
  } satisfies Record<string, RegExp | ((u: string) => boolean)>;
}

export type Group = keyof ReturnType<typeof groupMatchers>;
export type Matcher = RegExp | ((u: string) => boolean);
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

export type Device = "phone" | "tablet" | "desktop";
export const DEVICES: Device[] = ["desktop", "tablet", "phone"];
/** The largest breakpoint that applies at each device's canvas width (375, 768 and 1280px). */
const UPTO: Record<Device, number> = { phone: BP_RANK[""]!, tablet: BP_RANK.md!, desktop: BP_RANK.xl! };
/** The device a canvas width shows. */
export const deviceFor = (width: number | string | undefined): Device => {
  const w = typeof width === "number" ? width : Number.parseFloat(String(width ?? ""));
  return !Number.isFinite(w) || w >= 1024 || String(width).endsWith("%") ? "desktop" : w >= 768 ? "tablet" : "phone";
};

/** A group's value on each device: the class with the largest breakpoint that applies at its width. */
export function deviceValues(className: string, m: Matcher): Record<Device, string | undefined> {
  const list = sized(className, m);
  const at = (d: Device) => list.filter((x) => BP_RANK[x.bp]! <= UPTO[d]).reduce<(typeof list)[number] | undefined>((best, x) => (!best || BP_RANK[x.bp]! >= BP_RANK[best.bp]! ? x : best), undefined)?.p.utility;
  return { phone: at("phone"), tablet: at("tablet"), desktop: at("desktop") };
}

/** Whether a device has its own value (rather than the one cascading from the next larger device). */
export function ownOn(className: string, m: Matcher, device: Device): boolean {
  const v = deviceValues(className, m);
  return device === "desktop" ? v.desktop !== undefined : device === "tablet" ? v.tablet !== v.desktop : v.phone !== v.tablet;
}

/**
 * Sets a group's value on one device and the smaller devices that had the same value (desktop-first cascade),
 * keeping every other device's value. Undefined clears it there. Classes with other variants are kept.
 */
export function writeDevice(className: string, m: Matcher, device: Device, value: string | undefined): string {
  const old = deviceValues(className, m);
  const next = { ...old };
  if (device === "desktop") {
    next.desktop = value;
    if (old.tablet === old.desktop) {
      next.tablet = value;
      if (old.phone === old.tablet) next.phone = value;
    }
  } else if (device === "tablet") {
    next.tablet = value;
    if (old.phone === old.tablet) next.phone = value;
  } else next.phone = value;
  return encodeDevices(className, m, next);
}

/** Rewrites a group from per-device values: the phone value bare, tablet under md:, desktop under lg:, when they differ. */
export function encodeDevices(className: string, m: Matcher, v: Record<Device, string | undefined>): string {
  const drop = new Set(sized(className, m).map((x) => x.p.raw));
  const kept = tokens(className).filter((t) => !drop.has(t));
  const add: string[] = [];
  if (v.phone !== undefined) add.push(CLASS_PREFIX + v.phone);
  if (v.tablet !== undefined && v.tablet !== v.phone) add.push(`${CLASS_PREFIX}md:${v.tablet}`);
  if (v.desktop !== undefined && v.desktop !== v.tablet) add.push(`${CLASS_PREFIX}lg:${v.desktop}`);
  return join([...kept, ...add]);
}

/** Shorthands split into the parts a control owns, at every breakpoint: `p-8` → `px-8 py-8`, `vt:md:inset-0` → four sides. */
function expand(className: string, map: Record<string, string[]>): string {
  return join(
    tokens(className).flatMap((raw) => {
      const p = parseClass(raw);
      if (!p || breakpointOf(p) === null) return [raw];
      const neg = p.utility.startsWith("-") ? "-" : "";
      const u = neg ? p.utility.slice(1) : p.utility;
      const hit = Object.keys(map).find((k) => u.startsWith(`${k}-`));
      if (!hit) return [raw];
      const rest = u.slice(hit.length);
      const pre = CLASS_PREFIX + p.variants.map((x) => `${x}:`).join("");
      return map[hit]!.map((to) => `${pre}${neg}${to}${rest}`);
    }),
  );
}
const PAD_SPLIT = { p: ["px", "py"] };
const MARGIN_SPLIT = { m: ["mx", "my"] };
const MARGIN_Y_SPLIT = { my: ["mt", "mb"] };
const INSET_SPLIT = { inset: ["top", "right", "bottom", "left"], "inset-x": ["left", "right"], "inset-y": ["top", "bottom"] };

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
  /** Spacing scale steps; "auto" (horizontal) centres. */
  marginTop?: string;
  marginBottom?: string;
  marginX?: string;
  height?: string;
  minHeight?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
  opacity?: string;
  blur?: string;
  position?: "static" | "relative" | "absolute" | "fixed" | "sticky";
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  z?: string;
  leading?: string;
  tracking?: string;
  textCase?: "uppercase" | "lowercase" | "capitalize" | "normal-case";
}

/** The controls that read and write the device being edited (the rest set every screen at once). */
export const PER_DEVICE: (keyof StyleValues)[] = [
  "gap", "padX", "padY", "items", "justify", "textAlign", "bg", "color", "textSize", "weight", "font", "rounded", "shadow",
  "marginTop", "marginBottom", "marginX", "height", "minHeight", "borderWidth", "borderStyle", "borderColor", "opacity", "blur",
  "position", "top", "right", "bottom", "left", "z", "leading", "tracking", "textCase",
];

const suffix = (u: string | undefined, prefix: string) => (u?.startsWith(prefix) ? u.slice(prefix.length) : undefined);

const WIDTHS = { wide: "max-w-7xl", medium: "max-w-4xl", narrow: "max-w-2xl" } as const;

function readPad(className: string, axis: "x" | "y", g: ReturnType<typeof groupMatchers>, device: Device): string | undefined {
  const v = deviceValues(expand(className, PAD_SPLIT), new RegExp(`^p${axis}-`))[device];
  if (v) return v.slice(3);
  return readGroup(className, axis === "x" ? g.px : g.py).all.length ? "custom" : undefined;
}

/** What each control shows for the device being edited (desktop unless given). */
export function readStyle(className: string, s: Scales, device: Device = "desktop"): StyleValues {
  const g = groupMatchers(s);
  const on = (m: Matcher, c = className) => deviceValues(c, m)[device];
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
    gap: suffix(on(g.gap), "gap-") ?? (readGroup(className, /^gap-[xy]-/).all.length ? "custom" : undefined),
    padX: readPad(className, "x", g, device),
    padY: readPad(className, "y", g, device),
    items: suffix(on(g.items), "items-"),
    justify: suffix(on(g.justify), "justify-"),
    textAlign: suffix(on(g.textAlign), "text-"),
    width,
    bg: suffix(on(g.bg), "bg-"),
    color: suffix(on(g.color), "text-"),
    textSize: suffix(on(g.textSize), "text-")?.replace(/\/.*$/, ""),
    weight: suffix(on(g.weight), "font-"),
    font: suffix(on(g.font), "font-"),
    rounded: (() => {
      const r = on(g.rounded);
      const plain = r && /^rounded(-(none|xs|sm|md|lg|xl|[2-4]xl|full|[a-z][\w-]*))?$/.test(r) && !/^rounded-(t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee)(-|$)/.test(r);
      return r ? (plain ? (r === "rounded" ? "DEFAULT" : r.slice(8)) : "custom") : undefined;
    })(),
    shadow: (() => {
      const v = on(g.shadow);
      return v ? (v === "shadow" ? "DEFAULT" : v.slice(7)) : undefined;
    })(),
    marginTop: signed(on(g.marginTop, margins(className)), "mt-"),
    marginBottom: signed(on(g.marginBottom, margins(className)), "mb-"),
    marginX: signed(on(g.marginX, margins(className)), "mx-"),
    height: suffix(on(g.height), "h-"),
    minHeight: suffix(on(g.minHeight), "min-h-"),
    borderWidth: (() => {
      const v = on(g.borderWidth);
      return v ? (v === "border" ? "1" : v.slice(7)) : undefined;
    })(),
    borderStyle: suffix(on(g.borderStyle), "border-"),
    borderColor: suffix(on(g.borderColor), "border-"),
    opacity: suffix(on(g.opacity), "opacity-"),
    blur: (() => {
      const v = on(g.blur);
      return v ? (v === "blur" ? "DEFAULT" : v.slice(5)) : undefined;
    })(),
    position: on(g.position) as StyleValues["position"],
    top: signed(on(g.top, expand(className, INSET_SPLIT)), "top-"),
    right: signed(on(g.right, expand(className, INSET_SPLIT)), "right-"),
    bottom: signed(on(g.bottom, expand(className, INSET_SPLIT)), "bottom-"),
    left: signed(on(g.left, expand(className, INSET_SPLIT)), "left-"),
    z: signed(on(g.z), "z-"),
    leading: suffix(on(g.leading), "leading-"),
    tracking: suffix(on(g.tracking), "tracking-"),
    textCase: on(g.textCase) as StyleValues["textCase"],
  };
}

/** A class list with margin shorthands split into the sides the controls own. */
const margins = (className: string) => expand(expand(className, MARGIN_SPLIT), MARGIN_Y_SPLIT);
/** `mt-4` → "4", `-mt-4` → "-4". */
const signed = (u: string | undefined, prefix: string) => (u?.startsWith("-") ? (u.slice(1).startsWith(prefix) ? `-${u.slice(1 + prefix.length)}` : undefined) : suffix(u, prefix));
const unsigned = (prefix: string, v: string | undefined) => (v === undefined || v === "" ? undefined : v.startsWith("-") ? `-${prefix}${v.slice(1)}` : prefix + v);

/**
 * Writes one control's new value into the class list for the device being edited (desktop unless given, cascading
 * to smaller devices that had the same value), leaving every other class as it was.
 */
export function writeStyle<K extends keyof StyleValues>(className: string, s: Scales, key: K, value: StyleValues[K], device: Device = "desktop"): string {
  const g = groupMatchers(s);
  const cur = readStyle(className, s, device);
  const next = { ...cur, [key]: value } as StyleValues;
  const opt = (prefix: string, v: string | undefined) => (v === undefined || v === "" ? undefined : prefix + v);
  const w = (c: string, m: Matcher, v: string | undefined) => writeDevice(c, m, device, v);

  switch (key) {
    case "arrange":
    case "visibility":
    case "stackOnPhones":
    case "columns":
      return writeLayout(className, g, next);
    case "gap":
      return w(writeGroup(className, /^gap-[xy]-/, undefined), g.gap, opt("gap-", next.gap));
    case "padX":
    case "padY": {
      // p-N splits into px-N + py-N (at every screen size) so one axis can change.
      const c = expand(className, PAD_SPLIT);
      return key === "padX"
        ? w(writeGroup(c, /^p[lrse]-/, undefined), /^px-/, opt("px-", next.padX))
        : w(writeGroup(c, /^p[tb]-/, undefined), /^py-/, opt("py-", next.padY));
    }
    case "items":
      return w(className, g.items, opt("items-", next.items));
    case "justify":
      return w(className, g.justify, opt("justify-", next.justify));
    case "textAlign":
      return w(className, g.textAlign, opt("text-", next.textAlign));
    case "width": {
      let c = writeGroup(writeGroup(writeGroup(className, /^max-w-/, undefined), /^w-/, undefined), /^mx-auto$/, undefined);
      const w = next.width;
      if (w === "full") c = writeGroup(c, /^w-/, "w-full");
      else if (w === "wide" || w === "medium" || w === "narrow") c = writeGroup(writeGroup(writeGroup(c, /^w-/, "w-full"), /^max-w-/, WIDTHS[w]), /^mx-auto$/, "mx-auto");
      return c;
    }
    case "bg":
      return w(className, g.bg, opt("bg-", next.bg));
    case "color":
      return w(className, g.color, opt("text-", next.color));
    case "textSize":
      return w(className, g.textSize, opt("text-", next.textSize));
    case "weight":
      return w(className, g.weight, opt("font-", next.weight));
    case "font":
      return w(className, g.font, opt("font-", next.font));
    case "rounded":
      return w(className, g.rounded, next.rounded === "DEFAULT" ? "rounded" : opt("rounded-", next.rounded));
    case "shadow":
      return w(className, g.shadow, next.shadow === "DEFAULT" ? "shadow" : opt("shadow-", next.shadow));
    case "marginTop":
      return w(margins(className), g.marginTop, unsigned("mt-", next.marginTop));
    case "marginBottom":
      return w(margins(className), g.marginBottom, unsigned("mb-", next.marginBottom));
    case "marginX":
      return w(margins(className), g.marginX, unsigned("mx-", next.marginX));
    case "height":
      return w(className, g.height, opt("h-", next.height));
    case "minHeight":
      return w(className, g.minHeight, opt("min-h-", next.minHeight));
    case "borderWidth":
      return w(className, g.borderWidth, next.borderWidth === "1" ? "border" : opt("border-", next.borderWidth));
    case "borderStyle":
      return w(className, g.borderStyle, opt("border-", next.borderStyle));
    case "borderColor":
      return w(className, g.borderColor, opt("border-", next.borderColor));
    case "opacity":
      return w(className, g.opacity, opt("opacity-", next.opacity));
    case "blur":
      return w(className, g.blur, next.blur === "DEFAULT" ? "blur" : opt("blur-", next.blur));
    case "position":
      return w(className, g.position, next.position);
    case "top":
    case "right":
    case "bottom":
    case "left":
      return w(expand(className, INSET_SPLIT), g[key as "top" | "right" | "bottom" | "left"], unsigned(`${key}-`, next[key] as string | undefined));
    case "z":
      return w(className, g.z, unsigned("z-", next.z));
    case "leading":
      return w(className, g.leading, opt("leading-", next.leading));
    case "tracking":
      return w(className, g.tracking, opt("tracking-", next.tracking));
    case "textCase":
      return w(className, g.textCase, next.textCase);
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

/** The text-related classes of a class list (size, weight, font, colour, line and letter spacing, case, align). */
export function textClassesOf(className: string): string {
  const g = groupMatchers({ colors: [], textSizes: DEFAULT_TEXT_SIZES, fonts: [], radii: [] });
  // Fonts and sizes the design names itself (font-headline, text-display) count too.
  const font = (u: string) => /^font-/.test(u) && !/^font-(stretch|features|variant)/.test(u);
  const size = (u: string) => /^text-/.test(u) && !test(g.textAlign, u) && !/^text-(wrap|nowrap|balance|pretty|ellipsis|clip)$/.test(u);
  const groups: Matcher[] = [size, font, g.leading, g.tracking, g.textCase, g.textAlign];
  return className.split(/\s+/).filter((t) => {
    const p = parseClass(t);
    return !!p && breakpointOf(p) !== null && groups.some((m) => test(m, p.utility));
  }).join(" ");
}
