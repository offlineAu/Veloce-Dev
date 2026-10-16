import type { BlockItem } from "./blocks";
import { sectionToElements } from "./elements";
import { newPageId, PAGE_LINK, type SiteDoc, type SitePage } from "./site-doc";
import { normalizeTheme } from "./theme";
import { sectionDefaults, type TemplatePackage, type TemplatePage, type TemplateSection } from "./template-package";

/** In a package, links between its pages are written "tpl:<page key>"; a site stores them as "page:<page id>". */
export const TEMPLATE_LINK = "tpl:";

type Values = Record<string, string>;

const relink = (v: Values, ids: Map<string, string>): Values =>
  Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val.startsWith(TEMPLATE_LINK) && ids.has(val.slice(4)) ? `${PAGE_LINK}${ids.get(val.slice(4))}` : val]));

/** A DesignSection block holding the section's starting content. */
export function sectionBlock(section: TemplateSection, ids: Map<string, string> = new Map()) {
  const { values, items } = sectionDefaults(section);
  return {
    type: "DesignSection",
    props: {
      id: `DesignSection-${crypto.randomUUID()}`,
      sectionId: section.id,
      values: relink(values, ids),
      items: Object.fromEntries(Object.entries(items).map(([k, list]) => [k, list.map((it) => relink(it, ids))])),
    },
  };
}

/**
 * How template sections arrive in a new site: `"pieces"` (what the editor uses) takes each one apart into design
 * pieces, so the header, images, buttons and cards can be dragged and styled straight away; `"locked"` keeps one
 * DesignSection per section, for read-only previews and the team's section-by-section template review.
 */
export type TemplateSections = "pieces" | "locked";

/** A template section as design pieces, with its starting content and links between pages filled in. */
export function sectionPieces(section: TemplateSection, ids: Map<string, string> = new Map()): BlockItem {
  const { props } = sectionBlock(section, ids);
  const root = sectionToElements(section, props.values, props.items);
  // Named after the template's section ("Immersive Editorial Hero"), in the layers panel and the block toolbar.
  return { ...root, props: { ...root.props, name: section.label.slice(0, 60) } };
}

function page(pkg: TemplatePackage, tp: TemplatePage, id: string, ids: Map<string, string>, sections: TemplateSections): SitePage {
  const theme = normalizeTheme(pkg.theme);
  return {
    id,
    path: tp.key ? `/${tp.key}` : "/",
    title: tp.title,
    data: { root: { props: { title: tp.title, theme, frame: tp.frame } }, content: tp.sections.map((s) => (sections === "pieces" ? sectionPieces(s, ids) : sectionBlock(s, ids))) },
  };
}

/** A new site made from every page of an imported template. */
export function docFromTemplate(pkg: TemplatePackage, sections: TemplateSections = "locked"): SiteDoc {
  const ids = new Map(pkg.pages.map((p) => [p.key, newPageId()]));
  return {
    version: 2,
    theme: normalizeTheme(pkg.theme),
    templateRef: { slug: pkg.slug, version: pkg.version },
    pages: pkg.pages.map((p) => page(pkg, p, ids.get(p.key)!, ids, sections)),
  };
}

/** Template page key → id of the site's page at the same path, so a section added later links to the site's pages. */
export function templatePageIds(pkg: TemplatePackage, pages: Pick<SitePage, "id" | "path">[]): Map<string, string> {
  const ids = new Map<string, string>();
  for (const p of pkg.pages) {
    const existing = pages.find((x) => x.path === (p.key ? `/${p.key}` : "/"));
    if (existing) ids.set(p.key, existing.id);
  }
  return ids;
}

/** One template page added to an existing site (its links to pages the site doesn't have stay as they were). */
export function pageFromTemplate(pkg: TemplatePackage, pageKey: string, doc: SiteDoc, sections: TemplateSections = "locked"): SitePage | undefined {
  const tp = pkg.pages.find((p) => p.key === pageKey);
  if (!tp) return undefined;
  return page(pkg, tp, newPageId(), templatePageIds(pkg, doc.pages), sections);
}
