/* eslint-disable @next/next/no-img-element -- design images are package files or visitor URLs */
import { cloneElement, createContext, createElement, isValidElement, useContext, type CSSProperties, type ReactNode } from "react";
import { textStyleClasses, type SiteStyles } from "@/lib/builder/site-styles";
import { bindProps, PLAIN_PARAGRAPHS, type Collection, type CollectionItem } from "@/lib/builder/content";
import { BEHAVIOUR_ATTR, parseBehaviour } from "@/lib/builder/behaviours";
import { effectText, textEffectOf } from "../text-effects";
import type { ComponentConfig, Slot } from "@puckeditor/core";
import { bgImage } from "@/lib/builder/bg-image";
import { BOX_TAGS, FIELD_TAGS, INLINE_TAGS, PIECE_ATTRS, TEXT_TAGS, type TextRun } from "@/lib/builder/elements";
import type { ElementNode } from "@/lib/builder/template-package";
import { linkField, linkProps } from "../links";
import { imageField } from "../media-tools";
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
      // Interactions only with values the runtime understands.
      if (BEHAVIOUR_ATTR.test(k) && parseBehaviour(k, v) === null) continue;
      const name = REACT_TO_HTML[k] ?? k;
      if (v === false) el.removeAttribute(name);
      else el.setAttribute(name, v === true ? "" : String(v));
    }
    extra?.(el);
  };
}

/** A key that changes with an element's attributes (see Box, DLink). */
const attrsKey = (attrs: Attrs | undefined) => (attrs && Object.keys(attrs).length ? JSON.stringify(attrs) : "");

const pick = (tag: string, allowed: Set<string>, fallback: string) => (allowed.has(tag) ? tag : fallback);

/**
 * Puck styles every slot element with width/height 100% and position: relative, outside any CSS layer, which beats
 * the design's (layered) Tailwind classes: buttons would stretch, absolute overlays would stop overlaying.
 * `revert-layer` hands those properties back to the design's classes, or the browser default. Puck also writes
 * `position: relative` inline on every draggable element, so position needs `!important` to get past that: decorative
 * glows and overlays (absolute) and fixed headers then sit where the design puts them instead of pushing content down.
 */
export const PIECE_CSS =
  "[data-piece][data-piece]{width:revert-layer;height:revert-layer;position:revert-layer!important}" +
  // A group's own minimum height (a free layout's, which holds its placed items) beats the slot's min-height: 0.
  "[data-piece][data-piece]:not(:empty){min-height:revert-layer}" +
  // Empty layers the design positions over or behind content (glows, gradient overlays) are decoration, not places to
  // drop things: Puck's empty-slot tint, outline and minimum height would hide their gradient and wash over the section.
  "[data-piece][data-piece]:is(.vt\\:absolute,.vt\\:fixed):empty{background:revert-layer!important;outline:revert-layer!important;min-height:revert-layer!important}" +
  // The same for empty parts a hand-written design styles itself (a button's dot, a divider line, a colour swatch's
  // empty span): they're drawn by the design's CSS, not drop zones.
  "[data-piece][data-piece]:is([class*=' vt-'],span):empty{background:revert-layer!important;outline:revert-layer!important;min-height:revert-layer!important}" +
  // Decorative layers (glows, overlays) often sit on top of the content: clicks go through them to the content.
  "[data-piece][data-decor]{pointer-events:none!important}" +
  // Hidden layers stay in the editor, faded, so they can be shown again (the sent design leaves them out).
  "[data-piece].veloce-layer-hidden{opacity:.3!important;outline:1px dashed currentColor;outline-offset:-1px}" +
  // Components: the main one and its copies get a violet outline in the editor (Figma's colour for components).
  "[data-piece]:is(.veloce-component-main,.veloce-component-copy){outline:1px dashed #8b5cf6;outline-offset:-1px}" +
  "[data-piece].veloce-component-main{outline-style:solid}" +
  // Rich text: the CSS reset takes away list bullets, link underlines and heading sizes; they're given back here,
  // with low specificity (:where) so the piece's own classes still win.
  ".veloce-rich :where(p,ul,ol,blockquote,h2,h3,h4)+:where(p,ul,ol,blockquote,h2,h3,h4){margin-top:1em}" +
  ".veloce-rich :where(ul){list-style:disc;padding-left:1.5em}.veloce-rich :where(ol){list-style:decimal;padding-left:1.5em}" +
  ".veloce-rich :where(a){text-decoration:underline;text-underline-offset:2px}" +
  ".veloce-rich :where(blockquote){border-left:3px solid currentColor;padding-left:1em;opacity:.85}" +
  ".veloce-rich :where(h2){font-size:1.5em;font-weight:700;line-height:1.25}.veloce-rich :where(h3){font-size:1.25em;font-weight:700}.veloce-rich :where(h4){font-weight:700}" +
  ".veloce-rich :where(.rich-text)>*+*{margin-top:1em}";

