/** Semantic color tokens for Veloce's light and dark themes, applied before first paint. */
export const lightTheme = {
  "--color-bg": "#f7f6f2",
  "--color-surface": "#ffffff",
  "--color-ink": "#202725",
  "--color-muted": "#505b58",
  "--color-line": "#dedfd7",
  "--color-neutral-100": "#f3f3ef",
  "--color-neutral-200": "#e9ebe5",
  "--color-neutral-300": "#daddd5",
  "--color-neutral-700": "#505b58",
  "--color-accent": "#a8c5d0",
  "--color-accent-100": "#e7eff2",
  "--color-accent-200": "#d9e7eb",
  "--color-accent-300": "#bdd4dc",
  "--color-accent-600": "#a8c5d0",
  "--color-accent-hover": "#bdd4dc",
  "--color-accent-700": "#385d6d",
  "--color-accent-800": "#294753",
  "--color-sage": "#526a5e",
  "--color-sage-100": "#e8eee5",
  "--color-sage-200": "#dbe6da",
  "--color-sage-300": "#c5d6c5",
  "--color-sage-700": "#41594c",
  "--color-sage-800": "#30483c",
  "--color-danger": "#a1271b",
  "--color-on-accent": "#202725",
  "--color-on-sage": "#ffffff",
  "--color-on-danger": "#ffffff",
  "--color-inverse": "#171d1b",
  "--color-on-inverse": "#f7f6f2",
  "--color-chart-third": "#8b563f",
} as const;

export const darkTheme = {
  "--color-bg": "#171d1b",
  "--color-surface": "#222b27",
  "--color-ink": "#f2f4ef",
  "--color-muted": "#c1cac2",
  "--color-line": "#46534c",
  "--color-neutral-100": "#27302b",
  "--color-neutral-200": "#303b34",
  "--color-neutral-300": "#435047",
  "--color-neutral-700": "#c1cac2",
  "--color-accent": "#a8c5d0",
  "--color-accent-100": "#2e4145",
  "--color-accent-200": "#354b50",
  "--color-accent-300": "#56737a",
  "--color-accent-600": "#a8c5d0",
  "--color-accent-hover": "#c2dbe2",
  "--color-accent-700": "#bcd4dd",
  "--color-accent-800": "#d8e8ed",
  "--color-sage": "#9db8a4",
  "--color-sage-100": "#303d34",
  "--color-sage-200": "#3b4d3f",
  "--color-sage-300": "#708a76",
  "--color-sage-700": "#c2d9c5",
  "--color-sage-800": "#d8ead9",
  "--color-danger": "#ffaaa0",
  "--color-on-accent": "#171d1b",
  "--color-on-sage": "#171d1b",
  "--color-on-danger": "#171d1b",
  "--color-inverse": "#0f1513",
  "--color-on-inverse": "#f2f4ef",
  "--color-chart-third": "#e3b09a",
} as const;

// Compatibility exports for integrations that imported the earlier palette names.
export const pistachioTheme = lightTheme;
export const periwinkleTheme = lightTheme;
export const emberTheme = darkTheme;
export type ThemeName = "light" | "dark";
export const THEME_NAMES: ThemeName[] = ["light", "dark"];
export const DEFAULT_THEME: ThemeName = "light";
export const themes: Record<ThemeName, Record<string, string>> = { light: lightTheme, dark: darkTheme };
export const isThemeName = (t: unknown): t is ThemeName => typeof t === "string" && (THEME_NAMES as string[]).includes(t);
export const THEME_STORAGE_KEY = "veloce-theme";
export const MOTION_STORAGE_KEY = "veloce-motion";
export const PERF_STORAGE_KEY = "veloce-perf";
export const themeMeta: Record<ThemeName, { label: string; description: string; swatches: string[]; dark: boolean }> = {
  light: { label: "Light", description: "Warm, clear surfaces with muted blue accents.", swatches: ["#f7f6f2", "#ffffff", "#a8c5d0", "#202725"], dark: false },
  dark: { label: "Dark", description: "Quiet charcoal surfaces with soft blue accents.", swatches: ["#171d1b", "#222b27", "#a8c5d0", "#f2f4ef"], dark: true },
};

const vars = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `${k}:${v}`).join(";");

/** The default palette on :root, the other palettes under [data-theme]. */
const scheme = (t: ThemeName) => (themeMeta[t].dark ? "dark" : "light");
export const allThemesCss = (): string =>
  `:root{color-scheme:${scheme(DEFAULT_THEME)};${vars(themes[DEFAULT_THEME])}}` +
  THEME_NAMES.map((t) => `:root[data-theme="${t}"]{color-scheme:${scheme(t)};${vars(themes[t])}}`).join("");

/**
 * Runs before first paint: applies a saved choice, so there is no flash of the wrong palette, and flags low-power devices
 * (data-perf="lite": 4 GB or less memory, 2 or fewer cores, or Data Saver, or slow frames seen earlier this visit) so heavy decoration can be dropped.
 */
export const themeInitScript = `try{var d=document.documentElement,t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="ember")t="dark";else if(t==="pistachio"||t==="periwinkle")t="light";if(${JSON.stringify(THEME_NAMES)}.indexOf(t)>-1){d.dataset.theme=t;try{localStorage.setItem(${JSON.stringify(THEME_STORAGE_KEY)},t)}catch(e){}}var m=localStorage.getItem(${JSON.stringify(MOTION_STORAGE_KEY)});if(m==="full"||m==="reduced")d.dataset.motion=m}catch(e){}try{var n=navigator,c=n.connection;if((n.deviceMemory&&n.deviceMemory<=4)||(c&&c.saveData)||(n.hardwareConcurrency&&n.hardwareConcurrency<=2))document.documentElement.dataset.perf="lite"}catch(e){}try{if(sessionStorage.getItem(${JSON.stringify(PERF_STORAGE_KEY)})==="lite")document.documentElement.dataset.perf="lite"}catch(e){}`;
