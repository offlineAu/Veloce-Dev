/* eslint-disable @next/next/no-img-element -- design images are package files or visitor URLs */
import { cloneElement, createElement, isValidElement, type CSSProperties, type ReactNode } from "react";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { bgImage } from "@/lib/builder/bg-image";
import { BOX_TAGS, FIELD_TAGS, INLINE_TAGS, PIECE_ATTRS, TEXT_TAGS, type TextRun } from "@/lib/builder/elements";
import type { ElementNode } from "@/lib/builder/template-package";
import { linkField, linkProps } from "../links";
import { renderNode } from "../node-tree";
import { styleField } from "../style-field";

/*
 * Design pieces: one block per element of an imported section ("Edit layout"), or added from the drawer. Each renders
 * as its own element with the design's classes, with no wrapper (Puck `inline` + slots rendered `as` the element),
 * so a section taken apart looks exactly like it did locked. Safety matches the locked renderer: allow-listed tags
 * and attributes, no event handlers, links through linkProps, inert form fields.
 */

type Attrs = Record<string, string | number | boolean>;
type Ref = ((el: Element | null) => void) | null;

const REACT_TO_HTML: Record<string, string> = { htmlFor: "for", colSpan: "colspan", rowSpan: "rowspan", maxLength: "maxlength", dateTime: "datetime" };

