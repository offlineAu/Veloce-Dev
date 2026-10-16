import "server-only";
import type { BlockItem } from "@/lib/builder/blocks";
import { BOX_TAGS, ELEMENT_TYPES, FIELD_TAGS, INLINE_TAGS, PIECE_ATTRS, TEXT_TAGS } from "@/lib/builder/elements";
import { ITEM_PAGE, MAX_ITEMS } from "@/lib/builder/content";
import { isMediaSrc } from "@/lib/builder/media";
import { BEHAVIOUR_ATTR, parseBehaviour } from "@/lib/builder/behaviours";
import { PAGE_LINK, pageLinkTarget } from "@/lib/builder/site-doc";
import type { TemplatePackage, TreeNode } from "@/lib/builder/template-package";
import { isOwnAsset } from "./template-registry";

/*
 * Checks on design pieces (Box, DText, DLink…) in a submitted design. The renderer is already safe on its own
 * (allow-listed tags and attributes, no handlers, filtered links and styles); these keep stored designs clean and
 * bounded.
 */

const PIECES = new Set<string>(ELEMENT_TYPES);
const MAX_PIECES = 3000;
const MAX_DEPTH = 40;
const MAX_TEXT = 2000;
const MAX_RICH = 20_000;
const CLASS_TOKEN = /^[\w:/[\]().%#,!'"&>*+~=@-]{1,200}$/;
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i;
const UNSAFE_CSS = /url\(|expression\(|javascript:|@import/i;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isSlot = (v: unknown): v is BlockItem[] => Array.isArray(v) && v.every((x) => isRecord(x) && typeof x.type === "string" && isRecord(x.props));

function classes(v: unknown): boolean {
  if (v === undefined) return true;
  if (typeof v !== "string" || v.length > 4000) return false;
  return v.split(/\s+/).filter(Boolean).every((t) => CLASS_TOKEN.test(t));
}

function attrs(v: unknown): boolean {
  if (v === undefined) return true;
  if (!isRecord(v) || Object.keys(v).length > 30) return false;
  return Object.entries(v).every(
    ([k, x]) =>
      PIECE_ATTRS.test(k) &&
      (typeof x === "boolean" || typeof x === "number" || (typeof x === "string" && x.length <= 300)) &&
      // Interactions must be ones the runtime knows, with values it accepts (lib/builder/behaviours.ts).
      (!BEHAVIOUR_ATTR.test(k) || parseBehaviour(k, x) !== null),
  );
}

function style(v: unknown): boolean {
  if (v === undefined) return true;
  if (!isRecord(v) || Object.keys(v).length > 40) return false;
  return Object.entries(v).every(([k, x]) => /^-?-?[a-zA-Z][\w-]*$/.test(k) && typeof x === "string" && x.length <= 300 && !UNSAFE_CSS.test(x));
}

function href(v: unknown, pageIds: Set<string>): boolean {
  if (v === undefined || v === "") return true;
  if (typeof v !== "string" || v.length > 2000) return false;
  return v.startsWith(PAGE_LINK) ? pageIds.has(pageLinkTarget(v)?.pageId ?? "") : SAFE_URL.test(v);
}

const BIND_PROPS = new Set(["content", "rich", "src", "href", "bg", "alt"]);
const FIELD_KEY = /^[a-z][a-z0-9_]{0,31}$/;
const CONTENT_ID = /^[\w~-]{1,90}$/;

/** Collection content on a piece (content.ts): what it shows of an item, the list it repeats, the menu it follows. */
function content(p: Record<string, unknown>): boolean {
  if (p.bind !== undefined && !(isRecord(p.bind) && Object.entries(p.bind).every(([k, v]) => BIND_PROPS.has(k) && (v === undefined || v === ITEM_PAGE || (typeof v === "string" && FIELD_KEY.test(v)))))) return false;
  if (p.list !== undefined) {
    const l = p.list;
    if (!isRecord(l) || typeof l.collection !== "string" || !CONTENT_ID.test(l.collection)) return false;
    if (l.sort !== undefined && !["newest", "oldest", "title", "manual"].includes(String(l.sort))) return false;
    if (l.limit !== undefined && !(Number.isInteger(l.limit) && (l.limit as number) >= 1 && (l.limit as number) <= MAX_ITEMS)) return false;
  }
  if (p.listCopy !== undefined && typeof p.listCopy !== "boolean") return false;
  if (p.menu !== undefined && p.menu !== "main" && p.menu !== "footer") return false;
  return [p.listItem, p.menuItem].every((v) => v === undefined || (typeof v === "string" && CONTENT_ID.test(v)));
}

function src(v: unknown, pkg: TemplatePackage | undefined): boolean {
  if (v === undefined || v === "") return true;
  if (typeof v !== "string" || v.length > 2000 || v.includes("..")) return false;
  return /^https:\/\//i.test(v) || isMediaSrc(v) || (pkg ? isOwnAsset(pkg, v) : false) || /^\/(build\/t|builder-templates)\/[a-z0-9-]+\/v\d+\//.test(v);
}

/** A whole element kept as-is (DRaw): bounded, no handlers, no script-like tags. */
function rawTree(node: unknown, budget: { n: number }, depth = 0): boolean {
  if (typeof node === "string") return node.length <= MAX_TEXT;
  if (!isRecord(node) || ++budget.n > 400 || depth > 30) return false;
  if (typeof node.t !== "string" || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(node.t) || /^(script|style|iframe|object|embed|link|meta|base)$/i.test(node.t)) return false;
  if (node.a !== undefined && (!isRecord(node.a) || Object.keys(node.a).some((k) => /^on/i.test(k) || k === "dangerouslySetInnerHTML"))) return false;
  if (node.a && Object.values(node.a).some((x) => typeof x === "string" && /^\s*(javascript|vbscript|data:text)/i.test(x))) return false;
  return node.c === undefined || (Array.isArray(node.c) && (node.c as TreeNode[]).every((c) => rawTree(c, budget, depth + 1)));
}

function checkPiece(b: BlockItem, pkg: TemplatePackage | undefined, pageIds: Set<string>): string | null {
  const p = b.props;
  if (!classes(p.className) || !attrs(p.attrs) || !style(p.style)) return "styling not allowed";
  if (p.name !== undefined && (typeof p.name !== "string" || p.name.length > 60)) return "layer name too long";
  // Layer flags (hidden, locked) and group modes (free layout, decoration) are switches.
  for (const flag of ["hidden", "locked", "free", "decor"]) if (p[flag] !== undefined && typeof p[flag] !== "boolean") return "layer settings not allowed";
  // A text style it follows, its part in a component (and the key matching it to the main one's part).
  if (p.textStyle !== undefined && (typeof p.textStyle !== "string" || !/^[a-z0-9-]{1,40}$/.test(p.textStyle))) return "text style not allowed";
  if (!content(p)) return "collection settings not allowed";
  if (p.ckey !== undefined && (typeof p.ckey !== "string" || !/^k-[a-z0-9]{1,16}$/.test(p.ckey))) return "component not allowed";
  if (p.component !== undefined) {
    const c = p.component as { id?: unknown; main?: unknown };
    if (!isRecord(c) || typeof c.id !== "string" || !/^c-[a-z0-9]{4,16}$/.test(c.id) || (c.main !== undefined && typeof c.main !== "boolean")) return "component not allowed";
  }
  switch (b.type) {
    case "Box":
      if (!src(p.bg, pkg)) return "image address not allowed";
      return typeof p.tag === "string" && BOX_TAGS.has(p.tag) ? null : "unknown element";
    case "DText": {
      if (typeof p.tag !== "string" || (p.tag !== "" && !TEXT_TAGS.has(p.tag))) return "unknown element";
      if (typeof p.text !== "string" || p.text.length > MAX_TEXT) return "text too long";
      const runs = p.runs ?? [];
      if (!Array.isArray(runs) || runs.length > 60) return "text too long";
      const ok = runs.every((r) => isRecord(r) && typeof r.text === "string" && r.text.length <= MAX_TEXT && (r.tag === undefined || (typeof r.tag === "string" && INLINE_TAGS.has(r.tag))) && classes(r.className));
      return ok ? null : "text not allowed";
    }
    case "DImage":
      return src(p.src, pkg) && typeof p.alt === "string" && p.alt.length <= 300 ? null : "image address not allowed";
    case "DLink":
      if (p.text !== undefined && (typeof p.text !== "string" || p.text.length > MAX_TEXT)) return "text too long";
      if (p.textOnly !== undefined && typeof p.textOnly !== "boolean") return "link not allowed";
      return (p.tag === "a" || p.tag === "button") && href(p.href, pageIds) ? null : "link address not allowed";
    case "DIcon":
      return typeof p.name === "string" && /^[a-z0-9_]{0,40}$/.test(p.name) && typeof p.tag === "string" && INLINE_TAGS.has(p.tag) ? null : "icon not allowed";
    case "DField": {
      if (typeof p.tag !== "string" || !FIELD_TAGS.has(p.tag)) return "unknown element";
      const options = p.options ?? [];
      return Array.isArray(options) && options.length <= 50 && options.every((o) => isRecord(o) && typeof o.value === "string" && typeof o.label === "string" && o.label.length <= 200) ? null : "form field not allowed";
    }
    case "DRaw":
      return rawTree(p.tree, { n: 0 }) ? null : "graphic not allowed";
    case "DRich":
      // Cleaned to the editor's formatting when the design is stored (sanitizeRichText).
      return typeof p.html === "string" && p.html.length <= MAX_RICH ? null : "text too long";
    default:
      return null;
  }
}

/** Checks every design piece on a page (including inside other blocks' slots), with size and depth limits. */
export function checkPieces(content: BlockItem[], pkg: TemplatePackage | undefined, pageIds: Set<string>): string | null {
  let count = 0;
  const visit = (items: BlockItem[], depth: number): string | null => {
    if (depth > MAX_DEPTH) return "nested too deeply";
    for (const b of items) {
      if (PIECES.has(b.type)) {
        if (++count > MAX_PIECES) return "too many parts on one page";
        const why = checkPiece(b, pkg, pageIds);
        if (why) return why;
      }
      for (const v of Object.values(b.props)) {
        if (isSlot(v)) {
          const why = visit(v, depth + 1);
          if (why) return why;
        }
      }
    }
    return null;
  };
  return visit(content, 0);
}
