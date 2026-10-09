import { describe, expect, it } from "vitest";
import { THEME_PRESETS, contrast, normalizeTheme, themeFromLegacy, themeToCssVars, withAccent } from "@/lib/builder/theme";

describe("builder themes", () => {
  // Pairs the native blocks actually put together (see components/builder/blocks/shared.ts).
  const pairs = (t: (typeof THEME_PRESETS)[number]["theme"]) => ({
    "fg on bg": contrast(t.fg, t.bg),
    "fg on surface": contrast(t.fg, t.surface),
    "muted on bg": contrast(t.muted, t.bg),
    "muted on surface": contrast(t.muted, t.surface),
    "onAccent on accent": contrast(t.onAccent, t.accent),
    "accent text on bg": contrast(t.accent, t.bg),
  });

  for (const p of THEME_PRESETS) {
    it(`${p.label} meets WCAG AA for text`, () => {
      for (const [pair, ratio] of Object.entries(pairs(p.theme))) expect(ratio, `${p.id}: ${pair}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("normalizeTheme rejects values that could inject CSS", () => {
    const t = normalizeTheme({ accent: "red;}body{display:none", fontHeading: "x;background:url(https://evil)", radius: "calc(1px)" });
    expect(t.accent).toMatch(/^#[0-9a-f]{6}$/i);
    expect(t.fontHeading).not.toContain("url");
    expect(t.radius).not.toContain("calc");
    expect(Object.values(themeToCssVars(t)).join("")).not.toMatch(/[;{}]|url\(/);
  });

  it("picking a brand colour keeps button text readable", () => {
    for (const accent of ["#ffe600", "#111111", "#3b82f6", "#d4af37"]) {
      const t = withAccent(THEME_PRESETS[0]!.theme, accent);
      expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("drafts saved before themes existed keep their colour and font", () => {
    const t = themeFromLegacy({ accent: "#2f6b4f", font: "classic" });
    expect(t.accent).toBe("#2f6b4f");
    expect(t.fontHeading).toContain("Georgia");
  });
});
