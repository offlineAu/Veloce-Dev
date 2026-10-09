/*
 * A visitor's whole site: theme, optional imported template, and its pages. Each page holds one editor document
 * (root + content). Shared by the editor, storage, the preview page and the server validator: no React.
 */
import { withFreshIds, type BlockItem } from "./blocks";
import { DEFAULT_THEME, normalizeTheme, themeFromLegacy, type ThemeTokens } from "./theme";

export interface PageData {
  root: { props?: Record<string, unknown> };
  content: BlockItem[];
}

export interface SitePage {
  id: string;
  /** "/" for the home page, otherwise "/slug". */
  path: string;
  title: string;
  data: PageData;
}

export interface TemplateRef {
  slug: string;
  version: number;
}

export interface SiteDoc {
  version: 2;
  theme: ThemeTokens;
  templateRef?: TemplateRef;
  pages: SitePage[];
}

/** A page as other parts of the site see it: enough to list it and link to it. */
export type PageRef = Pick<SitePage, "id" | "path" | "title">;

export const MAX_PAGES = 12;
export const PATH_RE = /^\/([a-z0-9]+(-[a-z0-9]+)*)?$/;
/** Links to another page of the same site are stored by page id, so renaming a page never breaks them. */
export const PAGE_LINK = "page:";

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isPageData = (v: unknown): v is PageData => isRecord(v) && Array.isArray(v.content) && (v.root === undefined || isRecord(v.root));

export const newPageId = () => `p-${crypto.randomUUID().slice(0, 8)}`;

export function slugify(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "page";
}

/** A path for `title` that no other page uses ("/about", "/about-2", …). */
export function uniquePath(pages: Pick<SitePage, "path" | "id">[], title: string, exceptId?: string): string {
  const taken = new Set(pages.filter((p) => p.id !== exceptId).map((p) => p.path));
  const base = `/${slugify(title)}`;
  let path = base;
  for (let n = 2; taken.has(path); n++) path = `${base}-${n}`;
  return path;
}

const emptyPage = (theme: ThemeTokens, title: string): PageData => ({ root: { props: { title, theme } }, content: [] });

export function newDoc(theme: ThemeTokens = DEFAULT_THEME): SiteDoc {
  return { version: 2, theme, pages: [{ id: newPageId(), path: "/", title: "Home", data: emptyPage(theme, "Home") }] };
}

/** One page made into a site, e.g. a starter template or a draft saved before sites had pages. */
export function docFromPage(data: PageData, title = "Home"): SiteDoc {
  const props = data.root.props ?? {};
  const theme = props.theme ? normalizeTheme(props.theme) : themeFromLegacy(props);
  return { version: 2, theme, pages: [{ id: newPageId(), path: "/", title, data: { ...data, root: { props: { ...props, theme } } } }] };
}

/** Reads anything stored before (v1 single page) or now (v2), or returns null when it isn't a site at all. */
export function migrateDoc(raw: unknown): SiteDoc | null {
  if (isRecord(raw) && raw.version === 2 && Array.isArray(raw.pages)) {
    const pages = (raw.pages as unknown[]).filter((p): p is SitePage => isRecord(p) && typeof p.id === "string" && typeof p.path === "string" && isPageData(p.data));
    if (pages.length === 0) return null;
    const templateRef = isRecord(raw.templateRef) && typeof raw.templateRef.slug === "string" && typeof raw.templateRef.version === "number"
      ? { slug: raw.templateRef.slug, version: raw.templateRef.version }
      : undefined;
    return withTheme({ version: 2, theme: normalizeTheme(raw.theme), templateRef, pages: pages.map((p) => ({ ...p, title: typeof p.title === "string" ? p.title : "Page" })) });
  }
  if (isPageData(raw)) return docFromPage({ root: raw.root ?? {}, content: raw.content });
  return null;
}

/** The theme belongs to the site; each page's root carries a copy because that is what the editor renders. */
export function withTheme(doc: SiteDoc, theme: ThemeTokens = doc.theme): SiteDoc {
  return {
    ...doc,
    theme,
    pages: doc.pages.map((p) => ({ ...p, data: { ...p.data, root: { ...p.data.root, props: { ...p.data.root.props, theme } } } })),
  };
}

export function updatePage(doc: SiteDoc, id: string, data: PageData): SiteDoc {
  return { ...doc, pages: doc.pages.map((p) => (p.id === id ? { ...p, data } : p)) };
}

export function addPage(doc: SiteDoc, title: string, data?: PageData): { doc: SiteDoc; id: string } {
  const id = newPageId();
  const page: SitePage = {
    id,
    title,
    path: uniquePath(doc.pages, title),
    data: data ? { root: { props: { ...data.root.props, title, theme: doc.theme } }, content: withFreshIds(data.content) } : emptyPage(doc.theme, title),
  };
  return { doc: { ...doc, pages: [...doc.pages, page] }, id };
}

export function renamePage(doc: SiteDoc, id: string, title: string): SiteDoc {
  return {
    ...doc,
    pages: doc.pages.map((p) => (p.id === id ? { ...p, title, path: p.path === "/" ? "/" : uniquePath(doc.pages, title, id) } : p)),
  };
}

export function duplicatePage(doc: SiteDoc, id: string): { doc: SiteDoc; id: string } {
  const src = doc.pages.find((p) => p.id === id);
  if (!src) return { doc, id };
  const copy = addPage(doc, `${src.title} copy`, src.data);
  // Keep the copy next to its original.
  const pages = copy.doc.pages.slice(0, -1);
  pages.splice(doc.pages.indexOf(src) + 1, 0, copy.doc.pages.at(-1)!);
  return { doc: { ...copy.doc, pages }, id: copy.id };
}

/** The home page can't be deleted, so a site always has somewhere to land. */
export function deletePage(doc: SiteDoc, id: string): SiteDoc {
  const page = doc.pages.find((p) => p.id === id);
  if (!page || page.path === "/" || doc.pages.length === 1) return doc;
  return { ...doc, pages: doc.pages.filter((p) => p.id !== id) };
}

export function movePage(doc: SiteDoc, id: string, delta: -1 | 1): SiteDoc {
  const from = doc.pages.findIndex((p) => p.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= doc.pages.length) return doc;
  const pages = [...doc.pages];
  [pages[from], pages[to]] = [pages[to]!, pages[from]!];
  return { ...doc, pages };
}

export const pageRefs = (doc: SiteDoc): PageRef[] => doc.pages.map(({ id, path, title }) => ({ id, path, title }));

export const countBlocks = (doc: SiteDoc) => doc.pages.reduce((n, p) => n + p.data.content.length, 0);
