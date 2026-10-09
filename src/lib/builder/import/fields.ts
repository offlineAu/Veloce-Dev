/*
 * Step 5: one section (IR) → the JSON tree stored in the package, plus what visitors may edit:
 *   - every piece of visible text becomes a text field,
 *   - every image gets an address field and a description field,
 *   - every link gets a link field (links between the design's pages become page links),
 *   - runs of 3+ structurally identical siblings (cards, steps, nav links) become a list visitors can add to.
 * Icon ligatures (Material Symbols) and form option text stay as they are.
 */
import type { AttrValue, ElementNode, FieldDef, RepeaterDef, TreeNode } from "../template-package";
import { rewriteClassList, type ClassContext } from "./classes";
import { classList, textOf, type IREl, type IRNode } from "./ir";
import type { Report } from "./report";

/** Image addresses are recorded as "asset:<original url>" and replaced by package paths once downloaded. */
export const ASSET = "asset:";
export const MAX_ITEMS = 24;

export interface FieldEnv {
  classes: ClassContext;
  /** Every prefixed class seen, for the CSS compile. */
  candidates: Set<string>;
  /** `data-path` value → link value ("tpl:<page key>", "#anchor" or "#"). */
  linkFor: (path: string) => string;
  /** Original image addresses to download. */
  images: Set<string>;
  /** Icon font ligatures in use ("arrow_forward"), so the icon font can be cut down to them. */
  icons: Set<string>;
  report: Report;
}

interface Scope {
  fields: FieldDef[];
  values: Record<string, string>;
  next: { t: number; i: number; l: number };
  labels: Map<string, number>;
  /** Inside a list item: lists don't nest. */
  inItem: boolean;
  repeaters: RepeaterDef[];
  itemCounter: { n: number };
}

const newScope = (inItem: boolean, itemCounter = { n: 0 }): Scope => ({
  fields: [], values: {}, next: { t: 0, i: 0, l: 0 }, labels: new Map(), inItem, repeaters: [], itemCounter,
});

const ICON_CLASS = /^material-(symbols|icons)/;
const STATIC_TEXT_PARENTS = new Set(["option", "textarea", "title", "desc", "style", "script", "text", "tspan"]);
const VOID = new Set(["area", "br", "col", "hr", "img", "input", "source", "track", "wbr"]);
const BOOLEAN = new Set(["hidden", "disabled", "required", "checked", "selected", "multiple", "muted", "loop", "controls", "open", "reversed", "allowfullscreen", "autoplay", "playsinline", "readonly"]);
const REACT_NAMES: Record<string, string> = {
  class: "className", for: "htmlFor", tabindex: "tabIndex", colspan: "colSpan", rowspan: "rowSpan", readonly: "readOnly",
  maxlength: "maxLength", autoplay: "autoPlay", playsinline: "playsInline", allowfullscreen: "allowFullScreen", datetime: "dateTime",
  viewbox: "viewBox", "xlink:href": "xlinkHref", gradientunits: "gradientUnits", gradienttransform: "gradientTransform",
  preserveaspectratio: "preserveAspectRatio", clippath: "clipPath",
};
const SVG_TAG_CASE: Record<string, string> = { lineargradient: "linearGradient", radialgradient: "radialGradient", clippath: "clipPath" };

/** Visible words of an element, leaving out icon ligatures ("arrow_forward"). */
const wordsOf = (n: IRNode): string =>
  n.kind === "text" ? n.text : n.kind === "el" && !classList(n).some((c) => ICON_CLASS.test(c)) ? n.children.map(wordsOf).join(" ") : "";

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function parseStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim();
    if (!/^-?[a-z-]+$/.test(prop) || !value || /url\(|expression\(|javascript:/i.test(value)) continue;
    out[prop.startsWith("--") ? prop : camel(prop.replace(/^-ms-/, "ms-"))] = value;
  }
  return out;
}

function reactAttrs(el: IREl, env: FieldEnv, svg: boolean): Record<string, AttrValue> {
  const out: Record<string, AttrValue> = {};
  for (const [name, value] of Object.entries(el.attrs)) {
    if (name.startsWith("data-") || name === "srcset" || name === "sizes") continue; // consumed here or not imported
    if (name === "class") {
      const cls = rewriteClassList(value, env.classes);
      cls.split(" ").forEach((c) => c && env.candidates.add(c));
      if (cls) out.className = cls;
      continue;
    }
    if (name === "style") {
      const s = parseStyle(value);
      if (Object.keys(s).length) out.style = s;
      continue;
    }
    const key = REACT_NAMES[name] ?? (svg && !name.startsWith("aria-") ? camel(name) : name);
    if (BOOLEAN.has(name)) out[key] = true;
    else if (key === "tabIndex") out[key] = Number(value) || 0;
    else out[key] = value;
  }
  return out;
}

