/*
 * "Edit HTML": design pieces shown as readable HTML (classes without the `vt:` prefix), and the markers that keep
 * the builder's own blocks in place while the HTML around them is edited. The way back (HTML → pieces) runs on the
 * server, through the importer's sanitiser (src/server/builder/html-pieces.ts). No React, no Node.
 */
import { isSlot, type BlockItem } from "./blocks";
import { showClasses } from "./class-groups";
import { ELEMENT_TYPES, type TextRun } from "./elements";
import type { AttrValue, ElementNode, TreeNode } from "./template-package";

/** `<!--block:Heading-123-->` stands for a builder block (Heading, Columns…) inside the HTML. */
export const KEEP_MARKER = /^block:([\w-]{1,120})$/;
export const KEEP_TYPE = "__keep";

const PIECES = new Set<string>(ELEMENT_TYPES);
const VOID = new Set(["img", "input", "br", "hr", "source", "wbr", "col"]);
const HTML_NAMES: Record<string, string> = {
  className: "class", htmlFor: "for", colSpan: "colspan", rowSpan: "rowspan", maxLength: "maxlength", dateTime: "datetime", tabIndex: "tabindex",
  readOnly: "readonly", autoPlay: "autoplay", playsInline: "playsinline", allowFullScreen: "allowfullscreen", xlinkHref: "xlink:href",
};
// SVG attributes that keep their capitals in HTML.
const SVG_CASED = new Set(["viewBox", "preserveAspectRatio", "gradientUnits", "gradientTransform", "patternUnits"]);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function styleText(style: unknown): string {
  if (!style || typeof style !== "object") return "";
  return Object.entries(style as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `${k.startsWith("--") ? k : kebab(k).replace(/^ms-/, "-ms-")}: ${v}`)
    .join("; ");
}

function attrText(attrs: Record<string, AttrValue | Record<string, string> | undefined>): string {
  let out = "";
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false || v === "") continue;
    if (k === "style") {
      const s = styleText(v);
      if (s) out += ` style="${escAttr(s)}"`;
      continue;
    }
    if (typeof v === "object") continue;
    const name = k === "className" ? "class" : (HTML_NAMES[k] ?? (SVG_CASED.has(k) || k.startsWith("aria-") ? k : kebab(k)));
    const value = k === "className" ? showClasses(String(v)) : String(v);
    if (k === "className" && !value) continue;
    out += v === true ? ` ${name}` : ` ${name}="${escAttr(value)}"`;
  }
  return out;
}

function el(tag: string, attrs: Record<string, AttrValue | Record<string, string> | undefined>, inner: string[], depth: number): string {
  const pad = "  ".repeat(depth);
  const open = `${pad}<${tag}${attrText(attrs)}>`;
  if (VOID.has(tag)) return open;
  if (!inner.length) return `${open}</${tag}>`;
  // Short text stays on one line; anything with elements inside is indented.
  if (inner.length === 1 && !inner[0]!.includes("\n") && !inner[0]!.startsWith(" ") && open.length + inner[0]!.length < 110) return `${open}${inner[0]}</${tag}>`;
  return `${open}\n${inner.map((i) => (i.startsWith(" ") ? i : `${"  ".repeat(depth + 1)}${i}`)).join("\n")}\n${pad}</${tag}>`;
}

function rawTree(node: TreeNode, depth: number): string {
  if (typeof node === "string") return esc(node);
  if (!("t" in node)) return "";
  return el(node.t, { ...(node.a ?? {}) }, (node.c ?? []).map((c) => rawTree(c, depth + 1)), depth);
}

const runHtml = (r: TextRun) => (!r.tag ? esc(r.text) : r.tag === "br" ? `<br${attrText({ className: r.className })}>` : `<${r.tag}${attrText({ className: r.className })}>${esc(r.text)}</${r.tag}>`);

