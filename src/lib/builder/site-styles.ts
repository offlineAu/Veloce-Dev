/*
 * A site's design system, beside its theme (theme.ts):
 *
 *   tokens  the template's own variables changed for this site: colours (--vt-color-*), fonts (--vt-font-*) and
 *           text sizes (--vt-text-*), e.g. { "--vt-color-primary": "#c2410c" }
 *   colors  named colour styles ("Brand", "Ink"): CSS variables --vs-<id>, used by pieces as classes such as
 *           `bg-(--vs-brand)`, so changing a colour changes it everywhere
 *   text    named text styles ("Heading 1", "Caption"): a set of text classes a piece points at with `textStyle`
 *
 * Fonts are web fonts from a fixed list, served from this site (/api/builder/fonts), never from Google directly.
 * Everything is checked here, so stored or submitted styles can never carry CSS of their own. No React, no DOM.
 */

export interface ColorStyle {
  id: string;
  name: string;
  value: string;
}
export interface TextStyle {
  id: string;
  name: string;
  /** `vt:`-prefixed text classes: size, weight, font, line and letter spacing, case, colour (per device). */
  className: string;
}
export interface SiteStyles {
  tokens?: Record<string, string>;
  colors?: ColorStyle[];
  text?: TextStyle[];
}

/** Web fonts visitors can choose: served through this site, in the weights listed. */
export const WEB_FONTS: { family: string; kind: "sans" | "serif" | "display" | "mono"; weights: number[] }[] = [
  { family: "Inter", kind: "sans", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Manrope", kind: "sans", weights: [300, 400, 500, 600, 700, 800] },
  { family: "DM Sans", kind: "sans", weights: [300, 400, 500, 600, 700] },
  { family: "Plus Jakarta Sans", kind: "sans", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Space Grotesk", kind: "sans", weights: [300, 400, 500, 600, 700] },
  { family: "Outfit", kind: "sans", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Poppins", kind: "sans", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Montserrat", kind: "sans", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Work Sans", kind: "sans", weights: [300, 400, 500, 600, 700] },
  { family: "Archivo", kind: "sans", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Playfair Display", kind: "serif", weights: [400, 500, 600, 700, 800] },
  { family: "Cormorant Garamond", kind: "serif", weights: [300, 400, 500, 600, 700] },
  { family: "Libre Baskerville", kind: "serif", weights: [400, 700] },
  { family: "Lora", kind: "serif", weights: [400, 500, 600, 700] },
  { family: "Fraunces", kind: "serif", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Newsreader", kind: "serif", weights: [300, 400, 500, 600, 700] },
  { family: "DM Serif Display", kind: "display", weights: [400] },
  { family: "Instrument Serif", kind: "display", weights: [400] },
  { family: "Bebas Neue", kind: "display", weights: [400] },
  { family: "JetBrains Mono", kind: "mono", weights: [400, 500, 700] },
];
const FALLBACK: Record<(typeof WEB_FONTS)[number]["kind"], string> = { sans: "system-ui, sans-serif", serif: "Georgia, serif", display: "Georgia, serif", mono: "ui-monospace, monospace" };
export const findWebFont = (family: string) => WEB_FONTS.find((f) => f.family === family);
/** The CSS stack for a web font: the family, then a system font of the same kind while it loads. */
export const fontStack = (family: string) => {
  const f = findWebFont(family);
  return f ? `'${f.family}', ${FALLBACK[f.kind]}` : undefined;
};
/** The web font a stack starts with, if any. */
export const webFontOf = (stack: string | undefined) => WEB_FONTS.find((f) => stack?.trim().replace(/^['"]/, "").startsWith(f.family))?.family;

const TOKEN_KEY = /^--vt-(color|font|text)-[a-zA-Z0-9][\w-]{0,60}$/;
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}(\s*,\s*\d{1,3}){2}(\s*,\s*(0|1|0?\.\d+))?\s*\)|oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(\s*\/\s*[\d.]+%?)?\s*\))$/i;
const SIZE = /^\d{1,3}(\.\d{1,3})?(px|rem)$/;
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const CLASS_TOKEN = /^[\w:/[\]().%#,!'"&>*+~=@-]{1,200}$/;
export const MAX_STYLES = 40;

/** A valid token value for its key, or undefined. Fonts are stored as a web font's family name. */
function tokenValue(key: string, v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  if (key.startsWith("--vt-color-")) return COLOR.test(v.trim()) ? v.trim() : undefined;
  if (key.startsWith("--vt-font-")) return findWebFont(v) ? v : undefined;
  return SIZE.test(v.trim()) ? v.trim() : undefined;
}

const named = <T extends { id: string; name: string }>(list: unknown, check: (x: Record<string, unknown>) => T | undefined): T[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || !ID.test(r.id) || seen.has(r.id) || typeof r.name !== "string" || !r.name.trim()) return [];
    const ok = check(r);
    if (!ok) return [];
    seen.add(r.id);
    return [ok];
  }).slice(0, MAX_STYLES);
};

/** Anything stored or submitted, made safe; undefined when there's nothing to keep. */
export function normalizeStyles(raw: unknown): SiteStyles | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const tokens: Record<string, string> = {};
  if (r.tokens && typeof r.tokens === "object") {
    for (const [k, v] of Object.entries(r.tokens as Record<string, unknown>).slice(0, 200)) {
      const value = TOKEN_KEY.test(k) ? tokenValue(k, v) : undefined;
      if (value) tokens[k] = value;
    }
  }
  const colors = named<ColorStyle>(r.colors, (x) => (typeof x.value === "string" && COLOR.test(x.value.trim()) ? { id: x.id as string, name: (x.name as string).slice(0, 40), value: x.value.trim() } : undefined));
  const text = named<TextStyle>(r.text, (x) => {
    if (typeof x.className !== "string" || x.className.length > 2000) return undefined;
    const classes = x.className.split(/\s+/).filter(Boolean);
    if (classes.length > 60 || !classes.every((c) => CLASS_TOKEN.test(c))) return undefined;
    return { id: x.id as string, name: (x.name as string).slice(0, 40), className: classes.join(" ") };
  });
  const out: SiteStyles = {};
  if (Object.keys(tokens).length) out.tokens = tokens;
  if (colors.length) out.colors = colors;
  if (text.length) out.text = text;
  return Object.keys(out).length ? out : undefined;
}

/** The class a piece uses for a colour style (background, text or border). */
export const colorVar = (id: string) => `(--vs-${id})`;

/**
 * The CSS for a site's styles, scoped to its design ([data-vt=<scope>]): token overrides and colour styles.
 * Values are re-checked, so this is safe to put in a <style> element.
 */
export function stylesCss(raw: SiteStyles | undefined, scope: string): string {
  const s = normalizeStyles(raw);
  if (!s || !/^[a-z0-9-]{1,40}$/.test(scope)) return "";
  const decls: string[] = [];
  for (const [k, v] of Object.entries(s.tokens ?? {})) decls.push(`${k}:${k.startsWith("--vt-font-") ? fontStack(v) : v}`);
  for (const c of s.colors ?? []) decls.push(`--vs-${c.id}:${c.value}`);
  return decls.length ? `[data-vt="${scope}"]{${decls.join(";")}}` : "";
}

/** The web fonts a site uses (token overrides and theme fonts), to load them. */
export function webFontsUsed(styles: SiteStyles | undefined, themeFonts: (string | undefined)[] = []): string[] {
  const s = normalizeStyles(styles);
  const fams = new Set<string>();
  for (const [k, v] of Object.entries(s?.tokens ?? {})) if (k.startsWith("--vt-font-") && findWebFont(v)) fams.add(v);
  for (const f of themeFonts) {
    const w = webFontOf(f);
    if (w) fams.add(w);
  }
  return [...fams].sort();
}

/** Where a page loads a web font from (this site's font route; see app/api/builder/fonts). */
export const fontHref = (family: string) => `/api/builder/fonts?family=${encodeURIComponent(family)}`;

/** The classes a text style adds to a piece, or "" when the style is gone. */
export const textStyleClasses = (styles: SiteStyles | undefined, id: unknown) => (typeof id === "string" ? (styles?.text?.find((t) => t.id === id)?.className ?? "") : "");

/** Every class a site's text styles use, for compiling the ones its design lacks. */
export const styleClassList = (styles: SiteStyles | undefined) => (styles?.text ?? []).flatMap((t) => t.className.split(/\s+/).filter(Boolean));

/** A short id for a new style from its name ("Heading 1" → "heading-1"), unique among `taken`. */
export function styleId(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "style";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}
