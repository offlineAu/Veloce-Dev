/* Shared by the editor (browser) and draft validation (server), so it holds no React. */

export const BLOCK_TYPES = [
  "Section",
  "Columns",
  "Spacer",
  "Divider",
  "Heading",
  "Text",
  "Image",
  "ButtonLink",
  "List",
  "Hero",
  "Features",
  "Pricing",
  "Testimonials",
  "Faq",
  "CtaBand",
  "Contact",
  "CustomHtml",
  "DesignSection",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export interface BlockItem {
  type: string;
  props: Record<string, unknown> & { id?: string };
}

const isBlock = (v: unknown): v is BlockItem =>
  !!v && typeof v === "object" && typeof (v as BlockItem).type === "string" && !!(v as BlockItem).props && typeof (v as BlockItem).props === "object";

/** Slot props (nested blocks) are arrays of block items. */
const isSlot = (v: unknown): v is BlockItem[] => Array.isArray(v) && v.length > 0 && v.every(isBlock);

/** Calls `visit` on every block, including those nested in slots. `visit` may return a replacement. */
export function mapBlocks(items: BlockItem[], visit: (b: BlockItem) => BlockItem): BlockItem[] {
  return items.map((item) => {
    const props: BlockItem["props"] = {};
    for (const [k, v] of Object.entries(item.props)) props[k] = isSlot(v) ? mapBlocks(v, visit) : v;
    return visit({ ...item, props });
  });
}

/** Gives a block (and everything inside it) fresh ids, so a saved section or template can be inserted twice. */
export function withFreshIds(items: BlockItem[]): BlockItem[] {
  return mapBlocks(items, (b) => ({ ...b, props: { ...b.props, id: `${b.type}-${crypto.randomUUID()}` } }));
}
