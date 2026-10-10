/*
 * Theme sources for compiling extra classes on demand (classes a visitor added through the Style panel or Edit HTML
 * that the template's stylesheet doesn't already have). No React, no Node.
 */
import { normalizeTheme, type ThemeTokens } from "./theme";

/** The template's own design tokens, read back from its compiled stylesheet (`--vt-color-primary: …`). */
export function themeFromCss(css: string): string {
  const vars = new Map<string, string>();
  for (const m of css.matchAll(/--vt-([a-zA-Z][\w-]*):([^;}]+)/g)) {
    const value = m[2]!.trim();
    if (!/[{}<>]|url\(/i.test(value)) vars.set(m[1]!, value);
  }
  return `@theme {\n${[...vars].map(([k, v]) => `  --${k}: ${v};`).join("\n")}\n}`;
}

/** A theme for sites without a designer template, from the builder's theme tokens. */
export function siteThemeCss(raw: ThemeTokens): string {
  const t = normalizeTheme(raw);
  const vars: [string, string][] = [
    ["color-accent", t.accent], ["color-on-accent", t.onAccent], ["color-bg", t.bg], ["color-surface", t.surface],
    ["color-fg", t.fg], ["color-muted", t.muted], ["color-line", t.line],
    ["font-heading", t.fontHeading], ["font-body", t.fontBody],
    ["radius-card", t.radius], ["radius-button", t.buttonRadius],
  ];
  return `@theme {\n${vars.map(([k, v]) => `  --${k}: ${v};`).join("\n")}\n}`;
}

/** Class names the template's stylesheet doesn't define yet. */
export const escapeClass = (c: string) => c.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
export const missingFrom = (css: string, classes: Iterable<string>) => [...new Set(classes)].filter((c) => !css.includes(`.${escapeClass(c)}`));