function label(scope: Scope, base: string): string {
  const n = (scope.labels.get(base) ?? 0) + 1;
  scope.labels.set(base, n);
  return n === 1 ? base : `${base} ${n}`;
}

/** Elements whose meaning names the text inside them, however deeply it is nested. */
const SEMANTIC = /^(h[1-6]|a|button|label|legend|li|blockquote|q|figcaption|p)$/;

function textLabel(parent: IREl, semantic: string | undefined): { base: string; long: boolean } {
  const cls = classList(parent).join(" ");
  if (semantic && semantic !== parent.tag && SEMANTIC.test(semantic) && !/uppercase|tracking-wid|label-/.test(cls)) {
    return textLabel({ ...parent, tag: semantic, attrs: {} }, undefined);
  }
  if (/^h[1-6]$/.test(parent.tag)) return { base: "Heading", long: false };
  if (parent.tag === "a") return { base: "Link text", long: false };
  if (parent.tag === "button") return { base: "Button text", long: false };
  if (parent.tag === "label" || parent.tag === "legend") return { base: "Form label", long: false };
  if (parent.tag === "li") return { base: "List item", long: false };
  if (parent.tag === "blockquote" || parent.tag === "q") return { base: "Quote", long: true };
  if (parent.tag === "figcaption") return { base: "Caption", long: false };
  if (/uppercase|tracking-wid|label-/.test(cls)) return { base: "Label", long: false };
  if (parent.tag === "p") return { base: "Text", long: true };
  return { base: "Text", long: false };
}

function addField(scope: Scope, kind: FieldDef["kind"], prefix: "t" | "i" | "l", base: string, value: string): string {
  const id = `${prefix}${++scope.next[prefix]}`;
  scope.fields.push({ id, kind, label: label(scope, base) });
  scope.values[id] = value;
  return id;
}

/** Structure of an element for list detection: tags and text placement, ignoring text and nested classes. */
function signature(node: IRNode, depth = 0): string {
  if (node.kind === "text") return node.text.trim() ? "#" : "";
  if (node.kind === "comment") return "";
  const cls = depth === 0 ? classList(node).sort().join(".") : "";
  return `${node.tag}${cls ? `.${cls}` : ""}(${node.children.map((c) => signature(c, depth + 1)).filter(Boolean).join(",")})`;
}

const hasEditable = (el: IREl): boolean =>
  el.tag === "img" || el.tag === "a" || el.children.some((c) => (c.kind === "text" ? !!c.text.trim() : c.kind === "el" && hasEditable(c)));

function itemLabel(el: IREl): string {
  if (el.tag === "a" || "data-path" in el.attrs) return "Link";
  if (el.tag === "button") return "Button";
  if (el.tag === "li") return "Item";
  if (["article", "figure"].includes(el.tag) || /card|rounded/.test(classList(el).join(" "))) return "Card";
  return "Item";
}

function convertChildren(parent: IREl, scope: Scope, env: FieldEnv, svg: boolean, semantic: string | undefined): TreeNode[] {
  const out: TreeNode[] = [];
  const kids = parent.children.filter((c) => c.kind !== "comment");
  const iconText = classList(parent).some((c) => ICON_CLASS.test(c));
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i]!;
    if (child.kind === "text") {
      if (!child.text.trim()) {
        if (child.text && out.length && i < kids.length - 1) out.push(" ");
        continue;
      }
      if (iconText || svg || STATIC_TEXT_PARENTS.has(parent.tag)) {
        if (iconText) env.icons.add(child.text.trim());
        out.push(child.text.replace(/\s+/g, " "));
        continue;
      }
      const lead = /^\s/.test(child.text) && out.length ? " " : "";
      const trail = /\s$/.test(child.text) && i < kids.length - 1 ? " " : "";
      const { base, long } = textLabel(parent, semantic);
      const value = child.text.replace(/\s+/g, " ").trim();
      const id = addField(scope, long || value.length > 90 ? "textarea" : "text", "t", base, value);
      if (lead) out.push(lead);
      out.push({ f: id });
      if (trail) out.push(trail);
      continue;
    }
    if (child.kind !== "el") continue;

    // A run of similar siblings becomes a list visitors can add to and remove from.
    if (!scope.inItem && !svg && hasEditable(child)) {
      const sig = signature(child);
      let j = i + 1;
      while (j < kids.length && (kids[j]!.kind !== "el" ? kids[j]!.kind === "text" && !(kids[j] as { text: string }).text.trim() : signature(kids[j]!) === sig)) j++;
      const run = kids.slice(i, j).filter((k): k is IREl => k.kind === "el");
      if (run.length >= 3) {
        const list = repeater(run, scope, env);
        if (list) {
          out.push(list);
          i = j - 1;
          continue;
        }
      }
    }
    const node = convertElement(child, scope, env, svg, semantic);
    if (node) out.push(node);
  }
  return out;
}

