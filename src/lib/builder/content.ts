/*
 * Content, the WordPress part of the builder: collections (a blog, a team, projects) with typed fields and items,
 * site menus, and page SEO. All of it lives in the site document and is checked here, so stored or submitted
 * content can't carry anything unsafe. No React, no DOM.
 *
 *   Collection list  a group with `list` (the collection, how many, in what order). Its first child is the card
 *                    design; the others are written out as copies of it, one per item (listCopy), filled from the
 *                    item through the pieces' bindings. They're ordinary pieces, so every renderer shows them.
 *   Bindings         a piece's `bind` says which of its props come from the item: { content: "title" }, { src: "image" },
 *                    { href: "@page" } (the item's own page).
 *   Item pages       a page whose root has `itemsOf` shows one item of that collection at /<page path>/<item slug>;
 *                    its bound pieces are filled when it's shown (bindBlocks).
 *   Menus            a group with `menu` ("main" or "footer") is written out from the site's menu, using its first
 *                    link as the design for every entry.
 */
import { isSlot, mapBlocks, withFreshIds, type BlockItem } from "./blocks";

export type FieldType = "text" | "longtext" | "image" | "link" | "date";
export interface CollectionField {
  key: string;
  label: string;
  type: FieldType;
}
export interface CollectionItem {
  id: string;
  slug: string;
  values: Record<string, string>;
}
export interface Collection {
  id: string;
  name: string;
  /** Singular, for buttons ("Add post"). */
  itemName: string;
  fields: CollectionField[];
  items: CollectionItem[];
}
export interface MenuItem {
  id: string;
  label: string;
  /** "page:<id>" or a web address / #section. */
  href: string;
}
export type MenuName = "main" | "footer";
export type Menus = Partial<Record<MenuName, MenuItem[]>>;
export interface PageSeo {
  title?: string;
  description?: string;
  image?: string;
}
export interface ListSettings {
  collection: string;
  limit?: number;
  sort?: "newest" | "oldest" | "title" | "manual";
}

