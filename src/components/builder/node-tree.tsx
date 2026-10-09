import { createElement, type FormEvent, type ReactNode } from "react";
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

const isElement = (n: TreeNode): n is ElementNode => typeof n === "object" && "t" in n;

function cleanAttrs(attrs: Record<string, AttrValue> | undefined): Record<string, AttrValue> {
  const out: Record<string, AttrValue> = {};
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (/^on/i.test(k) || k === "dangerouslySetInnerHTML") continue;
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
    else props[attr] = value;
  }
  if (tag === "a" && !node.b?.href) Object.assign(props, linkProps(String(props.href ?? ""), ctx.puck));

  // Designs show forms as a visual: they never submit, and they don't take focus while the page is being edited.
  if (tag === "form") props.onSubmit = preventSubmit;
  if (tag === "button") props.type = "button";
  if (FORM_FIELDS.has(tag)) {
    props.readOnly = true;
    if (ctx.puck.isEditing) props.tabIndex = -1;
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
  return createElement(tag, props, ...renderChildren(node.c, ctx));
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
