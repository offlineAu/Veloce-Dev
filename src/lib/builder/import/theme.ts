/*
 * Step 2: the design's tokens. Reads the inline Tailwind v3 config (with JSON5, never eval) and the YAML frontmatter
 * of DESIGN.md (which wins where both define something), and produces
 *   - a Tailwind v4 @theme block, so the design's own class names (bg-surface, font-headline-xl…) compile, and
 *   - the builder's ThemeTokens, so native blocks added to the template match it.
 */
import JSON5 from "json5";
import { parse as parseYaml } from "yaml";
import { contrast, normalizeTheme, readableOn, type ThemeTokens } from "../theme";
import type { Report } from "./report";

type Dict = Record<string, unknown>;

export interface DesignTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  radius: Record<string, string>;
  fontFamily: Record<string, string[]>;
  fontSize: Record<string, { size: string; lineHeight?: string; letterSpacing?: string; fontWeight?: string }>;
  shadow: Record<string, string>;
  tracking: Record<string, string>;
  leading: Record<string, string>;
  breakpoints: Record<string, string>;
}

const empty = (): DesignTokens => ({ colors: {}, spacing: {}, radius: {}, fontFamily: {}, fontSize: {}, shadow: {}, tracking: {}, leading: {}, breakpoints: {} });

const isDict = (v: unknown): v is Dict => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);
/** Token names become CSS custom-property names: keep them to safe characters. */
const KEY = /^[A-Za-z0-9_-]{1,60}$/;
/** Token values go into CSS: no braces, semicolons or url(). */
const VALUE = /^[^;{}<>]{1,200}$/;

function strings(src: unknown, report: Report, what: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isDict(src)) return out;
  for (const [k, v] of Object.entries(src)) {
    const s = str(v);
    if (KEY.test(k) && s && VALUE.test(s) && !/url\(/i.test(s)) out[k] = s;
    else if (isDict(v)) for (const [sub, sv] of Object.entries(v)) {
      // Tailwind's nested colours: { primary: { DEFAULT: "#…", dark: "#…" } } → primary, primary-dark
      const name = sub === "DEFAULT" ? k : `${k}-${sub}`;
      const s2 = str(sv);
      if (KEY.test(name) && s2 && VALUE.test(s2)) out[name] = s2;
    }
    else report.warn(`Ignored ${what} token "${k.slice(0, 40)}".`);
  }
  return out;
}

