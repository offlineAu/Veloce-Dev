/*
 * Step 1 of the importer: HTML text → a small, sanitised intermediate tree (IR). Everything later works on the IR.
 * Sanitising is allow-list based: tags and attributes not listed here never reach a template package.
 */
import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { Report } from "./report";

type P5Node = DefaultTreeAdapterMap["node"];
type P5Element = DefaultTreeAdapterMap["element"];

export interface IRText {
  kind: "text";
  text: string;
}
export interface IRComment {
  kind: "comment";
  text: string;
}
export interface IREl {
  kind: "el";
  tag: string;
  attrs: Record<string, string>;
  children: IRNode[];
}
export type IRNode = IRText | IRComment | IREl;

export interface ParsedPage {
  htmlClass: string;
  title: string;
  /** Source of the inline `tailwind.config = {…}` script, if any. */
  tailwindConfig?: string;
  /** Google Fonts stylesheet URLs. */
  fontLinks: string[];
  /** Contents of <style> blocks (reported, not imported: Stitch only uses them for page boilerplate). */
  styles: string[];
  body: IREl;
}

const ALLOWED_TAGS = new Set([
  "a", "abbr", "address", "article", "aside", "b", "blockquote", "br", "button", "caption", "cite", "code", "col", "colgroup",
  "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
  "h4", "h5", "h6", "header", "hr", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "mark", "nav", "ol",
  "optgroup", "option", "p", "picture", "pre", "progress", "meter", "q", "s", "samp", "section", "select", "small", "source",
  "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "time", "tr", "u", "ul",
  "var", "video", "wbr", "iframe", "body",
  // SVG icons and decorations
  "svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect", "defs", "lineargradient", "radialgradient",
  "stop", "clippath", "mask", "use", "symbol", "title", "desc", "text", "tspan",
]);

/** Dropped with everything inside them. */
const DROP_WITH_CONTENT = new Set(["script", "style", "noscript", "template", "object", "embed", "head", "link", "meta", "base", "frame", "frameset", "canvas", "audio"]);

