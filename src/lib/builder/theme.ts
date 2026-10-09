/*
 * Design tokens for a visitor's site. Native blocks read them as CSS variables (--site-*), so one theme restyles
 * every block; imported templates ship their own tokens, which is how a native block dropped into a dark
 * template comes out dark too. Shared by the editor, the preview page and the server validator: no React.
 */

export interface ThemeTokens {
  /** Preset this theme started from, if any (shown as selected in the editor). */
  preset?: string;
  scheme: "light" | "dark";
  accent: string;
  onAccent: string;
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  line: string;
  fontHeading: string;
  fontBody: string;
  /** Cards and media. */
  radius: string;
  /** Buttons and inputs. */
  buttonRadius: string;
  labelCase: "uppercase" | "none";
  labelTracking: string;
}

const HEX = /^#[0-9a-f]{6}$/i;
/** Font stacks may only contain names, quotes, commas and spaces: no url(), no braces. */
const FONT_STACK = /^[\w\s"',.-]{1,200}$/;
const LENGTH = /^(0|\d{1,3}(\.\d{1,3})?(px|rem|em)|9999px)$/;

export const SYSTEM_SANS = "ui-sans-serif, system-ui, sans-serif";
export const SYSTEM_SERIF = "Georgia, 'Times New Roman', serif";
export const SYSTEM_ROUNDED = "ui-rounded, 'Trebuchet MS', system-ui, sans-serif";

const light = (accent: string, extra: Partial<ThemeTokens> = {}): ThemeTokens => ({
  scheme: "light",
  accent,
  onAccent: "#ffffff",
  bg: "#ffffff",
  surface: mix(accent, "#ffffff", 0.09),
  fg: "#1c1b1a",
  muted: "#57534e",
  line: "#e7e5e4",
  fontHeading: SYSTEM_SANS,
  fontBody: SYSTEM_SANS,
  radius: "1rem",
  buttonRadius: "9999px",
  labelCase: "uppercase",
  labelTracking: "0.12em",
  ...extra,
});

/** Starting points offered in the editor. Every preset passes the contrast test in tests/unit. */
type Preset = { id: string; label: string; theme: ThemeTokens };

export const THEME_PRESETS: Preset[] = ([
  { id: "terracotta", label: "Terracotta", theme: light("#b4472a") },
  { id: "forest", label: "Forest", theme: light("#2f6b4f") },
  { id: "ocean", label: "Ocean", theme: light("#1f5f99") },
  { id: "plum", label: "Plum", theme: light("#6b3a7a") },
  { id: "charcoal", label: "Charcoal", theme: light("#2b2b2b") },
  { id: "gold", label: "Gold", theme: light("#8a5d0b", { fontHeading: SYSTEM_SERIF }) },
  {
    id: "noir",
    label: "Noir (dark)",
    theme: {
      scheme: "dark",
      accent: "#d4af37",
      onAccent: "#0d0c0b",
      bg: "#0f0e0d",
      surface: "#1d1b1a",
      fg: "#f6f4f0",
      muted: "#a39e98",
      line: "#2e2824",
      fontHeading: SYSTEM_SERIF,
      fontBody: SYSTEM_SANS,
      radius: "0.5rem",
      buttonRadius: "0.25rem",
      labelCase: "uppercase",
      labelTracking: "0.15em",
    },
  },
] satisfies Preset[]).map((p) => ({ ...p, theme: { ...p.theme, preset: p.id } }));

export const DEFAULT_THEME = THEME_PRESETS[0]!.theme;

export const FONT_CHOICES = [
  { label: "Modern sans", value: SYSTEM_SANS },
  { label: "Classic serif", value: SYSTEM_SERIF },
  { label: "Friendly rounded", value: SYSTEM_ROUNDED },
] as const;

/** Mixes two hex colours; `t` is the share of `a`. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return b;
  const c = pa.map((v, i) => Math.round(v * t + pb[i]! * (1 - t)));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(h: string): [number, number, number] | null {
  if (!HEX.test(h)) return null;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = (parseHex(h) ?? [0, 0, 0]).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/**
 * Accepts anything (stored drafts, imported packages) and returns safe tokens: unknown or malformed values fall
 * back to the default theme, so a token can never smuggle CSS into the page.
 */
export function normalizeTheme(raw: unknown): ThemeTokens {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ThemeTokens, unknown>>;
  const d = DEFAULT_THEME;
  const hex = (v: unknown, f: string) => (typeof v === "string" && HEX.test(v) ? v : f);
  const font = (v: unknown, f: string) => (typeof v === "string" && FONT_STACK.test(v) ? v : f);
  const len = (v: unknown, f: string) => (typeof v === "string" && LENGTH.test(v) ? v : f);
  return {
    preset: typeof t.preset === "string" && /^[a-z0-9-]{1,40}$/.test(t.preset) ? t.preset : undefined,
    scheme: t.scheme === "dark" ? "dark" : "light",
    accent: hex(t.accent, d.accent),
    onAccent: hex(t.onAccent, d.onAccent),
    bg: hex(t.bg, d.bg),
    surface: hex(t.surface, d.surface),
    fg: hex(t.fg, d.fg),
    muted: hex(t.muted, d.muted),
    line: hex(t.line, d.line),
    fontHeading: font(t.fontHeading, d.fontHeading),
    fontBody: font(t.fontBody, d.fontBody),
    radius: len(t.radius, d.radius),
    buttonRadius: len(t.buttonRadius, d.buttonRadius),
    labelCase: t.labelCase === "none" ? "none" : "uppercase",
    labelTracking: len(t.labelTracking, d.labelTracking),
  };
}

/** Text colour for a button filled with `accent`: whichever of near-white or near-black reads better. */
export function readableOn(accent: string): string {
  return contrast(accent, "#ffffff") >= contrast(accent, "#141312") ? "#ffffff" : "#141312";
}

/** Re-derives the accent-dependent tokens after the visitor picks a new brand colour. */
export function withAccent(t: ThemeTokens, accent: string): ThemeTokens {
  if (!HEX.test(accent)) return t;
  return { ...t, preset: undefined, accent, onAccent: readableOn(accent), surface: t.scheme === "light" ? mix(accent, t.bg, 0.09) : t.surface };
}

/** Drafts saved before themes existed stored only `accent` and a font name on the page root. */
export function themeFromLegacy(root: { accent?: unknown; font?: unknown }): ThemeTokens {
  const base = typeof root.accent === "string" && HEX.test(root.accent) ? withAccent(DEFAULT_THEME, root.accent) : DEFAULT_THEME;
  const fontHeading = root.font === "classic" ? SYSTEM_SERIF : root.font === "friendly" ? SYSTEM_ROUNDED : base.fontHeading;
  const fontBody = root.font === "friendly" ? SYSTEM_ROUNDED : base.fontBody;
  return { ...base, fontHeading, fontBody };
}

/** CSS custom properties consumed by the native blocks (see components/builder/blocks/shared.ts). */
export function themeToCssVars(raw: ThemeTokens): Record<string, string> {
  const t = normalizeTheme(raw);
  return {
    "--site-accent": t.accent,
    "--site-on-accent": t.onAccent,
    "--site-bg": t.bg,
    "--site-surface": t.surface,
    "--site-tint": mix(t.accent, t.bg, 0.09),
    "--site-fg": t.fg,
    "--site-muted": t.muted,
    "--site-line": t.line,
    "--site-heading": t.fontHeading,
    "--site-body": t.fontBody,
    "--site-radius": t.radius,
    "--site-button-radius": t.buttonRadius,
    "--site-label-case": t.labelCase,
    "--site-label-tracking": t.labelTracking,
  };
}
