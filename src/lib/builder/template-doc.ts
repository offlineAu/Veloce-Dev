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

function page(pkg: TemplatePackage, tp: TemplatePage, id: string, ids: Map<string, string>): SitePage {
  const theme = normalizeTheme(pkg.theme);
  return {
    id,
    path: tp.key ? `/${tp.key}` : "/",
    title: tp.title,
    data: { root: { props: { title: tp.title, theme, frame: tp.frame } }, content: tp.sections.map((s) => sectionBlock(s, ids)) },
  };
}

/** A new site made from every page of an imported template. */
export function docFromTemplate(pkg: TemplatePackage): SiteDoc {
  const ids = new Map(pkg.pages.map((p) => [p.key, newPageId()]));
  return {
    version: 2,
    theme: normalizeTheme(pkg.theme),
    templateRef: { slug: pkg.slug, version: pkg.version },
    pages: pkg.pages.map((p) => page(pkg, p, ids.get(p.key)!, ids)),
  };
}

/** One template page added to an existing site (its links to pages the site doesn't have stay as they were). */
export function pageFromTemplate(pkg: TemplatePackage, pageKey: string, doc: SiteDoc): SitePage | undefined {
  const tp = pkg.pages.find((p) => p.key === pageKey);
  if (!tp) return undefined;
  const ids = new Map<string, string>();
  for (const p of pkg.pages) {
    const existing = doc.pages.find((x) => x.path === (p.key ? `/${p.key}` : "/"));
    if (existing) ids.set(p.key, existing.id);
  }
  return page(pkg, tp, newPageId(), ids);
}