/**
 * Layer flags every design piece has: a name, hidden (left out of the design), locked (can't move or go), a text
 * style it follows, and its part in a reusable component (the main one, or a copy that follows it).
 */
export type LayerFlags = { name?: string; hidden?: boolean; locked?: boolean; textStyle?: string; component?: { id: string; main?: boolean } };

/** The site's styles, from the page root (config.tsx), for pieces that follow a text style. */
export const SiteStylesContext = createContext<SiteStyles | undefined>(undefined);

/** On a collection's item page (config.tsx): the item shown, for pieces showing its fields. Lists reset it. */
export type ItemOnPage = { c: Collection; item: CollectionItem; pageId?: string };
export const ItemContext = createContext<ItemOnPage | null>(null);

type LoosePiece = {
  render: (props: { className?: string; puck: { isEditing: boolean; dragRef: ((el: Element | null) => void) | null } } & LayerFlags) => ReactNode;
  resolvePermissions?: unknown;
};

/** Renders a piece with its layer flags applied (a component, so it can read the site's styles). */
function LayerPiece({ c, props: given }: { c: LoosePiece; props: Parameters<LoosePiece["render"]>[0] }) {
  const styles = useContext(SiteStylesContext);
  const onPage = useContext(ItemContext);
  // Showing a field of the page's item (the editor; the preview fills them in on the server, content.ts bindPage).
  const props = onPage && (given as { bind?: unknown }).bind ? (bindProps({ type: "", props: given as never }, onPage.c, onPage.item, onPage.pageId).props as typeof given) : given;
  const { hidden, puck, textStyle, component } = props;
  if (hidden && !puck.isEditing) return null;
  // A text style's classes come first; the piece's own (layout, colours it was given) follow. In the editor, marker
  // classes (never stored) show hidden layers and components: groups keep the element they mounted with, so
  // attributes set through the ref wouldn't follow later changes.
  const markers = puck.isEditing ? [hidden ? "veloce-layer-hidden" : "", component ? (component.main ? "veloce-component-main" : "veloce-component-copy") : ""] : [];
  const styled = [textStyle ? textStyleClasses(styles, textStyle) : "", props.className ?? "", ...markers].filter(Boolean).join(" ");
  const out = <>{c.render({ ...props, className: styled })}</>;
  // A list's cards show their own items, never the page's.
  return onPage && (props as { list?: unknown }).list ? <ItemContext.Provider value={null}>{out}</ItemContext.Provider> : out;
}

/**
 * Adds the layer flags to a piece: hidden pieces render nothing outside the editor and fade inside it; locked ones
 * can't be dragged or deleted (the free canvas doesn't move them either); a text style's classes are applied.
 */
export function withLayerFlags<T>(config: T): T {
  const c = config as unknown as LoosePiece;
  return {
    ...c,
    resolvePermissions: (data: { props: LayerFlags & { listCopy?: boolean } }, { permissions }: { permissions: Record<string, boolean> }) =>
      // Locked pieces stay put; a list's copies follow its first card (edit that one instead).
      data.props.listCopy ? { ...permissions, drag: false, delete: false, duplicate: false, edit: false, insert: false } : data.props.locked ? { ...permissions, drag: false, delete: false } : permissions,
    render: (props: Parameters<LoosePiece["render"]>[0]) => <LayerPiece c={c} props={props} />,
  } as unknown as T;
}

