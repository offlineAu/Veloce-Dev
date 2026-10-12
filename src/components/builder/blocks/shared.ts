import { kitOf, type DesignKit } from "@/lib/builder/template-kit";
import type { LoadedTemplate } from "../template-registry";

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

/**
 * "Match design" (default) or "Simple". On a site built from a designer template, matching blocks use the template's
 * own classes (its design kit) so they look like the rest of the page; Simple keeps the theme-based look above.
 */
export type Look = "design" | "simple";

/** The design kit when this block should match the template; undefined for a Simple block or a site without one. */
export function kitFor(puck: { metadata?: unknown }, look?: Look): DesignKit | undefined {
  if (look === "simple") return undefined;
  const t = (puck.metadata as { template?: LoadedTemplate } | undefined)?.template;
  return t ? kitOf(t.pkg, t.css) : undefined;
}

/**
 * Adds the Style choice to a block. It only shows on template sites, and while matching the design it hides the
 * options the design decides (background, sizes…).
 */
export function withLook<C extends { fields?: object }>(config: C, decidedByDesign: string[] = []): C {
  return {
    ...config,
    fields: {
      ...config.fields,
      look: { type: "radio", label: "Style", options: [{ label: "Match design", value: "design" }, { label: "Simple", value: "simple" }] },
    },
    resolveFields: (data: { props: { look?: Look } }, params: { fields: Record<string, unknown>; metadata: unknown }) => {
      const fields = { ...params.fields };
      if (!(params.metadata as { template?: unknown } | undefined)?.template) {
        delete fields.look;
        return fields;
      }
      if (data.props.look !== "simple") for (const k of decidedByDesign) delete fields[k];
      return fields;
    },
  };
}

/** Class strings for a block, from the design kit when matching it, otherwise from the theme. */
export function looks(k: DesignKit | undefined, tone: Tone = "light") {
  return {
    section: k ? (k.section ?? "py-16") : `${toneClass[tone]} px-6 py-16 md:py-24`,
    container: k ? (k.container ?? "mx-auto max-w-6xl px-6") : "mx-auto max-w-6xl",
    h1: k?.h1 ?? `${headingFont} text-5xl leading-[1.05] tracking-tight md:text-6xl`,
    h2: k?.h2 ?? `${headingFont} text-4xl tracking-tight`,
    h3: k?.h3 ?? "text-xl font-semibold",
    text: k?.text ?? mutedOn(tone),
    lead: k?.text ?? `text-lg leading-relaxed ${mutedOn(tone)}`,
    label: k?.label ?? `${labelClass} ${accentTextOn(tone)}`,
    card: k?.card ?? `${cardOn(tone)} p-6`,
    image: k?.image ?? `w-full object-cover ${cardRadius}`,
    button: (variant: "solid" | "outline" = "solid", on: Tone = tone) =>
      k ? ((variant === "outline" ? (k.buttonAlt ?? k.button) : k.button) ?? siteButton(on, variant)) : siteButton(on, variant),
  };
}

/** Links on a draft go nowhere while designing; only http(s), mailto, tel, anchors and site paths are kept. */
export function safeHref(href: string | undefined): string {
  if (!href) return "#";
  return /^(https?:|mailto:|tel:|#|\/)/i.test(href.trim()) ? href.trim() : "#";
}
