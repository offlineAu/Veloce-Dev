import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emberTheme, periwinkleTheme, pistachioTheme } from "../../src/lib/themes";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const parse = (name: string, source: string) => {
  // Later declarations win, so the theme override (appended after globals.css) takes precedence.
  const all = [...source.matchAll(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`, "g"))];
  const last = all[all.length - 1];
  if (!last) throw new Error(`token ${name} not found`);
  return last[1]!;
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const toVars = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `${k}:${v}`).join(";");

// [foreground, background, minimum ratio, where it is used]
const common: [string, string, number, string][] = [
  ["ink", "bg", 4.5, "body text"],
  ["muted", "bg", 4.5, "secondary copy on page"],
  ["muted", "surface", 4.5, "secondary copy on cards"],
  ["muted", "neutral-100", 4.5, "copy on feature cards / bento / header"],
  ["muted", "neutral-200", 4.5, "copy on chips and template card"],
  ["muted", "accent-100", 4.5, "offer card copy"],
  ["muted", "sage-100", 4.5, "cta copy"],
  ["on-accent", "accent-600", 4.5, "primary button"],
  ["on-sage", "sage-700", 4.5, "avatar initials, active chips"],
  ["on-accent", "accent-hover", 4.5, "primary button on hover"],
  ["on-danger", "danger", 4.5, "destructive button text"],
  ["on-sage", "sage", 3, "check icon on sage (graphic)"],
  ["accent-700", "surface", 4.5, "labels on cards"],
  ["accent-800", "surface", 4.5, "offer title on cards"],
  ["sage-700", "surface", 4.5, "label on the custom card"],
  ["accent-700", "neutral-200", 4.5, "active nav link on chips"],
  ["danger", "neutral-100", 4.5, "error text in the dialog form"],
  ["accent-700", "bg", 4.5, "eyebrow / links"],
  ["accent-700", "neutral-100", 4.5, "links on cards"],
  ["accent-700", "accent-100", 4.5, "icon on tint"],
  ["accent-800", "accent-100", 4.5, "chips"],
  ["sage-700", "bg", 4.5, "sage eyebrow / status"],
  ["sage-800", "sage-100", 4.5, "cta lead"],
  ["sage-800", "sage-200", 4.5, "icon on tint"],
  ["sage-800", "neutral-200", 4.5, "process step 4"],
  ["accent-800", "accent-200", 4.5, "process step 3"],
  ["sage-700", "sage-100", 4.5, "icon on tint"],
  ["neutral-700", "bg", 4.5, "hints"],
  ["neutral-700", "surface", 4.5, "hints on cards"],
  ["neutral-700", "neutral-100", 4.5, "placeholder text in inputs"],
  ["ink", "surface", 4.5, "text on cards"],
  ["ink", "neutral-100", 4.5, "text on inputs and cards"],
  ["danger", "bg", 4.5, "error text"],
  ["on-accent", "accent", 3, "text on accent fill (large/bold only)"],
  ["on-inverse", "inverse", 4.5, "copy on dark panels (hero, closing CTA, footer)"],
  ["accent", "inverse", 4.5, "accent text and eyebrows on dark panels"],
];
// Pairs that only exist on the dark Ember surfaces (cards and code blocks drawn on `surface`).
const emberOnly: [string, string, number, string][] = [];

const themes: [string, string, [string, string, number, string][]][] = [
  ["pistachio (default)", `${css};${toVars(pistachioTheme)}`, common],
  ["periwinkle (option)", `${css};${toVars(periwinkleTheme)}`, common],
  ["ember (option)", `${css};${toVars(emberTheme)}`, [...common, ...emberOnly]],
];

describe.each(themes)("design token contrast (WCAG AA): %s", (_name, source, pairs) => {
  it.each(pairs)("%s on %s >= %s (%s)", (fg, bg, min) => {
    expect(ratio(parse(fg, source), parse(bg, source))).toBeGreaterThanOrEqual(min);
  });
});

it("sanity: white on white", () => expect(ratio("#ffffff", "#ffffff")).toBeCloseTo(1));
