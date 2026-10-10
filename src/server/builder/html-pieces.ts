import "server-only";
import type { BlockItem } from "@/lib/builder/blocks";
import { storeClasses } from "@/lib/builder/class-groups";
import { KEEP_MARKER, KEEP_TYPE } from "@/lib/builder/element-html";
import { toPiece } from "@/lib/builder/elements";
import { reactAttrs, SVG_TAG_CASE, type FieldEnv } from "@/lib/builder/import/fields";
import { parsePage, type IREl, type IRNode } from "@/lib/builder/import/ir";
import { Report } from "@/lib/builder/import/report";
import type { ElementNode, TreeNode } from "@/lib/builder/template-package";

/*
 * "Edit HTML", the way back: HTML a visitor typed → design pieces. The importer's parser does the sanitising (allow-
 * listed tags and attributes, no scripts or handlers, no javascript: links); classes get the template prefix. The
 * result is checked again like any piece when the design is sent (piece-validation.ts).
 */

export const MAX_HTML = 50_000;
export const MAX_ELEMENTS = 1500;

const KEEP_TAG = "veloce-keep";
const VOID = new Set(["br", "col", "hr", "img", "input", "source", "wbr"]);
const PRE = new Set(["pre", "textarea"]);

// Only `classes` and `candidates` are read when converting attributes; classes are handled here instead.
const env = { classes: { custom: new Set<string>(), radiusDefault: false }, candidates: new Set<string>() } as unknown as FieldEnv;

function toNode(el: IREl, svg: boolean, budget: { n: number }): ElementNode {
  if (++budget.n > MAX_ELEMENTS) throw new TooBig();
  const inSvg = svg || el.tag === "svg";
  const { class: cls, ...rest } = el.attrs;
  const a = reactAttrs({ ...el, attrs: rest }, env, inSvg);
  const className = storeClasses(cls ?? "").className;
  if (className) a.className = className;
  const node: ElementNode = { t: SVG_TAG_CASE[el.tag] ?? el.tag };
  if (Object.keys(a).length) node.a = a;
  if (!VOID.has(el.tag)) {
    const c = children(el, inSvg, budget);
    if (c.length) node.c = c;
  }
  return node;
}

function children(el: IREl, svg: boolean, budget: { n: number }): TreeNode[] {
  const out: TreeNode[] = [];
  const kids = el.children;
  kids.forEach((k: IRNode, i) => {
    if (k.kind === "comment") {
      const m = k.text.match(KEEP_MARKER);
      if (m) out.push({ t: KEEP_TAG, a: { id: m[1]! } });
      return;
    }
    if (k.kind === "el") {
      out.push(toNode(k, svg, budget));
      return;
    }
    if (PRE.has(el.tag)) {
      out.push(k.text);
      return;
    }
    // Spaces between words and elements matter ("a <em>b</em>"); indentation at the edges doesn't.
    let t = k.text.replace(/\s+/g, " ");
    if (i === 0) t = t.trimStart();
    if (i === kids.length - 1) t = t.trimEnd();
    if (t) out.push(t);
  });
  return out;
}

class TooBig extends Error {}

/** Builder blocks the HTML kept as markers become placeholders; the editor puts the original blocks back. */
function placeholders(blocks: BlockItem[]): BlockItem[] {
  return blocks.map((b) => {
    const tree = b.type === "DRaw" ? (b.props.tree as ElementNode) : null;
    if (tree?.t === KEEP_TAG) return { type: KEEP_TYPE, props: { id: String(tree.a?.id ?? "") } };
    const props: BlockItem["props"] = {};
    for (const [k, v] of Object.entries(b.props)) props[k] = Array.isArray(v) && v.every((x) => x && typeof x === "object" && "type" in x) ? placeholders(v as BlockItem[]) : v;
    return { ...b, props };
  });
}

export type HtmlResult = { ok: true; blocks: BlockItem[]; removed: string[] } | { ok: false; error: string };

export function htmlToPieces(html: string): HtmlResult {
  if (html.length > MAX_HTML) return { ok: false, error: "That's too much HTML for one part. Split it into smaller parts." };
  const report = new Report();
  const body = parsePage(`<!doctype html><html><body>${html}</body></html>`, report).body;
  let nodes: TreeNode[];
  try {
    nodes = children(body, false, { n: 0 });
  } catch (e) {
    if (e instanceof TooBig) return { ok: false, error: `That's more than ${MAX_ELEMENTS} elements. Split it into smaller parts.` };
    throw e;
  }
  const blocks = placeholders(nodes.flatMap((n) => toPiece(n, {}, {})));
  if (!blocks.length) return { ok: false, error: "There's nothing to show in that HTML." };
  return { ok: true, blocks, removed: report.lines() };
}
