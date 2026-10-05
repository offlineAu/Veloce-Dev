/**
 * Colour palettes. The base tokens in globals.css ("organic") are only a fallback; the site always applies one of
 * the two palettes below, same token names, and every pairing is contrast-checked in tests/unit/contrast.test.ts.
 *
 * - periwinkle (DEFAULT): the owner's Color Hunt palette https://colorhunt.co/palette/9fa1ffb5baffaee2ffd9f9df
 *     #9FA1FF periwinkle (accent / buttons), #B5BAFF lavender, #AEE2FF sky, #D9F9DF mint.
 *   The page, text and secondary-blue tones (bg, ink, muted, line, neutrals, accent-700/800, sage-700/800, danger)
 *   are DERIVED from that family to keep text readable, and need owner sign-off.
 * - ember: dark, from https://colorhunt.co/palette/362222171010423f3e2b2b2b
 *     #171010 page, #362222 surface, #2B2B2B card, #423F3E line / chips. Text, accent and secondary tones are derived.
 *
 * A visitor's choice is kept in this browser (localStorage "veloce-theme") and applied before first paint; with no
 * choice the site default below is used. Change DEFAULT_THEME to change the default for everyone.
 */
export const periwinkleTheme = {
  "--color-bg": "#f7f7ff",
  "--color-surface": "#ffffff",
  "--color-ink": "#1b1d4d",
  "--color-muted": "#44476f",
  "--color-line": "#d6d8ff",
  "--color-neutral-100": "#eef0ff",
  "--color-neutral-200": "#e1e4ff",
  "--color-neutral-300": "#d1d5ff",
  "--color-neutral-700": "#565a85",
  "--color-accent": "#9fa1ff",
  "--color-accent-100": "#eceeff",
  "--color-accent-200": "#dcdfff",
  "--color-accent-300": "#b5baff",
  "--color-accent-600": "#9fa1ff",
  "--color-accent-hover": "#8e90f7",
  "--color-accent-700": "#4448c9",
  "--color-accent-800": "#2f3296",
  "--color-sage": "#3f87c0",
  "--color-sage-100": "#eefcf1",
  "--color-sage-200": "#d9f9df",
  "--color-sage-300": "#aee2ff",
  "--color-sage-700": "#25608f",
  "--color-sage-800": "#1a4668",
  "--color-danger": "#b3261e",
  "--color-on-accent": "#1b1d4d",
  "--color-on-sage": "#ffffff",
  "--color-on-danger": "#ffffff",
} as const;

export const emberTheme = {
  "--color-bg": "#171010",
  "--color-surface": "#362222",
  "--color-ink": "#f3eae6",
  "--color-muted": "#bdb1ab",
  "--color-line": "#423f3e",
  "--color-neutral-100": "#2b2b2b",
  "--color-neutral-200": "#423f3e",
  "--color-neutral-300": "#55504e",
  "--color-neutral-700": "#a89d97",
  "--color-accent": "#e8afa1",
  "--color-accent-100": "#4a2e2d",
  "--color-accent-200": "#5e3a38",
  "--color-accent-300": "#c98e82",
  "--color-accent-600": "#e8afa1",
  "--color-accent-hover": "#f0c3b7",
  "--color-accent-700": "#f0c3b7",
  "--color-accent-800": "#f7d9d0",
  "--color-sage": "#9c928d",
  "--color-sage-100": "#332e2d",
  "--color-sage-200": "#413a39",
  "--color-sage-300": "#a39893",
  "--color-sage-700": "#cfc4be",
  "--color-sage-800": "#e3dad5",
  "--color-danger": "#ff9f90",
  "--color-on-accent": "#171010",
  "--color-on-sage": "#171010",
  "--color-on-danger": "#171010",
} as const;

export type ThemeName = "periwinkle" | "ember";
export const THEME_NAMES: ThemeName[] = ["periwinkle", "ember"];
export const DEFAULT_THEME: ThemeName = "periwinkle";
export const THEME_STORAGE_KEY = "veloce-theme";
export const MOTION_STORAGE_KEY = "veloce-motion";

export const themeMeta: Record<ThemeName, { label: string; description: string; swatches: string[]; dark: boolean }> = {
  periwinkle: {
    label: "Periwinkle",
    description: "Light and airy. Soft blues and lavender with mint.",
    swatches: ["#9fa1ff", "#b5baff", "#aee2ff", "#d9f9df"],
    dark: false,
  },
  ember: {
    label: "Ember",
    description: "Dark and warm. Deep browns with a rose accent.",
    swatches: ["#171010", "#362222", "#423f3e", "#e8afa1"],
    dark: true,
  },
};

const vars = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `${k}:${v}`).join(";");

/** The default palette on :root, the other palettes under [data-theme]. */
export const allThemesCss = (): string =>
  `:root{color-scheme:${themeMeta[DEFAULT_THEME].dark ? "dark" : "light"};${vars(DEFAULT_THEME === "periwinkle" ? periwinkleTheme : emberTheme)}}` +
  `:root[data-theme="periwinkle"]{color-scheme:light;${vars(periwinkleTheme)}}` +
  `:root[data-theme="ember"]{color-scheme:dark;${vars(emberTheme)}}`;

/** Runs before first paint: applies a saved choice, so there is no flash of the wrong palette. */
export const themeInitScript = `try{var d=document.documentElement,t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="periwinkle"||t==="ember")d.dataset.theme=t;if(localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)})==="full")d.dataset.motion="full"}catch(e){}`;