export type BoxProps = {
  tag: string;
  className: string;
  bg?: string;
  /** An empty layer the design positions over or behind content (a glow, an overlay): decoration, not a drop target. */
  decor?: boolean;
  /** A free layout (free-layout.ts): its items are placed by position and size, from tablets up. */
  free?: boolean;
  attrs?: Attrs;
  style?: Record<string, string>;
  items: Slot;
};

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
    className: styleField(["layout", "spacing", "size", "colours", "text", "look", "position", "visibility"]),
    bg: imageField("Background image"),
    items: { type: "slot" },
  } as unknown as ComponentConfig<BoxProps>["fields"],
  defaultProps: { tag: "div", className: "vt:flex vt:flex-col vt:gap-4 vt:p-4", items: [] },
  render: ({ tag, className, bg, decor, attrs, style, items: Items, puck }) => {
    const as = pick(tag, BOX_TAGS, "div");
    // An empty layer the design positions over or behind content (a glow, an overlay) is decoration: a plain element
    // (still selectable, movable and deletable), not a drop zone that would catch drops meant for the content below.
    // It also lets clicks through to what's under it (select it from the Outline panel instead).
    if (decor) return createElement(as, { className, style: boxStyle(style, bg), ref: withAttrs(puck.dragRef, attrs, (el) => el.setAttribute("data-decor", "")) });
    // Puck doesn't call a slot's ref again when it re-renders, so attributes set through it (an id, an interaction)
    // only apply when the element is drawn: a new key redraws it when they change.
    return <Items key={attrsKey(attrs)} as={as as "div"} className={className} style={boxStyle(style, bg)} ref={withAttrs(puck.dragRef, attrs)} minEmptyHeight={48} />;
  },
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
    className: styleField(["text", "colours", "spacing", "size", "look", "position", "visibility"]),
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
    // Words that slide in, letters that roll or flip: drawn as spans (not while the text is being typed on the canvas).
    const effect = typeof text === "string" && !runs?.length ? textEffectOf(attrs) : undefined;
    return createElement(
      pick(tag, TEXT_TAGS, "p"),
      { className, style: safeStyle(style), ref: withAttrs(puck.dragRef, attrs), "aria-label": effect && effect !== "split" ? text : undefined },
      ...(runs?.length ? runs.map(runNode) : effect ? effectText(effect, text) : [text]),
    );
  },
};

export type DImageProps = { className: string; src: string; alt: string; attrs?: Attrs; style?: Record<string, string> };

const SAFE_SRC = /^(https:\/\/|\/build\/t\/|\/builder-templates\/|\/api\/builder\/media\/)/i;

