/*
 * Styling shared by the builder's blocks. A visitor's page is not the Veloce site, so blocks never use the site's
 * own palette: every colour, font and radius comes from the page theme as --site-* variables (lib/builder/theme.ts),
 * so the same block looks right on a light template and on a dark imported one.
 */

/** Stored values kept from the first version for old drafts; the labels describe what they mean in any theme. */
export type Tone = "light" | "tinted" | "dark" | "accent";
export type Align = "left" | "center";

export const toneClass: Record<Tone, string> = {
  light: "bg-(--site-bg) text-(--site-fg)",
  tinted: "bg-(--site-surface) text-(--site-fg)",
  dark: "bg-(--site-fg) text-(--site-bg)",
  accent: "bg-(--site-accent) text-(--site-on-accent)",
};

export const toneOptions = [
  { label: "Page", value: "light" },
  { label: "Raised", value: "tinted" },
  { label: "Contrast", value: "dark" },
  { label: "Accent", value: "accent" },
] as const;

export const alignOptions = [
  { label: "Left", value: "left" },
  { label: "Centre", value: "center" },
] as const;

export const alignClass: Record<Align, string> = { left: "text-left items-start", center: "text-center items-center" };

export const headingFont = "font-[family-name:var(--site-heading)]";

/** Small label above headings ("NEW IN TOWN"), styled by the theme's label case and tracking. */
export const labelClass = "text-sm font-semibold [text-transform:var(--site-label-case)] [letter-spacing:var(--site-label-tracking)]";

export const cardRadius = "rounded-(--site-radius)";

const inverted = (tone: Tone) => tone === "dark" || tone === "accent";

/** A muted text colour that stays readable on every tone. */
export const mutedOn = (tone: Tone) =>
  tone === "dark" ? "text-(--site-bg)/75" : tone === "accent" ? "text-(--site-on-accent)/80" : "text-(--site-muted)";

/** Accent-coloured text, except where the background is itself the accent or the contrast colour. */
export const accentTextOn = (tone: Tone) => (inverted(tone) ? "opacity-80" : "text-(--site-accent)");

/** A card sitting on a section of the given tone. */
export const cardOn = (tone: Tone) =>
  `${cardRadius} ${tone === "tinted" ? "bg-(--site-bg)" : tone === "light" ? "bg-(--site-surface)" : "bg-current/10"}`;

/** Primary button style for the visitor's page; inverts on coloured backgrounds. */
export const siteButton = (tone: Tone = "light", variant: "solid" | "outline" = "solid") => {
  const base = "inline-flex min-h-11 items-center justify-center rounded-(--site-button-radius) px-6 font-semibold";
  if (variant === "outline") {
    return `${base} border-2 ${inverted(tone) ? "border-current" : "border-(--site-accent) text-(--site-accent)"}`;
  }
  if (tone === "dark") return `${base} bg-(--site-bg) text-(--site-fg)`;
  if (tone === "accent") return `${base} bg-(--site-on-accent) text-(--site-accent)`;
  return `${base} bg-(--site-accent) text-(--site-on-accent)`;
};

/** Links on a draft go nowhere while designing; only http(s), mailto, tel, anchors and site paths are kept. */
export function safeHref(href: string | undefined): string {
  if (!href) return "#";
  return /^(https?:|mailto:|tel:|#|\/)/i.test(href.trim()) ? href.trim() : "#";
}