/** Reads `tailwind.config = { … }` from the page script. The object is data, so it is parsed, not executed. */
export function readTailwindConfig(script: string | undefined, report: Report): Dict | null {
  if (!script) return null;
  const start = script.indexOf("{", script.search(/tailwind\.config\s*=/));
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  let quote: string | null = null;
  for (let i = start; i < script.length; i++) {
    const ch = script[i]!;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  try {
    const parsed: unknown = JSON5.parse(script.slice(start, end + 1));
    return isDict(parsed) ? parsed : null;
  } catch {
    report.warn("The page's Tailwind config isn't plain data (it has code in it), so its theme was skipped.");
    return null;
  }
}

export function tokensFromConfig(config: Dict | null, report: Report): DesignTokens {
  const t = empty();
  if (!config) return t;
  const theme = isDict(config.theme) ? config.theme : {};
  const ext = isDict(theme.extend) ? theme.extend : {};
  // A v3 config can set a scale directly on `theme` (replacing Tailwind's) or under `extend`; v4 always extends.
  const pick = (key: string) => ({ ...(isDict(theme[key]) ? (theme[key] as Dict) : {}), ...(isDict(ext[key]) ? (ext[key] as Dict) : {}) });

  t.colors = strings(pick("colors"), report, "colour");
  t.spacing = strings(pick("spacing"), report, "spacing");
  t.radius = strings(pick("borderRadius"), report, "radius");
  t.shadow = strings(pick("boxShadow"), report, "shadow");
  t.tracking = strings(pick("letterSpacing"), report, "letter-spacing");
  t.leading = strings(pick("lineHeight"), report, "line-height");
  t.breakpoints = strings(pick("screens"), report, "breakpoint");
  for (const [k, v] of Object.entries(pick("fontFamily"))) {
    const list = (Array.isArray(v) ? v : [v]).map(str).filter((s): s is string => !!s && /^[\w\s'"-]{1,60}$/.test(s));
    if (KEY.test(k) && list.length) t.fontFamily[k] = list.map((s) => s.replace(/['"]/g, ""));
  }
  for (const [k, v] of Object.entries(pick("fontSize"))) {
    if (!KEY.test(k)) continue;
    const [size, opts] = Array.isArray(v) ? v : [v];
    const o = isDict(opts) ? opts : typeof opts === "string" ? { lineHeight: opts } : {};
    const s = str(size);
    if (s && VALUE.test(s)) t.fontSize[k] = { size: s, lineHeight: str(o.lineHeight), letterSpacing: str(o.letterSpacing), fontWeight: str(o.fontWeight) };
  }
  for (const key of Object.keys(ext)) {
    if (!["colors", "spacing", "borderRadius", "boxShadow", "letterSpacing", "lineHeight", "screens", "fontFamily", "fontSize"].includes(key)) {
      report.warn(`Theme setting "${key}" isn't imported; check anything that depends on it.`);
    }
  }
  return t;
}

/** DESIGN.md frontmatter (Stitch's design-system export): colors, typography, rounded, spacing. */
export function tokensFromDesignMd(md: string | undefined, report: Report): { tokens: DesignTokens; notes?: string } {
  const t = empty();
  if (!md) return { tokens: t };
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { tokens: t, notes: md.trim() || undefined };
  let front: unknown;
  try {
    front = parseYaml(m[1]!);
  } catch {
    report.warn("DESIGN.md frontmatter couldn't be read; only the page's Tailwind config was used.");
    return { tokens: t, notes: m[2]!.trim() || undefined };
  }
  if (!isDict(front)) return { tokens: t, notes: m[2]!.trim() || undefined };
  t.colors = strings(front.colors, report, "colour");
  t.spacing = strings(front.spacing, report, "spacing");
  t.radius = strings(front.rounded, report, "radius");
  if (isDict(front.typography)) {
    for (const [k, v] of Object.entries(front.typography)) {
      if (!KEY.test(k) || !isDict(v)) continue;
      const family = str(v.fontFamily);
      if (family && /^[\w\s-]{1,60}$/.test(family)) t.fontFamily[k] = [family];
      const size = str(v.fontSize);
      if (size && VALUE.test(size)) t.fontSize[k] = { size, lineHeight: str(v.lineHeight), letterSpacing: str(v.letterSpacing), fontWeight: str(v.fontWeight) };
    }
  }
  return { tokens: t, notes: m[2]!.trim() || undefined };
}

/** Later sources win, per token. */
export function mergeTokens(...all: DesignTokens[]): DesignTokens {
  const out = empty();
  for (const t of all) for (const k of Object.keys(out) as (keyof DesignTokens)[]) Object.assign(out[k], t[k]);
  return out;
}

const SERIF = /serif|playfair|garamond|georgia|times|merriweather|lora|cormorant|didot|bodoni|baskerville|libre caslon|fraunces|dm serif/i;
export const fontStack = (names: string[]) => {
  const generic = names.some((n) => SERIF.test(n) && !/sans/i.test(n)) ? "serif" : "sans-serif";
  return [...names.map((n) => (/\s/.test(n) ? `"${n}"` : n)), generic].join(", ");
};

/** The design tokens as a Tailwind v4 @theme block (names are compiled with the template prefix later). */
export function themeCss(t: DesignTokens): string {
  const lines: string[] = [];
  const add = (name: string, value: string | undefined) => {
    if (value !== undefined && VALUE.test(value)) lines.push(`  --${name}: ${value};`);
  };
  for (const [k, v] of Object.entries(t.colors)) add(`color-${k}`, v);
  for (const [k, v] of Object.entries(t.spacing)) add(`spacing-${k}`, v);
  for (const [k, v] of Object.entries(t.radius)) add(`radius-${k}`, v);
  for (const [k, v] of Object.entries(t.shadow)) add(`shadow-${k}`, v);
  for (const [k, v] of Object.entries(t.tracking)) add(`tracking-${k}`, v);
  for (const [k, v] of Object.entries(t.leading)) add(`leading-${k}`, v);
  for (const [k, v] of Object.entries(t.breakpoints)) add(`breakpoint-${k}`, v);
  for (const [k, v] of Object.entries(t.fontFamily)) add(`font-${k}`, fontStack(v));
  for (const [k, v] of Object.entries(t.fontSize)) {
    add(`text-${k}`, v.size);
    add(`text-${k}--line-height`, v.lineHeight);
    add(`text-${k}--letter-spacing`, v.letterSpacing);
    add(`text-${k}--font-weight`, v.fontWeight);
  }
  return `@theme {\n${lines.join("\n")}\n}`;
}

const firstMatch = <T>(rec: Record<string, T>, ...patterns: RegExp[]) => {
  for (const p of patterns) for (const [k, v] of Object.entries(rec)) if (p.test(k)) return v;
  return undefined;
};

/** Maps a Material-style palette (primary, surface, on-surface…) onto the builder's theme tokens. */
export function builderTheme(t: DesignTokens, dark: boolean, report: Report): ThemeTokens {
  const c = t.colors;
  const accent = c.primary ?? c["primary-container"] ?? c.accent ?? c.brand;
  const bg = c.background ?? c.surface ?? (dark ? "#121212" : "#ffffff");
  const heading = firstMatch(t.fontFamily, /^(display|headline|heading|h1|title)/i);
  const body = firstMatch(t.fontFamily, /^body|^sans|^text/i);
  const label = firstMatch(t.fontSize, /^label/i);
  const theme = normalizeTheme({
    scheme: dark ? "dark" : "light",
    accent,
    onAccent: c["on-primary"] ?? (accent ? readableOn(accent) : undefined),
    bg,
    surface: c["surface-container-low"] ?? c["surface-container"] ?? c.surface ?? bg,
    fg: c["on-surface"] ?? c["on-background"] ?? c.foreground,
    muted: c["on-surface-variant"] ?? c.muted,
    line: c["outline-variant"] ?? c.outline ?? c.border,
    fontHeading: heading ? fontStack(heading) : undefined,
    fontBody: body ? fontStack(body) : undefined,
    radius: t.radius.lg ?? t.radius.xl ?? t.radius.DEFAULT,
    buttonRadius: t.radius.DEFAULT ?? t.radius.sm,
    labelCase: "uppercase",
    labelTracking: label?.letterSpacing,
  });
  if (!accent) report.warn("No primary colour found; native blocks use the default accent.");
  for (const [pair, a, b] of [["text on background", theme.fg, theme.bg], ["muted text on background", theme.muted, theme.bg], ["button text on accent", theme.onAccent, theme.accent]] as const) {
    const ratio = contrast(a, b);
    if (ratio < 4.5) report.warn(`Low contrast for ${pair} (${ratio.toFixed(2)}:1, needs 4.5:1).`);
  }
  return theme;
}

/** Families to download from Google Fonts. */
export const fontFamilies = (t: DesignTokens) => [...new Set(Object.values(t.fontFamily).flat())];
