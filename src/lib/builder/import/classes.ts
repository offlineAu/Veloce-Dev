/*
 * Step 3a: class names. Every class in an imported design is rewritten to the template prefix ("vt:"), so its
 * utilities compile on their own and never collide with the site's classes (the editor canvas loads both).
 * Exports from Stitch target Tailwind v3; the few utilities v4 renamed are translated here.
 */
import { CLASS_PREFIX } from "../template-package";

/** v3 name → v4 name for utilities whose meaning stayed the same. */
const RENAMES: Record<string, string> = {
  "shadow-sm": "shadow-xs",
  shadow: "shadow-sm",
  "drop-shadow-sm": "drop-shadow-xs",
  "drop-shadow": "drop-shadow-sm",
  "blur-sm": "blur-xs",
  blur: "blur-sm",
  "backdrop-blur-sm": "backdrop-blur-xs",
  "backdrop-blur": "backdrop-blur-sm",
  "outline-none": "outline-hidden",
  ring: "ring-3",
  "flex-shrink-0": "shrink-0",
  "flex-shrink": "shrink",
  "flex-grow-0": "grow-0",
  "flex-grow": "grow",
  "overflow-ellipsis": "text-ellipsis",
  "decoration-slice": "box-decoration-slice",
  "decoration-clone": "box-decoration-clone",
};

/** Splits "md:hover:bg-[url(a:b)]" on the colons that separate variants, not those inside brackets. */
function splitVariants(token: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of token) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    if (ch === ":" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

export interface ClassContext {
  /** Non-utility class names the template defines itself (e.g. the icon font's class): kept, but namespaced. */
  custom: Set<string>;
  /** Radius tokens the design defines, so v3's bare `rounded` keeps its meaning. */
  radiusDefault: boolean;
}

/** v3's `rounded` / `rounded-t` used the theme's DEFAULT radius; v4 has no bare `rounded` default. */
function radius(utility: string, ctx: ClassContext): string {
  const m = utility.match(/^rounded(-(t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee))?$/);
  if (!m) return utility;
  return ctx.radiusDefault ? `${utility}-DEFAULT` : `${utility}-sm`;
}

export const customClassName = (name: string) => `vt-${name}`;

/** One class token → its prefixed v4 form. */
export function rewriteClass(token: string, ctx: ClassContext): string {
  if (ctx.custom.has(token)) return customClassName(token);
  const parts = splitVariants(token);
  let utility = parts.pop()!;
  let important = false;
  if (utility.startsWith("!")) {
    important = true;
    utility = utility.slice(1);
  }
  const negative = utility.startsWith("-") ? "-" : "";
  const base = negative ? utility.slice(1) : utility;
  utility = negative + radius(RENAMES[base] ?? base, ctx);
  return `${CLASS_PREFIX}${[...parts, utility].join(":")}${important ? "!" : ""}`;
}

export const rewriteClassList = (value: string, ctx: ClassContext) =>
  value.split(/\s+/).filter(Boolean).map((t) => rewriteClass(t, ctx)).join(" ");

/** How Tailwind escapes a class in a selector, to check that a class produced CSS. */
export const escapeClass = (cls: string) => cls.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
