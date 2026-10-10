/* eslint-disable @next/next/no-img-element -- visitor images are arbitrary external URLs */
import type { ComponentConfig } from "@puckeditor/core";
import { linkField, linkProps } from "../links";
import { alignClass, alignOptions, cardRadius, headingFont, kitFor, siteButton, withLook, type Align, type Look } from "./shared";

const headingSize = { xl: "text-5xl md:text-6xl", l: "text-4xl md:text-5xl", m: "text-3xl", s: "text-xl" } as const;

export type HeadingProps = { text: string; level: "h1" | "h2" | "h3"; size: keyof typeof headingSize; align: Align; look?: Look };

export const Heading: ComponentConfig<HeadingProps> = withLook({
  label: "Heading",
  fields: {
    text: { type: "text", label: "Text", contentEditable: true },
    level: { type: "select", label: "Level", options: [{ label: "H1 (page title)", value: "h1" }, { label: "H2", value: "h2" }, { label: "H3", value: "h3" }] },
    size: { type: "radio", label: "Size", options: [{ label: "XL", value: "xl" }, { label: "L", value: "l" }, { label: "M", value: "m" }, { label: "S", value: "s" }] },
    align: { type: "radio", label: "Align", options: [...alignOptions] },
  },
  defaultProps: { text: "A clear, confident heading", level: "h2", size: "l", align: "left" },
  render: ({ text, level: Tag, size, align, look, puck }) => {
    const k = kitFor(puck, look);
    // Matching the design: the template's own heading style for this level; the size choice is the design's.
    const style = k ? (k[Tag] ?? k.h2 ?? "") : `${headingFont} ${headingSize[size]} leading-tight tracking-tight`;
    return <Tag className={`${style} ${alignClass[align]}`}>{text}</Tag>;
  },
}, ["size"]);

export type TextProps = { text: string; size: "body" | "lead" | "small"; align: Align; look?: Look };

export const Text: ComponentConfig<TextProps> = withLook({
  label: "Text",
  fields: {
    text: { type: "textarea", label: "Text", contentEditable: true },
    size: { type: "radio", label: "Size", options: [{ label: "Lead", value: "lead" }, { label: "Body", value: "body" }, { label: "Small", value: "small" }] },
    align: { type: "radio", label: "Align", options: [...alignOptions] },
  },
  defaultProps: { text: "Write a sentence or two that tells visitors what you do and who it's for.", size: "body", align: "left" },
  render: ({ text, size, align, look, puck }) => {
    const k = kitFor(puck, look);
    const style = k ? (k.text ?? "") : `${size === "lead" ? "text-xl" : size === "small" ? "text-sm" : "text-base"} leading-relaxed`;
    return <p className={`${style} ${alignClass[align]} max-w-[65ch] whitespace-pre-line ${align === "center" ? "mx-auto" : ""}`}>{text}</p>;
  },
}, ["size"]);

export type ImageProps = { src: string; alt: string; ratio: "auto" | "16/9" | "4/3" | "1/1"; rounded: boolean; look?: Look };

export const Image: ComponentConfig<ImageProps> = withLook({
  label: "Image",
  fields: {
    src: { type: "text", label: "Image URL", placeholder: "https://…" },
    alt: { type: "text", label: "Description (for screen readers)" },
    ratio: { type: "select", label: "Shape", options: [{ label: "Original", value: "auto" }, { label: "Wide 16:9", value: "16/9" }, { label: "Classic 4:3", value: "4/3" }, { label: "Square", value: "1/1" }] },
    rounded: { type: "radio", label: "Rounded corners", options: [{ label: "Yes", value: true }, { label: "No", value: false }] },
  },
  defaultProps: { src: "", alt: "", ratio: "16/9", rounded: true },
  render: ({ src, alt, ratio, rounded, look, puck }) => {
    const k = kitFor(puck, look);
    const style = k?.image ? `w-full ${k.image}` : `w-full object-cover ${rounded ? cardRadius : ""}`;
    return /^https?:\/\//i.test(src) || src.startsWith("/build/t/") || src.startsWith("/builder-templates/") ? (
      <img src={src} alt={alt} loading="lazy" className={style} style={ratio === "auto" ? undefined : { aspectRatio: ratio }} />
    ) : (
      <div
        role="img"
        aria-label={alt || "Image placeholder"}
        className={`grid w-full place-items-center bg-(--site-surface) text-sm text-(--site-muted) ${rounded ? cardRadius : ""}`}
        style={{ aspectRatio: ratio === "auto" ? "16/9" : ratio }}
      >
        Paste an image URL in the panel
      </div>
    );
  },
}, ["rounded"]);

export type ButtonLinkProps = { label: string; href: string; variant: "solid" | "outline"; align: Align; look?: Look };

export const ButtonLink: ComponentConfig<ButtonLinkProps> = withLook({
  label: "Button",
  fields: {
    label: { type: "text", label: "Label", contentEditable: true },
    href: linkField("Link"),
    variant: { type: "radio", label: "Style", options: [{ label: "Solid", value: "solid" }, { label: "Outline", value: "outline" }] },
    align: { type: "radio", label: "Align", options: [...alignOptions] },
  },
  defaultProps: { label: "Get in touch", href: "#contact", variant: "solid", align: "left" },
  render: ({ label, href, variant, align, look, puck }) => {
    const k = kitFor(puck, look);
    // Matching the design: the template's main button, or its second button for the outline style.
    const style = (k && (variant === "outline" ? (k.buttonAlt ?? k.button) : k.button)) || siteButton("light", variant);
    return (
      <div className={`flex ${align === "center" ? "justify-center" : ""}`}>
        <a {...linkProps(href, puck)} className={style}>{label}</a>
      </div>
    );
  },
});

export type ListProps = { style: "check" | "bullet" | "number"; items: { text: string }[]; look?: Look };

export const List: ComponentConfig<ListProps> = withLook({
  label: "List",
  fields: {
    style: { type: "radio", label: "Style", options: [{ label: "Ticks", value: "check" }, { label: "Bullets", value: "bullet" }, { label: "Numbers", value: "number" }] },
    items: { type: "array", label: "Items", arrayFields: { text: { type: "text", label: "Text" } }, defaultItemProps: { text: "Another point" }, getItemSummary: (i) => i.text || "Item" },
  },
  defaultProps: { style: "check", items: [{ text: "Fast to load on any phone" }, { text: "Easy to update yourself" }, { text: "Built to be found on Google" }] },
  render: ({ style, items, look, puck }) => {
    const Tag = style === "number" ? "ol" : "ul";
    const k = kitFor(puck, look);
    return (
      <Tag className={`flex flex-col gap-2 ${k?.text ?? ""} ${style === "number" ? "list-decimal pl-6" : style === "bullet" ? "list-disc pl-6" : ""}`}>
        {items.map((it, i) => (
          <li key={i} className={style === "check" ? "flex gap-3" : ""}>
            {style === "check" ? <span aria-hidden className="font-bold text-(--site-accent)">✓</span> : null}
            <span>{it.text}</span>
          </li>
        ))}
      </Tag>
    );
  },
});