function repeater(run: IREl[], scope: Scope, env: FieldEnv): TreeNode | null {
  const scopes = run.map(() => newScope(true));
  const items = run.map((el, k) => convertElement(el, scopes[k]!, env, false, undefined));
  const ids = scopes[0]!.fields.map((f) => f.id).join();
  if (!items[0] || scopes.some((s) => s.fields.map((f) => f.id).join() !== ids) || !ids) return null;
  const id = `r${++scope.itemCounter.n}`;
  const name = itemLabel(run[0]!);
  scope.repeaters.push({
    id,
    label: label(scope, `${name}s`),
    itemLabel: name,
    fields: scopes[0]!.fields,
    defaults: scopes.map((s) => s.values),
    max: Math.max(MAX_ITEMS, run.length),
  });
  return { r: id, item: items[0] as ElementNode };
}

function convertElement(el: IREl, scope: Scope, env: FieldEnv, inSvg: boolean, inherited: string | undefined): ElementNode | null {
  const svg = inSvg || el.tag === "svg";
  // Buttons that navigate (data-path) become links, so they can point at a page.
  const navButton = el.tag === "button" && el.attrs["data-path"] !== undefined;
  const tag = navButton ? "a" : (SVG_TAG_CASE[el.tag] ?? el.tag);
  const a = reactAttrs(el, env, svg);
  const b: Record<string, string> = {};

  if (tag === "img") {
    const src = el.attrs.src ?? "";
    if (/^https?:\/\//i.test(src)) env.images.add(src);
    else if (src && !src.startsWith("data:image/")) env.report.warn(`Image with a relative address (${src.slice(0, 60)}) has no file in the export.`);
    b.src = addField(scope, "image", "i", "Image", /^https?:\/\//i.test(src) ? `${ASSET}${src}` : "");
    b.alt = addField(scope, "text", "t", "Image description", el.attrs.alt || el.attrs["data-alt"] || "");
    delete a.src;
    delete a.alt;
  }
  if (tag === "a") {
    const path = el.attrs["data-path"];
    const href = path !== undefined ? env.linkFor(path) : (el.attrs.href ?? "#");
    const text = wordsOf(el).replace(/\s+/g, " ").trim().slice(0, 30);
    b.href = addField(scope, "link", "l", text ? `“${text}” link` : "Link", href);
    delete a.href;
    if (navButton) delete a.type;
  }

  // Text areas show their text as a value; selected options become the select's value.
  if (tag === "textarea") {
    const t = textOf(el);
    if (t) a.value = t;
    return { t: tag, a };
  }
  if (tag === "select") {
    const selected = el.children.find((c): c is IREl => c.kind === "el" && c.tag === "option" && "selected" in c.attrs);
    if (selected) a.value = selected.attrs.value ?? textOf(selected);
  }
  if (tag === "option") delete a.selected;

  const node: ElementNode = { t: tag };
  if (Object.keys(a).length) node.a = a;
  if (Object.keys(b).length) node.b = b;
  if (!VOID.has(tag)) {
    const c = convertChildren(el, scope, env, svg, SEMANTIC.test(tag) ? tag : inherited);
    if (c.length) node.c = c;
  }
  return node;
}

/** Converts one section. Field ids are local to the section (and to each list item). */
export function convertSection(el: IREl, env: FieldEnv) {
  const scope = newScope(false);
  const tree = convertElement(el, scope, env, false, undefined)!;
  return { tree, fields: scope.fields, defaults: scope.values, repeaters: scope.repeaters };
}
