/*
 * "Design pieces": an imported section taken apart into editable blocks, one per element, so visitors can move,
 * duplicate and delete what's inside it and mix it with the builder's own blocks. Built from the same sanitised tree
 * the locked DesignSection renders, with the visitor's current values filled in. Shared by the editor and the server
 * validator: no React.
 */
import { bgImage } from "./bg-image";
import type { BlockItem } from "./blocks";
import type { AttrValue, ElementNode, TemplateSection, TreeNode } from "./template-package";

export const ELEMENT_TYPES = ["Box", "DText", "DImage", "DLink", "DIcon", "DField", "DRaw"] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** A run of text inside a DText: plain, or wrapped in one inline element (span, strong, em, br…). */
export interface TextRun {
  text: string;
  tag?: string;
  className?: string;
}

/** Inline elements that stay part of a piece of text. */
export const INLINE_TAGS = new Set(["span", "strong", "em", "b", "i", "u", "s", "small", "mark", "sub", "sup", "code", "abbr", "time", "br", "q", "cite"]);
/** Elements that hold text and nothing else become DText. */
export const TEXT_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "label", "li", "dt", "dd", "blockquote", "figcaption", "small", "strong", "em", "div", "legend", "summary", "q", "cite", "time", "b", "i", "mark", "td", "th", "caption"]);
/** Containers a Box may be. */
export const BOX_TAGS = new Set([
  "div", "section", "header", "footer", "nav", "article", "aside", "main", "ul", "ol", "li", "figure", "figcaption", "form", "fieldset",
  "details", "summary", "dl", "dt", "dd", "blockquote", "picture", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "label", "p", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
]);
export const FIELD_TAGS = new Set(["input", "select", "textarea"]);
/** Attributes a piece keeps (besides its classes and style). */
export const PIECE_ATTRS = /^(id|role|title|lang|dir|open|aria-[a-z-]+|target|rel|loading|width|height|type|name|placeholder|value|checked|disabled|required|min|max|step|rows|maxLength|htmlFor|colSpan|rowSpan|scope|dateTime)$/;

const ICON_CLASS = /(^|\s)vt-material-(symbols|icons)/;

type Values = Record<string, string>;

const isEl = (n: TreeNode): n is ElementNode => typeof n === "object" && "t" in n;
const cls = (n: ElementNode) => (typeof n.a?.className === "string" ? n.a.className : "");
const newId = (type: string) => `${type}-${crypto.randomUUID()}`;

