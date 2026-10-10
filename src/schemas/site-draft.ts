import { z } from "zod";
import { BLOCK_TYPES, mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import { sanitizeHtmlOnServer } from "@/server/builder/sanitize-html";
import { MAX_PAGES, PATH_RE, migrateDoc, type SiteDoc } from "@/lib/builder/site-doc";
import { checkDesignSections } from "@/server/builder/design-validation";

const KNOWN = new Set<string>(BLOCK_TYPES);

/** Upper bound on a whole site once serialised. Imported sections store only their text and links, not markup. */
export const MAX_SITE_BYTES = 1_000_000;
const MAX_BLOCKS_PER_PAGE = 200;

/**
 * A site designed in the /build editor: one page (drafts from the first version) or several. Normalised to the
 * current shape; every block must be one the editor knows, Custom HTML is sanitised again, imported-template
 * sections are checked against their package, and the size is capped.
 */
export const siteDraftSchema = z
  .object({
    templateId: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
    data: z.unknown(),
  })
  .transform(async (v, ctx) => {
    if (JSON.stringify(v.data ?? null).length > MAX_SITE_BYTES) {
      ctx.addIssue({ code: "custom", message: "This design is too large to send. Remove some blocks and try again." });
      return z.NEVER;
    }
    const doc = migrateDoc(v.data);
    if (!doc) {
      ctx.addIssue({ code: "custom", message: "We couldn't read your design." });
      return z.NEVER;
    }
    const problem = await checkSite(doc);
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
      return z.NEVER;
    }
    return { templateId: v.templateId, data: sanitizeSite(doc) };
  });

async function checkSite(doc: SiteDoc): Promise<string | null> {
  if (doc.pages.length > MAX_PAGES) return `A design can have up to ${MAX_PAGES} pages.`;
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const p of doc.pages) {
    if (!/^[\w-]{1,40}$/.test(p.id) || ids.has(p.id)) return "We couldn't read your design.";
    if (!PATH_RE.test(p.path) || paths.has(p.path)) return `The page address “${p.path.slice(0, 40)}” is not valid.`;
    if (p.title.length > 60) return "A page name is too long.";
    ids.add(p.id);
    paths.add(p.path);
    if (p.data.content.length > MAX_BLOCKS_PER_PAGE) return `“${p.title}” has too many blocks.`;
    let unknown: string | null = null;
    mapBlocks(p.data.content, (b) => {
      if (!KNOWN.has(b.type)) unknown ??= b.type;
      return b;
    });
    if (unknown) return `Unknown block "${String(unknown).slice(0, 40)}".`;
  }
  return checkDesignSections(doc);
}

const sanitizeBlocks = (items: BlockItem[]) =>
  mapBlocks(items, (b) =>
    b.type === "CustomHtml" && typeof b.props.html === "string" ? { ...b, props: { ...b.props, html: sanitizeHtmlOnServer(b.props.html) } } : b,
  );

function sanitizeSite(doc: SiteDoc): SiteDoc {
  return { ...doc, pages: doc.pages.map((p) => ({ ...p, data: { ...p.data, content: sanitizeBlocks(p.data.content) } })) };
}

export type SiteDraftInput = z.input<typeof siteDraftSchema>;
export type SiteDraftData = z.output<typeof siteDraftSchema>;