export const MAX_COLLECTIONS = 10;
export const MAX_FIELDS = 20;
export const MAX_ITEMS = 200;
export const MAX_MENU = 30;
export const ITEM_PAGE = "@page";

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const KEY = /^[a-z][a-z0-9_]{0,31}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SAFE_LINK = /^(https?:\/\/|mailto:|tel:|#|\/(?!\/)|page:[\w-]{1,40}(\/[a-z0-9-]{1,80})?$)/i;
// The same pictures a design piece may show (server/builder/piece-validation.ts): web images and template files.
const SAFE_IMAGE = /^(https:\/\/|\/(build\/t|builder-templates)\/[a-z0-9-]+\/v\d+\/|\/api\/builder\/media\/)(?!.*\.\.)[^\s'"()\\<>]+$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIELD_TYPES: FieldType[] = ["text", "longtext", "image", "link", "date"];

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
export const shortId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function slugify(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
}
export function uniqueSlug(text: string, taken: string[]): string {
  const base = slugify(text);
  let s = base;
  for (let n = 2; taken.includes(s); n++) s = `${base}-${n}`;
  return s;
}

/** A field's value made safe for its type ("" when it isn't one). */
export function fieldValue(type: FieldType, v: unknown): string {
  if (typeof v !== "string") return "";
  if (type === "image") return SAFE_IMAGE.test(v.trim()) ? v.trim().slice(0, 2000) : "";
  if (type === "link") return SAFE_LINK.test(v.trim()) ? v.trim().slice(0, 2000) : "";
  if (type === "date") return DATE.test(v) ? v : "";
  return v.slice(0, type === "longtext" ? 10_000 : 300);
}

export function normalizeCollections(raw: unknown): Collection[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = new Set<string>();
  const out = raw.slice(0, MAX_COLLECTIONS).flatMap((c): Collection[] => {
    if (!isRecord(c) || typeof c.id !== "string" || !ID.test(c.id) || ids.has(c.id)) return [];
    ids.add(c.id);
    const keys = new Set<string>();
    const fields = (Array.isArray(c.fields) ? c.fields : []).slice(0, MAX_FIELDS).flatMap((f): CollectionField[] => {
      if (!isRecord(f) || typeof f.key !== "string" || !KEY.test(f.key) || keys.has(f.key) || !FIELD_TYPES.includes(f.type as FieldType)) return [];
      keys.add(f.key);
      return [{ key: f.key, label: str(f.label, 40) || f.key, type: f.type as FieldType }];
    });
    const itemIds = new Set<string>();
    const slugs = new Set<string>();
    const items = (Array.isArray(c.items) ? c.items : []).slice(0, MAX_ITEMS).flatMap((it): CollectionItem[] => {
      if (!isRecord(it) || typeof it.id !== "string" || !ID.test(it.id) || itemIds.has(it.id) || typeof it.slug !== "string" || !SLUG.test(it.slug) || it.slug.length > 80 || slugs.has(it.slug)) return [];
      itemIds.add(it.id);
      slugs.add(it.slug);
      const values: Record<string, string> = {};
      const src = isRecord(it.values) ? it.values : {};
      for (const f of fields) {
        const v = fieldValue(f.type, src[f.key]);
        if (v) values[f.key] = v;
      }
      return [{ id: it.id, slug: it.slug, values }];
    });
    return [{ id: c.id, name: str(c.name, 40) || "Collection", itemName: str(c.itemName, 30) || "item", fields, items }];
  });
  return out.length ? out : undefined;
}

export function normalizeMenus(raw: unknown): Menus | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Menus = {};
  for (const name of ["main", "footer"] as MenuName[]) {
    const list = raw[name];
    if (!Array.isArray(list)) continue;
    out[name] = list.slice(0, MAX_MENU).flatMap((m): MenuItem[] =>
      isRecord(m) && typeof m.id === "string" && ID.test(m.id) && typeof m.href === "string" && SAFE_LINK.test(m.href) ? [{ id: m.id, label: str(m.label, 60) || "Link", href: m.href.slice(0, 2000) }] : [],
    );
  }
  return Object.keys(out).length ? out : undefined;
}

export function normalizeSeo(raw: unknown): PageSeo | undefined {
  if (!isRecord(raw)) return undefined;
  const seo: PageSeo = {};
  const title = str(raw.title, 70).trim();
  const description = str(raw.description, 300).trim();
  const image = typeof raw.image === "string" && SAFE_IMAGE.test(raw.image.trim()) ? raw.image.trim() : "";
  if (title) seo.title = title;
  if (description) seo.description = description;
  if (image) seo.image = image;
  return Object.keys(seo).length ? seo : undefined;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Ready-made collections.
 * ---------------------------------------------------------------------------------------------------------------- */

export function blogCollection(taken: string[] = []): Collection {
  let id = "blog";
  for (let n = 2; taken.includes(id); n++) id = `blog-${n}`;
  const today = new Date().toISOString().slice(0, 10);
  const post = (title: string, excerpt: string): CollectionItem => ({
    id: shortId("i"),
    slug: slugify(title),
    values: { title, excerpt, date: today, body: `${excerpt}\n\nWrite the rest of the post here.` },
  });
  return {
    id,
    name: "Blog",
    itemName: "post",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "excerpt", label: "Summary", type: "longtext" },
      { key: "image", label: "Image", type: "image" },
      { key: "date", label: "Date", type: "date" },
      { key: "body", label: "Text", type: "longtext" },
    ],
    items: [
      post("Our first post", "A short summary of what this post is about."),
      post("Behind the scenes", "How the work gets done, step by step."),
      post("Three tips for getting started", "Practical advice for new customers."),
    ],
  };
}