export const DImage: ComponentConfig<DImageProps> = {
  label: "Image",
  inline: true,
  fields: {
    src: imageField("Image"),
    alt: { type: "text", label: "Description (for screen readers)" },
    className: styleField(["size", "look", "spacing", "position", "visibility"]),
  } as unknown as ComponentConfig<DImageProps>["fields"],
  defaultProps: { className: "vt:w-full vt:rounded-xl vt:object-cover", src: "", alt: "" },
  // An image without a picture (a design's mini-cart thumbnail its script filled in) stays an empty <img>, laid out
  // as the design has it, like a locked section shows it; while editing it gets an outline so it can be found.
  render: ({ className, src, alt, attrs, style, puck }) =>
    SAFE_SRC.test(src) ? (
      <img src={src} alt={alt} className={className} style={safeStyle(style)} ref={withAttrs(puck.dragRef, attrs)} />
    ) : (
      <img
        alt={alt}
        title={puck.isEditing ? "Add a picture in the panel" : undefined}
        className={className}
        style={{ ...safeStyle(style), ...(puck.isEditing ? { outline: "1px dashed rgb(0 0 0 / 0.35)", outlineOffset: -1 } : {}) }}
        ref={withAttrs(puck.dragRef, attrs)}
      />
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
    className: styleField(["colours", "text", "spacing", "look", "layout", "position", "visibility"]),
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
    // A design's submit button submits outside the editor, in a form the form behaviour runs (it checks the fields
    // and shows the thank-you message; nothing is sent). Anywhere else it's a plain button.
    const submits = isButton && attrs?.type === "submit" && !puck.isEditing;
    const ref = withAttrs(puck.dragRef, attrs, (el) => {
      if (isButton) el.setAttribute("type", submits && el.closest("form[data-vt-form]") ? "submit" : "button");
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
    return <Items key={`${attrsKey(attrs)}|${link.href}`} as={isButton ? "button" : "a"} className={className} style={safeStyle(style)} minEmptyHeight={24} ref={ref} />;
  },
};

export type DIconProps = { tag: string; className: string; name: string; attrs?: Attrs; style?: Record<string, string> };

export const DIcon: ComponentConfig<DIconProps> = {
  label: "Icon",
  inline: true,
  fields: { name: { type: "text", label: "Icon name (Material Symbols)" }, className: styleField(["text", "colours", "spacing", "position", "visibility"]) } as unknown as ComponentConfig<DIconProps>["fields"],
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
    // Fill-in-able in preview (to try the design's form, which never sends anything); not while editing.
    const props: Record<string, unknown> = { className, style: safeStyle(style), readOnly: puck.isEditing, tabIndex: puck.isEditing ? -1 : undefined, ref: puck.dragRef };
    for (const [k, v] of Object.entries(attrs ?? {})) {
      if (!PIECE_ATTRS.test(k)) continue;
      if (k === "value") props.defaultValue = v;
      else if (k === "checked") props.defaultChecked = v;
      else props[k] = v;
    }
    // The working form is built with the real site; in a design it checks its fields and thanks (behaviours.tsx).
    return t === "select"
      ? createElement("select", props, ...(options ?? []).map((o, i) => <option key={i} value={o.value}>{o.label}</option>))
      : createElement(t, props);
  },
};

export type DRichProps = { className: string; html: string; attrs?: Attrs; style?: Record<string, string> };

/**
 * What the rich text editor offers: paragraphs, headings 2 to 4, bold, italic, underline, strike, links, lists, quotes
 * and line breaks. The server keeps exactly these when a design is sent (sanitizeRichText).
 */
const RICH_OPTIONS = { code: false, codeBlock: false, horizontalRule: false, textAlign: false, heading: { levels: [2, 3, 4] } } as const;

/** Formatted text edited on the canvas (a blog post's body, an article): bold, links, lists, headings… */
export const DRich: ComponentConfig<DRichProps> = {
  label: "Rich text",
  inline: true,
  fields: {
    html: { type: "richtext", label: "Text", contentEditable: true, options: RICH_OPTIONS },
    className: styleField(["text", "colours", "spacing", "size", "look", "position", "visibility"]),
  } as unknown as ComponentConfig<DRichProps>["fields"],
  defaultProps: {
    className: "vt:max-w-[65ch] vt:text-base vt:leading-relaxed",
    html: "<h2>A heading</h2><p>Write here, and use the toolbar for <strong>bold</strong>, <em>italic</em>, links and lists.</p>",
  },
  // The editor and the published page hand the text over ready to show. A string comes from a collection field shown
  // on an item page (content.ts bindProps): escaped paragraphs, used as HTML only in exactly that form.
  render: ({ className, html, attrs, style, puck }) => {
    const props = { className: `veloce-rich ${className}`, style: safeStyle(style), ref: withAttrs(puck.dragRef, attrs) };
    if (typeof html !== "string") return <div {...props}>{html}</div>;
    return PLAIN_PARAGRAPHS.test(html) ? <div {...props} dangerouslySetInnerHTML={{ __html: html }} /> : <div {...props}>{html}</div>;
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
