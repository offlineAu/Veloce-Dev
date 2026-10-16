import { parseBehaviour } from "@/lib/builder/behaviours";
import { effectText, textEffectOf } from "./text-effects";
import { createElement, type FormEvent, type ReactNode } from "react";
import { bgImage } from "@/lib/builder/bg-image";
import type { AttrValue, ElementNode, TreeNode } from "@/lib/builder/template-package";
import { linkProps } from "./links";

/*
 * Renders an imported section from its JSON tree with React.createElement. The importer has already sanitised and
 * allow-listed the tree; this renderer still refuses anything that could run code, so even a hand-edited package
 * can't inject script. Visitor values only ever become text, an image address or a link (via linkProps).
 */

type Values = Record<string, string>;

export interface RenderContext {
  values: Values;
  items: Record<string, Values[]>;
  puck: { isEditing?: boolean; metadata?: unknown };
}

const VOID = new Set(["area", "br", "col", "hr", "img", "input", "source", "track", "wbr"]);
const BLOCKED = new Set(["script", "style", "object", "embed", "link", "meta", "base", "noscript", "template", "frame", "frameset"]);
const FORM_FIELDS = new Set(["input", "textarea", "select"]);

/** Elements whose content model has no text: whitespace inside them is dropped by the HTML parser, breaking hydration. */
const NO_TEXT = new Set(["table", "thead", "tbody", "tfoot", "tr", "colgroup"]);

const isElement = (n: TreeNode): n is ElementNode => typeof n === "object" && "t" in n;

function cleanAttrs(attrs: Record<string, AttrValue> | undefined): Record<string, AttrValue> {
  const out: Record<string, AttrValue> = {};
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (/^on/i.test(k) || k === "dangerouslySetInnerHTML") continue;
    // Data attributes: only interactions the runtime understands (and the importer's own page links).
    if (k.startsWith("data-") && k !== "data-path" && k !== "data-alt" && parseBehaviour(k, v) === null) continue;
    if (typeof v === "string" && /^\s*(javascript|vbscript|data:text\/html)/i.test(v)) continue;
    out[k] = v;
  }
  return out;
}

const preventSubmit = (e: FormEvent) => e.preventDefault();

function renderElement(node: ElementNode, ctx: RenderContext, key: number | string): ReactNode {
  const tag = node.t.toLowerCase();
  if (BLOCKED.has(tag)) return null;
  const props: Record<string, unknown> = { ...cleanAttrs(node.a), key };
  if (tag === "iframe" && !/^https:\/\//i.test(String(props.src ?? ""))) return null;

  for (const [attr, fieldId] of Object.entries(node.b ?? {})) {
    const value = ctx.values[fieldId] ?? "";
    if (attr === "href") Object.assign(props, linkProps(value, ctx.puck));
    else if (attr === "src") props.src = value || undefined;
    else if (attr === "bg") {
      const image = bgImage(value);
      if (image) props.style = { ...(props.style as object | undefined), backgroundImage: image };
    }
    else props[attr] = value;
  }
  if (tag === "a" && !node.b?.href) Object.assign(props, linkProps(String(props.href ?? ""), ctx.puck));

  // Designs' forms never submit; they can be filled in to try them, except while the page is being edited. A
  // submit button still submits (outside the editor), so a form's check and thank-you message (data-vt-form) run.
  if (tag === "form") props.onSubmit = preventSubmit;
  if (tag === "button") props.type = props.type === "submit" && !ctx.puck.isEditing ? "submit" : "button";
  if (FORM_FIELDS.has(tag)) {
    if (ctx.puck.isEditing) {
      props.readOnly = true;
      props.tabIndex = -1;
    }
    if ("value" in props) {
      props.defaultValue = props.value;
      delete props.value;
    }
    if ("checked" in props) {
      props.defaultChecked = props.checked;
      delete props.checked;
    }
  }

  if (VOID.has(tag)) return createElement(tag, props);
  // Words that slide in, letters that roll or flip: their spans, as design pieces render them (text-effects.tsx), so
  // a locked section and the same section taken apart look and move the same.
  const effect = textEffectOf(node.a);
  if (effect && (node.c ?? []).every((c) => typeof c === "string" || "f" in (c as object))) {
    const text = (node.c ?? []).map((c) => (typeof c === "string" ? c : (ctx.values[(c as { f: string }).f] ?? ""))).join("");
    if (effect !== "split") props["aria-label"] = text;
    return createElement(tag, props, ...effectText(effect, text));
  }
  const children = NO_TEXT.has(tag) ? node.c?.filter((c) => typeof c !== "string" || c.trim()) : node.c;
  return createElement(tag, props, ...renderChildren(children, ctx));
}

function renderChildren(children: TreeNode[] | undefined, ctx: RenderContext): ReactNode[] {
  return (children ?? []).map((child, i) => renderNode(child, ctx, i));
}

export function renderNode(node: TreeNode, ctx: RenderContext, key: number | string = 0): ReactNode {
  if (typeof node === "string") return node;
  if (isElement(node)) return renderElement(node, ctx, key);
  if ("f" in node) return ctx.values[node.f] ?? "";
  const list = ctx.items[node.r] ?? [];
  return list.map((values, i) => renderElement(node.item, { ...ctx, values }, `${key}-${i}`));
}