export const emptyCollection = (name: string, taken: string[]): Collection => {
  let id = slugify(name).slice(0, 30) || "collection";
  for (let n = 2; taken.includes(id); n++) id = `${slugify(name).slice(0, 30)}-${n}`;
  return { id, name: name.slice(0, 40), itemName: "item", fields: [{ key: "title", label: "Title", type: "text" }, { key: "image", label: "Image", type: "image" }, { key: "text", label: "Text", type: "longtext" }], items: [] };
};

/* ------------------------------------------------------------------------------------------------------------------
 * Lists, bindings and item pages.
 * ---------------------------------------------------------------------------------------------------------------- */

/** The items a list shows, in its order and up to its limit. */
export function listItems(c: Collection, s: Pick<ListSettings, "limit" | "sort">): CollectionItem[] {
  const items = [...c.items];
  const date = (i: CollectionItem) => i.values.date ?? "";
  if (s.sort === "newest") items.sort((a, b) => date(b).localeCompare(date(a)));
  else if (s.sort === "oldest") items.sort((a, b) => date(a).localeCompare(date(b)));
  else if (s.sort === "title") items.sort((a, b) => (a.values.title ?? "").localeCompare(b.values.title ?? ""));
  return items.slice(0, Math.max(1, Math.min(MAX_ITEMS, s.limit ?? MAX_ITEMS)));
}

/** The link to an item's own page: "page:<page id>/<slug>" (resolved like any page link). */
export const itemHref = (pageId: string | undefined, item: CollectionItem) => (pageId ? `page:${pageId}/${item.slug}` : "#");