/** Inline style values that can't load anything or run anything. */
function safeStyle(style: unknown): CSSProperties | undefined {
  if (!style || typeof style !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(style as Record<string, unknown>)) {
    if (typeof v === "string" && /^-?-?[a-zA-Z][\w-]*$/.test(k) && !/url\(|expression\(|javascript:/i.test(v)) out[k] = v;
  }
  return Object.keys(out).length ? (out as CSSProperties) : undefined;
}

/**
 * Puck slots only take className/style/as/ref, so the other attributes (id for in-page links, role, aria-*) are set
 * through the ref, together with Puck's drag handle.
 */
function withAttrs(dragRef: Ref | undefined, attrs: Attrs | undefined, extra?: (el: HTMLElement) => void) {
  return (el: HTMLElement | null) => {
    dragRef?.(el);
    if (!el) return;
    // Marks the element as a design piece, so the editor's slot styling doesn't override its size (see PIECE_CSS).
    el.setAttribute("data-piece", "");
    for (const [k, v] of Object.entries(attrs ?? {})) {
      if (!PIECE_ATTRS.test(k)) continue;
      const name = REACT_TO_HTML[k] ?? k;
      if (v === false) el.removeAttribute(name);
      else el.setAttribute(name, v === true ? "" : String(v));
    }
    extra?.(el);
  };
}

const pick = (tag: string, allowed: Set<string>, fallback: string) => (allowed.has(tag) ? tag : fallback);

/**
 * Puck styles every slot element with width/height 100% and position: relative, outside any CSS layer, which beats
 * the design's (layered) Tailwind classes: buttons would stretch, absolute overlays would stop overlaying.
 * `revert-layer` hands those properties back to the design's classes, or the browser default.
 */
export const PIECE_CSS = "[data-piece][data-piece]{width:revert-layer;height:revert-layer;position:revert-layer}";

export type BoxProps = { tag: string; className: string; bg?: string; attrs?: Attrs; style?: Record<string, string>; items: Slot };

/** A group's style with its background photo (from an imported `background-image`) added back. */
function boxStyle(style: unknown, bg: string | undefined): CSSProperties | undefined {
  const image = bgImage(bg);
  const base = safeStyle(style);
  return image ? { ...base, backgroundImage: image } : base;
}

export const Box: ComponentConfig<BoxProps> = {
  label: "Group",
  inline: true,
  fields: {
    className: styleField(["layout", "spacing", "size", "colours", "text", "look", "visibility"]),
    bg: { type: "text", label: "Background image address", placeholder: "https://…" },
    items: { type: "slot" },
  } as unknown as ComponentConfig<BoxProps>["fields"],
  defaultProps: { tag: "div", className: "vt:flex vt:flex-col vt:gap-4 vt:p-4", items: [] },
  render: ({ tag, className, bg, attrs, style, items: Items, puck }) => (
    <Items as={pick(tag, BOX_TAGS, "div") as "div"} className={className} style={boxStyle(style, bg)} ref={withAttrs(puck.dragRef, attrs)} minEmptyHeight={48} />
  ),
};

export type DTextProps = { tag: string; className: string; text: string; runs: TextRun[]; attrs?: Attrs; style?: Record<string, string> };

function runNode(r: TextRun, i: number): ReactNode {
  if (!r.tag) return r.text;
  const tag = INLINE_TAGS.has(r.tag) ? r.tag : "span";
  return tag === "br" ? <br key={i} className={r.className} /> : createElement(tag, { key: i, className: r.className }, r.text);
}

export const DText: ComponentConfig<DTextProps> = {
  label: "Text",
  inline: true,
  fields: {
    text: { type: "textarea", label: "Text", contentEditable: true },
    runs: {
      type: "array",
      label: "Text parts",
      arrayFields: { text: { type: "text", label: "Text" } },
      getItemSummary: (r: TextRun) => (r.tag === "br" ? "Line break" : r.text || "Part"),
    },
    className: styleField(["text", "colours", "spacing", "size", "visibility"]),
  } as unknown as ComponentConfig<DTextProps>["fields"],
  // Plain text is edited in place; text with mixed styling (a highlighted word, a line break) part by part.
  resolveFields: (data, { fields }) => {
    const { text, runs, ...rest } = fields as Record<string, unknown>;
    return (data.props.runs?.length ? { ...rest, runs } : { ...rest, text }) as typeof fields;
  },
  defaultProps: { tag: "p", className: "", text: "Your text", runs: [] },
  render: ({ tag, className, text, runs, attrs, style, puck }) => {
    // Loose text (no element of its own in the design): bare text for visitors; the editor needs an element to grab.
    if (tag === "") return puck.isEditing ? <span ref={withAttrs(puck.dragRef, undefined)}>{text}</span> : <>{text}</>;
    return createElement(
      pick(tag, TEXT_TAGS, "p"),
      { className, style: safeStyle(style), ref: withAttrs(puck.dragRef, attrs) },
      ...(runs?.length ? runs.map(runNode) : [text]),
    );
  },
};

export type DImageProps = { className: string; src: string; alt: string; attrs?: Attrs; style?: Record<string, string> };

const SAFE_SRC = /^(https:\/\/|\/build\/t\/|\/builder-templates\/)/i;

export const DImage: ComponentConfig<DImageProps> = {
  label: "Image",
  inline: true,
  fields: {
    src: { type: "text", label: "Image address", placeholder: "https://…" },
    alt: { type: "text", label: "Description (for screen readers)" },
    className: styleField(["size", "look", "visibility"]),
  } as unknown as ComponentConfig<DImageProps>["fields"],
  defaultProps: { className: "vt:w-full vt:rounded-xl vt:object-cover", src: "", alt: "" },
  render: ({ className, src, alt, attrs, style, puck }) =>
    SAFE_SRC.test(src) ? (
      <img src={src} alt={alt} className={className} style={safeStyle(style)} ref={withAttrs(puck.dragRef, attrs)} />
    ) : (
      <div ref={withAttrs(puck.dragRef, undefined)} role="img" aria-label={alt || "Image placeholder"} className={`grid min-h-24 place-items-center bg-black/5 text-sm opacity-70 ${className}`}>
        Add an image address in the panel
      </div>
    ),
};

export type DLinkProps = {
  tag: string;
  className: string;
  href: string;
  /** Holds just text (edited in place) rather than pieces. Stored, because while editing `text` is an editor element. */
  textOnly?: boolean;
  text?: string;
  attrs?: Attrs;
  style?: Record<string, string>;
  items: Slot;
};

export const DLink: ComponentConfig<DLinkProps> = {
  label: "Link or button",
  inline: true,
  fields: {
    text: { type: "text", label: "Text", contentEditable: true },
    href: linkField("Link"),
    items: { type: "slot", disallow: ["DLink"] },
    className: styleField(["colours", "text", "spacing", "look", "layout", "visibility"]),
  } as unknown as ComponentConfig<DLinkProps>["fields"],
  // A text-only link is edited as text; a link holding an icon and text (or anything else) holds pieces.
  resolveFields: (data, { fields }) => {
    const { text, items, ...rest } = fields as Record<string, unknown>;
    return (data.props.textOnly ? { text, ...rest } : { ...rest, items }) as typeof fields;
  },
  defaultProps: { tag: "a", className: "vt:inline-flex vt:items-center vt:gap-2 vt:rounded-full vt:bg-black vt:px-5 vt:py-2.5 vt:text-white", href: "#", textOnly: true, text: "Button", items: [] },
  render: ({ tag, className, href, textOnly, text, attrs, style, items: Items, puck }) => {
    const link = linkProps(href, puck) as { href: string; tabIndex?: number; onClick?: (e: unknown) => void; "data-page-link"?: string };
    const isButton = tag === "button";
    const ref = withAttrs(puck.dragRef, attrs, (el) => {
      if (isButton) el.setAttribute("type", "button");
      else el.setAttribute("href", link.href);
      if (link.tabIndex !== undefined) el.setAttribute("tabindex", String(link.tabIndex));
      if (link["data-page-link"]) el.setAttribute("data-page-link", link["data-page-link"]);
      el.onclick = link.onClick ? (e) => link.onClick!(e) : null;
    });
    if (textOnly) {
      return isButton ? (
        <button type="button" className={className} style={safeStyle(style)} ref={ref}>{text}</button>
      ) : (
        <a href={link.href} tabIndex={link.tabIndex} className={className} style={safeStyle(style)} ref={ref}>{text}</a>
      );
    }
    return <Items as={isButton ? "button" : "a"} className={className} style={safeStyle(style)} minEmptyHeight={24} ref={ref} />;
  },
};

export type DIconProps = { tag: string; className: string; name: string; attrs?: Attrs; style?: Record<string, string> };

export const DIcon: ComponentConfig<DIconProps> = {
  label: "Icon",
  inline: true,
  fields: { name: { type: "text", label: "Icon name (Material Symbols)" }, className: styleField(["text", "colours", "visibility"]) } as unknown as ComponentConfig<DIconProps>["fields"],
  defaultProps: { tag: "span", className: "vt-material-symbols-outlined", name: "star" },
  render: ({ tag, className, name, attrs, style, puck }) =>
    createElement(pick(tag, INLINE_TAGS, "span"), { className, style: safeStyle(style), ref: withAttrs(puck.dragRef, { ...attrs, "aria-hidden": true }) }, /^[a-z0-9_]{1,40}$/.test(name) ? name : ""),
};

export type DFieldProps = { tag: string; className: string; attrs?: Attrs; style?: Record<string, string>; options: { value: string; label: string }[] };

export const DField: ComponentConfig<DFieldProps> = {
  label: "Form field",
  inline: true,
  fields: {} as unknown as ComponentConfig<DFieldProps>["fields"],
  defaultProps: { tag: "input", className: "", options: [] },
  render: ({ tag, className, attrs, style, options, puck }) => {
    const t = pick(tag, FIELD_TAGS, "input");
    const props: Record<string, unknown> = { className, style: safeStyle(style), readOnly: true, tabIndex: puck.isEditing ? -1 : undefined, ref: puck.dragRef };
    for (const [k, v] of Object.entries(attrs ?? {})) {
      if (!PIECE_ATTRS.test(k)) continue;
      if (k === "value") props.defaultValue = v;
      else if (k === "checked") props.defaultChecked = v;
      else props[k] = v;
    }
    // Designs show forms as a visual; the working form is built with the real site.
    return t === "select"
      ? createElement("select", props, ...(options ?? []).map((o, i) => <option key={i} value={o.value}>{o.label}</option>))
      : createElement(t, props);
  },
};

export type DRawProps = { tree: ElementNode };

/** Drawings and other elements kept whole: they move and delete like any piece, but aren't taken apart. */
export const DRaw: ComponentConfig<DRawProps> = {
  label: "Graphic",
  inline: true,
  fields: {} as unknown as ComponentConfig<DRawProps>["fields"],
  defaultProps: { tree: { t: "div" } },
  render: ({ tree, puck }) => {
    const node = renderNode(tree, { values: {}, items: {}, puck });
    return isValidElement(node) ? cloneElement(node as React.ReactElement<{ ref?: unknown }>, { ref: puck.dragRef }) : <div ref={puck.dragRef}>{node}</div>;
  },
};