const GLOBAL_ATTRS = new Set(["class", "id", "title", "role", "lang", "dir", "hidden", "tabindex"]);
const TAG_ATTRS: Record<string, string[]> = {
  a: ["href", "target", "rel", "data-path"],
  button: ["type", "disabled", "data-path"],
  img: ["src", "alt", "width", "height", "loading", "data-alt", "srcset", "sizes"],
  source: ["src", "srcset", "type", "media", "sizes"],
  video: ["src", "poster", "autoplay", "muted", "loop", "playsinline", "controls"],
  iframe: ["src", "allow", "allowfullscreen", "loading", "width", "height"],
  input: ["type", "name", "value", "placeholder", "checked", "disabled", "required", "min", "max", "step", "readonly", "maxlength", "for"],
  textarea: ["name", "placeholder", "rows", "cols", "disabled", "required", "readonly", "maxlength"],
  select: ["name", "disabled", "required", "multiple"],
  option: ["value", "selected", "disabled", "label"],
  label: ["for"],
  form: ["action", "method"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
  ol: ["start", "reversed"],
  time: ["datetime"],
  progress: ["value", "max"],
  meter: ["value", "min", "max"],
  details: ["open"],
};
const SVG_PRESENTATION = /^(viewbox|xmlns|fill|stroke|d|cx|cy|r|rx|ry|x|y|x1|x2|y1|y2|width|height|points|transform|opacity|offset|stop-color|stop-opacity|fill-opacity|stroke-opacity|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|stroke-dasharray|stroke-dashoffset|fill-rule|clip-rule|clip-path|mask|gradientunits|gradienttransform|preserveaspectratio|href|xlink:href|font-size|text-anchor|dominant-baseline|id|vector-effect)$/i;
const SVG_TAGS = new Set(["svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect", "defs", "lineargradient", "radialgradient", "stop", "clippath", "mask", "use", "symbol", "title", "desc", "text", "tspan"]);

const isElement = (n: P5Node): n is P5Element => "tagName" in n;

function allowedAttr(tag: string, name: string): boolean {
  if (/^on/i.test(name)) return false;
  if (name.startsWith("aria-")) return true;
  if (GLOBAL_ATTRS.has(name)) return true;
  if (SVG_TAGS.has(tag)) return SVG_PRESENTATION.test(name) || name === "style";
  if (name === "style") return true;
  return (TAG_ATTRS[tag] ?? []).includes(name);
}

const UNSAFE_URL = /^\s*(javascript|vbscript|data:(?!image\/(png|jpe?g|gif|webp|avif);))/i;

function toIR(node: P5Node, report: Report): IRNode | null {
  if (node.nodeName === "#text") return { kind: "text", text: (node as DefaultTreeAdapterMap["textNode"]).value };
  if (node.nodeName === "#comment") return { kind: "comment", text: (node as DefaultTreeAdapterMap["commentNode"]).data.trim() };
  if (!isElement(node)) return null;
  const tag = node.tagName.toLowerCase();
  if (DROP_WITH_CONTENT.has(tag)) {
    if (tag === "script") report.count("scripts removed");
    return null;
  }
  const attrs: Record<string, string> = {};
  for (const a of node.attrs) {
    const name = (a.prefix ? `${a.prefix}:${a.name}` : a.name).toLowerCase();
    if (!allowedAttr(tag, name)) {
      if (/^on/i.test(name)) report.count("inline event handlers removed (onclick…)");
      continue;
    }
    if ((name === "href" || name === "src" || name.endsWith(":href")) && UNSAFE_URL.test(a.value)) {
      report.count("unsafe links removed");
      continue;
    }
    attrs[name] = a.value;
  }
  if (tag === "iframe" && !/^https:\/\//i.test(attrs.src ?? "")) {
    report.count("embeds without https removed");
    return null;
  }
  const children = ((node as P5Element).childNodes ?? (node as unknown as { content?: { childNodes: P5Node[] } }).content?.childNodes ?? [])
    .map((c) => toIR(c, report))
    .filter((c): c is IRNode => c !== null);
  if (!ALLOWED_TAGS.has(tag)) {
    report.warn(`Unsupported <${tag}> replaced by its contents.`);
    return { kind: "el", tag: "span", attrs: attrs.class ? { class: attrs.class } : {}, children };
  }
  return { kind: "el", tag, attrs, children };
}

function find(node: P5Node, pred: (e: P5Element) => boolean): P5Element | undefined {
  if (isElement(node) && pred(node)) return node;
  for (const c of ("childNodes" in node ? node.childNodes : []) as P5Node[]) {
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return undefined;
}

function findAll(node: P5Node, pred: (e: P5Element) => boolean, out: P5Element[] = []): P5Element[] {
  if (isElement(node) && pred(node)) out.push(node);
  for (const c of ("childNodes" in node ? node.childNodes : []) as P5Node[]) findAll(c, pred, out);
  return out;
}

const attr = (e: P5Element | undefined, name: string) => e?.attrs.find((a) => a.name === name)?.value;
const text = (e: P5Element) => e.childNodes.map((c) => (c.nodeName === "#text" ? (c as DefaultTreeAdapterMap["textNode"]).value : "")).join("");

export function parsePage(html: string, report: Report): ParsedPage {
  const doc = parse(html);
  const htmlEl = find(doc, (e) => e.tagName === "html");
  const body = find(doc, (e) => e.tagName === "body");
  const scripts = findAll(doc, (e) => e.tagName === "script");
  const config = scripts.map(text).find((s) => /tailwind\.config\s*=/.test(s));
  const fontLinks = findAll(doc, (e) => e.tagName === "link" && /fonts\.googleapis\.com\/css/.test(attr(e, "href") ?? "")).map((e) => attr(e, "href")!);
  const styles = findAll(doc, (e) => e.tagName === "style").map(text);
  const titleEl = find(doc, (e) => e.tagName === "title");

  const bodyIR = body ? toIR(body, report) : null;
  return {
    htmlClass: attr(htmlEl, "class") ?? "",
    title: titleEl ? text(titleEl).trim() : "",
    tailwindConfig: config,
    fontLinks,
    styles,
    body: bodyIR && bodyIR.kind === "el" ? { ...bodyIR, tag: "div" } : { kind: "el", tag: "div", attrs: {}, children: [] },
  };
}

/** All elements in document order. */
export function* walk(node: IRNode): Generator<IREl> {
  if (node.kind !== "el") return;
  yield node;
  for (const c of node.children) yield* walk(c);
}

export const classList = (el: IREl) => (el.attrs.class ?? "").split(/\s+/).filter(Boolean);

/** Visible text of an element, whitespace collapsed. */
export const textOf = (node: IRNode): string =>
  node.kind === "text" ? node.text : node.kind === "el" ? node.children.map(textOf).join(" ").replace(/\s+/g, " ").trim() : "";