function keptAttrs(a: ElementNode["a"]): { attrs: Record<string, string | number | boolean>; style?: Record<string, string> } {
  const attrs: Record<string, string | number | boolean> = {};
  let style: Record<string, string> | undefined;
  for (const [k, v] of Object.entries(a ?? {})) {
    if (k === "style" && v && typeof v === "object") style = v as Record<string, string>;
    else if (PIECE_ATTRS.test(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) attrs[k] = v;
  }
  return { attrs, style };
}

/** Text of a node with field values filled in. */
const textOf = (n: TreeNode, values: Values): string =>
  typeof n === "string" ? n : isEl(n) ? (n.c ?? []).map((c) => textOf(c, values)).join("") : "f" in n ? (values[n.f] ?? "") : "";

function isTextLike(n: ElementNode): boolean {
  if (!TEXT_TAGS.has(n.t) || ICON_CLASS.test(cls(n))) return false;
  const kids = n.c ?? [];
  if (!kids.length) return false;
  return kids.every((c) => typeof c === "string" || "f" in (c as object) || (isEl(c) && INLINE_TAGS.has(c.t) && !c.b && !ICON_CLASS.test(cls(c)) && (c.c ?? []).every((g) => typeof g === "string" || "f" in (g as object))));
}

function runsOf(n: ElementNode, values: Values): TextRun[] {
  const runs: TextRun[] = [];
  for (const c of n.c ?? []) {
    if (typeof c === "string" || "f" in (c as object)) {
      const t = textOf(c, values);
      const last = runs.at(-1);
      if (last && !last.tag) last.text += t;
      else runs.push({ text: t });
    } else if (isEl(c)) {
      runs.push({ text: c.t === "br" ? "" : textOf(c, values), tag: c.t, className: cls(c) || undefined });
    }
  }
  return runs;
}

/** One element (and everything inside it) as a design piece. */
export function toPiece(node: TreeNode, values: Values, items: Record<string, Values[]>): BlockItem[] {
  // Loose text beside other elements: tag "" renders as bare text (wrapped only while editing).
  if (typeof node === "string") return node.trim() ? [{ type: "DText", props: { id: newId("DText"), tag: "", className: "", text: node, runs: [] } }] : [];
  if ("f" in node) {
    const t = values[node.f] ?? "";
    return t.trim() ? [{ type: "DText", props: { id: newId("DText"), tag: "", className: "", text: t, runs: [] } }] : [];
  }
  if ("r" in node) return (items[node.r] ?? []).flatMap((itemValues) => toPiece(node.item, itemValues, items));

  const className = cls(node);
  const { attrs, style } = keptAttrs(node.a);
  const bound = (attr: string) => (node.b?.[attr] ? (values[node.b[attr]!] ?? "") : (node.a?.[attr] as string | undefined));
  // Neighbouring bits of text (a space, then editable text) become one piece, so edge spaces aren't lost.
  const children = () => {
    const out: BlockItem[] = [];
    let text = "";
    const flush = () => {
      if (text.trim()) out.push({ type: "DText", props: { id: newId("DText"), tag: "", className: "", text: text.replace(/\s+/g, " "), runs: [] } });
      text = "";
    };
    for (const c of node.c ?? []) {
      if (typeof c === "string" || "f" in (c as object)) text += textOf(c, values);
      else {
        flush();
        out.push(...toPiece(c, values, items));
      }
    }
    flush();
    return out;
  };

  if (node.t === "img") {
    return [{ type: "DImage", props: { id: newId("DImage"), className, src: bound("src") ?? "", alt: bound("alt") ?? "", attrs, style } }];
  }
  if (node.t === "a" || node.t === "button") {
    // A link that only holds text keeps it on the link itself (no extra element); otherwise its parts are pieces.
    const textOnly = (node.c ?? []).length > 0 && (node.c ?? []).every((c) => typeof c === "string" || "f" in (c as object));
    const text = textOnly ? textOf(node, values) : "";
    return [{ type: "DLink", props: { id: newId("DLink"), tag: node.t, className, href: bound("href") ?? "", textOnly, text, attrs, style, items: textOnly ? [] : children() } }];
  }
  if (ICON_CLASS.test(className) && (node.c ?? []).every((c) => typeof c === "string")) {
    return [{ type: "DIcon", props: { id: newId("DIcon"), tag: node.t, className, name: textOf(node, values).trim(), attrs, style } }];
  }
  if (FIELD_TAGS.has(node.t)) {
    const options = node.t === "select" ? (node.c ?? []).filter(isEl).filter((o) => o.t === "option").map((o) => ({ value: String(o.a?.value ?? textOf(o, values)), label: textOf(o, values) })) : [];
    return [{ type: "DField", props: { id: newId("DField"), tag: node.t, className, attrs, style, options } }];
  }
  if (isTextLike(node) && !node.b?.bg) {
    const runs = runsOf(node, values);
    const plain = runs.length === 1 && !runs[0]!.tag;
    return [{ type: "DText", props: { id: newId("DText"), tag: node.t, className, text: plain ? runs[0]!.text : "", runs: plain ? [] : runs, attrs, style } }];
  }
  if (BOX_TAGS.has(node.t)) {
    return [{ type: "Box", props: { id: newId("Box"), tag: node.t, className, ...(node.b?.bg ? { bg: bound("bg") } : {}), attrs, style, items: children() } }];
  }
  // Anything else (SVG drawings, video…) stays as it is, but can still be moved and deleted.
  return [{ type: "DRaw", props: { id: newId("DRaw"), tree: fill(node, values, items) } }];
}

/** A tree with the field values written in, for pieces kept whole (DRaw). */
function fill(node: ElementNode, values: Values, items: Record<string, Values[]>): ElementNode {
  const a: Record<string, AttrValue> = { ...(node.a ?? {}) };
  for (const [attr, f] of Object.entries(node.b ?? {})) {
    if (attr !== "bg") a[attr] = values[f] ?? "";
    else if (bgImage(values[f])) a.style = { ...(a.style as Record<string, string> | undefined), backgroundImage: bgImage(values[f])! };
  }
  const c: TreeNode[] = (node.c ?? []).flatMap((ch): TreeNode[] => {
    if (typeof ch === "string") return [ch];
    if ("f" in ch) return [values[ch.f] ?? ""];
    if ("r" in ch) return (items[ch.r] ?? []).map((v) => fill(ch.item, v, items));
    return [fill(ch, values, items)];
  });
  return { t: node.t, ...(Object.keys(a).length ? { a } : {}), ...(c.length ? { c } : {}) };
}

/** A locked DesignSection taken apart into pieces, with what the visitor already changed kept. */
export function sectionToElements(section: TemplateSection, values: Values = {}, items: Record<string, Values[]> = {}): BlockItem {
  const v = { ...section.defaults, ...values };
  const it = { ...Object.fromEntries(section.repeaters.map((r) => [r.id, r.defaults])), ...items };
  return toPiece(section.tree, v, it)[0]!;
}

const PIECE_SET = new Set<string>(ELEMENT_TYPES);
const isSlotValue = (v: unknown): v is BlockItem[] => Array.isArray(v) && v.every((x) => !!x && typeof x === "object" && "type" in x && "props" in x);

/** Every class name used by design pieces on a page (including inside other blocks), for compiling missing ones. */
export function pieceClasses(content: BlockItem[]): string[] {
  const out = new Set<string>();
  const add = (c: unknown) => typeof c === "string" && c.split(/\s+/).forEach((t) => t && out.add(t));
  const visit = (items: BlockItem[]) => {
    for (const b of items) {
      if (PIECE_SET.has(b.type)) {
        add(b.props.className);
        if (Array.isArray(b.props.runs)) for (const r of b.props.runs as TextRun[]) add(r.className);
      }
      for (const v of Object.values(b.props)) if (isSlotValue(v)) visit(v);
    }
  };
  visit(content);
  return [...out].filter((c) => c.startsWith("vt:")).sort();
}