/** A date field shown as text ("Oct 14, 2026"), as dates appear elsewhere on the site. */
const showDate = (v: string) => {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

/**
 * Which props come from which field. A text's words are bound as `content` (not `text`): the editor rewrites every
 * `text` key in a block's props for typing on the canvas, nested ones too, which would swallow the field's name.
 */
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Plain text as HTML paragraphs (a blank line starts a new one, a line break stays one), every character escaped. */
export function textToParagraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.replace(/[&<>"']/g, (c) => ESCAPES[c]!).split("\n").join("<br>")}</p>`)
    .join("");
}

/** What textToParagraphs makes, and nothing else: paragraphs and line breaks around escaped text. */
export const PLAIN_PARAGRAPHS = /^(?:<p>[^<>]*(?:<br>[^<>]*)*<\/p>)*$/;

export type Binding = Partial<Record<"content" | "rich" | "src" | "href" | "bg" | "alt", string>>;

/** One block's bound props filled from `item` (not the blocks inside it). */
export function bindProps(b: BlockItem, c: Collection, item: CollectionItem, itemPageId: string | undefined): BlockItem {
  const bind = b.props.bind as Binding | undefined;
  if (!bind || typeof bind !== "object") return b;
  const props: BlockItem["props"] = { ...b.props };
  for (const [prop, key] of Object.entries(bind)) {
    if (!key) continue;
    if (key === ITEM_PAGE) {
      if (prop === "href") props.href = itemHref(itemPageId, item);
      continue;
    }
    const raw = item.values[key] ?? "";
    const v = c.fields.find((f) => f.key === key)?.type === "date" && raw ? showDate(raw) : raw;
    // Rich text shows a field as plain paragraphs: the field's text is escaped, never read as HTML.
    if (prop === "rich") {
      props.html = textToParagraphs(v);
      continue;
    }
    if (prop === "content") {
      props.text = v;
      props.runs = [];
    } else props[prop] = v;
  }
  return { ...b, props };
}

/** Blocks with their bound props filled from `item` (blocks inside too). */
export function bindBlocks(blocks: BlockItem[], c: Collection, item: CollectionItem, itemPageId: string | undefined): BlockItem[] {
  return mapBlocks(blocks, (b) => bindProps(b, c, item, itemPageId));
}

/**
 * A list group written out for its collection: the first child stays the (editable) card design, filled with the
 * first item; every other item gets a copy of it. Returns null when nothing changed.
 */
export function syncList(box: BlockItem, collections: Collection[] | undefined, itemPageFor: (collectionId: string) => string | undefined): BlockItem | null {
  const settings = box.props.list as ListSettings | undefined;
  const kids = isSlot(box.props.items) ? (box.props.items as BlockItem[]) : [];
  const design = kids.find((k) => !k.props.listCopy);
  const c = collections?.find((x) => x.id === settings?.collection);
  if (!settings || !design || !c) return null;
  const items = listItems(c, settings);
  const page = itemPageFor(c.id);
  const cards = items.map((item, i) => {
    if (i === 0) return bindBlocks([design], c, item, page)[0]!;
    // A copy's ids come from the design's and the item's: unique, and the same at every sync. Copies can't be
    // edited on their own (the design is the first card).
    const copy = mapBlocks([design], (b) => ({ ...b, props: { ...b.props, id: `${String(b.props.id)}~${item.id}` } }))[0]!;
    const filled = bindBlocks([copy], c, item, page)[0]!;
    return { ...filled, props: { ...filled.props, listCopy: true, listItem: item.id, name: undefined } };
  });
  if (!items.length) cards.push(design);
  const next = { ...box, props: { ...box.props, items: cards } };
  return JSON.stringify(next) === JSON.stringify(box) ? null : next;
}

/** A menu group written out from the site's menu: its first link is the design for every entry. Null if unchanged. */
export function syncMenu(box: BlockItem, menus: Menus | undefined): BlockItem | null {
  const name = box.props.menu as MenuName | undefined;
  const kids = isSlot(box.props.items) ? (box.props.items as BlockItem[]) : [];
  // The design: a plain link (not one styled as the current page), else the first.
  const current = (k: BlockItem) => !!(k.props.attrs as Record<string, unknown> | undefined)?.["aria-current"];
  const design = kids.find((k) => k.type === "DLink" && !current(k)) ?? kids.find((k) => k.type === "DLink") ?? kids[0];
  const entries = name ? menus?.[name] : undefined;
  if (!name || !design || !entries?.length) return null;
  const old = kids.filter((k) => k.type === design.type);
  const links = entries.map((m, i) => {
    const base = old[i] ?? withFreshIds([design])[0]!;
    const { "aria-current": _current, ...attrs } = (design.props.attrs ?? {}) as Record<string, unknown>;
    const props: BlockItem["props"] = { ...design.props, attrs: Object.keys(attrs).length ? attrs : undefined, id: base.props.id, href: m.href, menuItem: m.id };
    if (design.type === "DLink") {
      props.textOnly = true;
      props.text = m.label;
      props.items = [];
    } else props.text = m.label;
    return { ...design, props };
  });
  const next = { ...box, props: { ...box.props, items: links } };
  return JSON.stringify(next) === JSON.stringify(box) ? null : next;
}

/** Every list and menu on a page written out (null when nothing changed). */
export function syncContentBlocks(content: BlockItem[], collections: Collection[] | undefined, menus: Menus | undefined, itemPageFor: (collectionId: string) => string | undefined): BlockItem[] | null {
  let changed = false;
  const next = mapBlocks(content, (b) => {
    if (b.type !== "Box") return b;
    const synced = b.props.list ? syncList(b, collections, itemPageFor) : b.props.menu ? syncMenu(b, menus) : null;
    if (!synced) return b;
    changed = true;
    return synced;
  });
  return changed ? next : null;
}

/** Splits a preview address into a page path and an item slug ("/blog/first-post" → "/blog" + "first-post"). */
export function splitItemPath(path: string): { page: string; slug?: string } {
  const m = path.match(/^(\/[a-z0-9-]+(?:\/[a-z0-9-]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  return m ? { page: m[1]!, slug: m[2]! } : { page: path };
}
