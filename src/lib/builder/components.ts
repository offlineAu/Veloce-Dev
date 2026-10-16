/*
 * Reusable components (as in Figma): any block can become a component. The block stays where it is as the main
 * component; copies of it ("instances") can go anywhere on any page. When the main one changes, every copy takes
 * the change (structure, layout, styles) but keeps its own texts, images and links where they were changed in that
 * copy. A copy can be detached to become an ordinary block again.
 *
 * Every block inside a component carries a `ckey`, the same in the main one and its copies, so parts can be
 * matched up. SiteDoc.components keeps the main block as last synced: comparing a copy's values with it tells an
 * override (changed in the copy) from a value that should follow the main one. No React.
 */
import { isSlot, mapBlocks, withFreshIds, type BlockItem } from "./blocks";
import type { ComponentDef, SiteDoc } from "./site-doc";

export type ComponentRef = { id: string; main?: boolean };

/** What a copy may change and keep: words, pictures, links (never structure or styling). */
const CONTENT = ["text", "runs", "src", "alt", "href", "bg", "label", "title", "subtitle", "description", "body", "quote", "author"];

const shortId = () => Math.random().toString(36).slice(2, 10);
export const newComponentId = () => `c-${shortId()}`;

export const componentOf = (b: BlockItem) => b.props.component as ComponentRef | undefined;

/** Gives every block in `block` a ckey (keeping existing ones). */
export function ensureKeys(block: BlockItem): BlockItem {
  return mapBlocks([block], (b) => (typeof b.props.ckey === "string" ? b : { ...b, props: { ...b.props, ckey: `k-${shortId()}` } }))[0]!;
}

/** `block` made into the main component `id`, and its definition. */
export function makeComponent(block: BlockItem, id: string, name: string): { main: BlockItem; def: ComponentDef } {
  const keyed = ensureKeys(block);
  const main = { ...keyed, props: { ...keyed.props, component: { id, main: true } satisfies ComponentRef } };
  return { main, def: { name: name.slice(0, 40) || "Component", block: main } };
}

/** A new copy of a component, with fresh ids (and its keys kept, so it follows the main one). */
export function instanceOf(main: BlockItem, id: string): BlockItem {
  const [copy] = withFreshIds([main]);
  return { ...copy!, props: { ...copy!.props, component: { id } satisfies ComponentRef, name: undefined } };
}

/** A copy back to an ordinary block: it stops following the main one. */
export function detach(block: BlockItem): BlockItem {
  return mapBlocks([block], (b) => {
    const { component: _c, ckey: _k, ...props } = b.props;
    return { ...b, props };
  })[0]!;
}

/** The blocks of a tree by ckey. */
function byKey(block: BlockItem): Map<string, BlockItem> {
  const out = new Map<string, BlockItem>();
  const walk = (b: BlockItem) => {
    if (typeof b.props.ckey === "string") out.set(b.props.ckey, b);
    for (const v of Object.values(b.props)) if (isSlot(v)) v.forEach(walk);
  };
  walk(block);
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** A tree without ids (and without the main/copy marker): what "the same design" compares. */
function design(block: BlockItem): unknown {
  return mapBlocks([block], (b) => {
    const { id: _id, component: _c, name: _n, ...props } = b.props;
    return { ...b, props };
  });
}
export const sameDesign = (a: BlockItem, b: BlockItem) => same(design(a), design(b));

/**
 * A copy updated to the main one's design. `prev` is the main one as last synced: a copy value that differs from it
 * was changed in the copy and is kept. Parts keep their ids, so selection survives.
 */
export function syncInstance(main: BlockItem, prev: BlockItem, inst: BlockItem): BlockItem {
  const mine = byKey(inst);
  const before = byKey(prev);
  const ref = componentOf(inst)!;
  const [fresh] = withFreshIds([main]);
  const synced = mapBlocks([fresh!], (b) => {
    const key = b.props.ckey as string | undefined;
    const own = key ? mine.get(key) : undefined;
    if (!own) return b;
    const props: BlockItem["props"] = { ...b.props, id: own.props.id };
    const was = key ? before.get(key) : undefined;
    for (const f of CONTENT) if (f in own.props && !same(own.props[f], was?.props[f])) props[f] = own.props[f];
    // Layer flags are the copy's own.
    for (const f of ["hidden", "locked", "name"]) if (f in own.props) props[f] = own.props[f];
    return { ...b, props };
  })[0]!;
  return { ...synced, props: { ...synced.props, id: inst.props.id, component: { id: ref.id } } };
}

/** Every main component in a page's blocks. */
export function mainsIn(content: BlockItem[]): BlockItem[] {
  const out: BlockItem[] = [];
  const walk = (b: BlockItem) => {
    if (componentOf(b)?.main) out.push(b);
    for (const v of Object.values(b.props)) if (isSlot(v)) v.forEach(walk);
  };
  content.forEach(walk);
  return out;
}

/** A page's blocks with every copy of `id` synced to `main` (null when none changed). */
export function syncContent(content: BlockItem[], id: string, main: BlockItem, prev: BlockItem): BlockItem[] | null {
  let changed = false;
  const next = mapBlocks(content, (b) => {
    const ref = componentOf(b);
    if (!ref || ref.main || ref.id !== id) return b;
    const synced = syncInstance(main, prev, b);
    if (sameDesign(synced, b) && same(synced.props.id, b.props.id)) return b;
    changed = true;
    return synced;
  });
  return changed ? next : null;
}

/**
 * The site after a main component changed: its definition updated and the copies on every page except `skipPage`
 * (the open page, which the editor updates itself) synced.
 */
export function syncDoc(doc: SiteDoc, id: string, main: BlockItem, skipPage?: string): SiteDoc {
  const def = doc.components?.[id];
  if (!def) return doc;
  const prev = def.block;
  return {
    ...doc,
    components: { ...doc.components, [id]: { ...def, block: main } },
    pages: doc.pages.map((p) => {
      if (p.id === skipPage) return p;
      const content = syncContent(p.data.content, id, main, prev);
      return content ? { ...p, data: { ...p.data, content } } : p;
    }),
  };
}

/** Where a component's main block is (page and block), if it's still on the site. */
export function findMain(doc: SiteDoc, id: string): { pageId: string; block: BlockItem } | undefined {
  for (const p of doc.pages) {
    const m = mainsIn(p.data.content).find((b) => componentOf(b)?.id === id);
    if (m) return { pageId: p.id, block: m };
  }
  return undefined;
}