function piece(b: BlockItem, depth: number): string {
  const p = b.props as Record<string, unknown>;
  const base = { className: p.className as string | undefined, ...((p.attrs as Record<string, AttrValue>) ?? {}), style: p.style as Record<string, string> | undefined };
  // Loose text among elements is written on one line, so no new spaces appear between them.
  const kids = (v: unknown) => {
    if (!isSlot(v)) return [];
    if (!v.some((c) => c.type === "DText" && !c.props.tag)) return v.map((c) => serializeOne(c, depth + 1));
    return [v.map((c) => serializeOne(c, 0)).join("")];
  };
  switch (b.type) {
    case "Box":
      return el(String(p.tag || "div"), base, kids(p.items), depth);
    case "DText": {
      const runs = (p.runs as TextRun[] | undefined) ?? [];
      const text = runs.length ? runs.map(runHtml).join("") : esc(String(p.text ?? ""));
      return p.tag ? el(String(p.tag), base, [text], depth) : `${"  ".repeat(depth)}${text}`;
    }
    case "DImage":
      return el("img", { src: String(p.src ?? ""), alt: String(p.alt ?? ""), ...base }, [], depth);
    case "DLink": {
      const tag = p.tag === "button" ? "button" : "a";
      const attrs = tag === "a" ? { href: String(p.href ?? "") || "#", ...base } : base;
      return el(tag, attrs, p.textOnly ? [esc(String(p.text ?? ""))] : kids(p.items), depth);
    }
    case "DIcon":
      return el(String(p.tag || "span"), base, [esc(String(p.name ?? ""))], depth);
    case "DField": {
      const options = (p.options as { value: string; label: string }[] | undefined) ?? [];
      return el(String(p.tag || "input"), base, options.map((o) => `<option value="${escAttr(o.value)}">${esc(o.label)}</option>`), depth);
    }
    case "DRaw":
      return `${"  ".repeat(depth)}${rawTree(p.tree as ElementNode, depth)}`;
    default:
      return "";
  }
}

function serializeOne(b: BlockItem, depth: number): string {
  return PIECES.has(b.type) ? piece(b, depth) : `${"  ".repeat(depth)}<!--block:${String(b.props.id)}-->`;
}

/** Pieces (and the builder blocks inside them, as markers) as readable HTML. */
export function serializeElements(blocks: BlockItem[]): string {
  return blocks.map((b) => serializeOne(b, 0)).join("\n");
}

/** Every builder block a marker can stand for, by id: what was inside the pieces being edited. */
export function keptBlocks(blocks: BlockItem[]): Map<string, BlockItem> {
  const out = new Map<string, BlockItem>();
  const visit = (items: BlockItem[]) => {
    for (const b of items) {
      if (!PIECES.has(b.type)) out.set(String(b.props.id), b);
      else for (const v of Object.values(b.props)) if (isSlot(v)) visit(v);
    }
  };
  visit(blocks);
  return out;
}

/** Puts the kept builder blocks back where their markers are (markers for unknown blocks are dropped). */
export function restoreKept(blocks: BlockItem[], kept: Map<string, BlockItem>): BlockItem[] {
  return blocks.flatMap((b): BlockItem[] => {
    if (b.type === KEEP_TYPE) {
      const k = kept.get(String(b.props.id));
      return k ? [k] : [];
    }
    const props: BlockItem["props"] = {};
    for (const [key, v] of Object.entries(b.props)) props[key] = isSlot(v) ? restoreKept(v, kept) : v;
    return [{ ...b, props }];
  });
}

/** Replaces the block with this id (at any depth) by any number of blocks. */
export function replaceBlock(items: BlockItem[], id: string, replacement: BlockItem[]): BlockItem[] {
  return items.flatMap((b): BlockItem[] => {
    if (b.props.id === id) return replacement;
    const props: BlockItem["props"] = {};
    for (const [key, v] of Object.entries(b.props)) props[key] = isSlot(v) ? replaceBlock(v, id, replacement) : v;
    return [{ ...b, props }];
  });
}
