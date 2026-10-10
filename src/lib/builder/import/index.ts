/*
 * The template importer: a design export (pages of Tailwind HTML, optional DESIGN.md and screenshots) → a
 * self-contained, versioned template package. Pure apart from the network (injectable) and image encoding, so it is
 * testable; scripts/import-template.ts is the command-line wrapper that reads the zip and writes the files.
 */
import { slugify } from "../site-doc";
import { PACKAGE_FORMAT, packageBase, type TemplatePackage, type TemplatePage, type TemplateSection } from "../template-package";
import { collectFonts, collectImages, thumbnail, type FetchLike } from "./assets";
import { rewriteClassList, type ClassContext } from "./classes";
import { compileTemplateCss } from "./css";
import { ASSET, convertSection, type FieldEnv } from "./fields";
import { classList, parsePage, textOf, walk, type IREl, type ParsedPage } from "./ir";
import { validatePackage } from "./package-schema";
import { Report } from "./report";
import { splitSections } from "./sections";
import {
  builderTheme, extractPalette, mergeTokens, readTailwindConfig, themeCss, tokensFromConfig, tokensFromDesignMd,
  type ColorHints, type ThemeOverrides,
} from "./theme";

export interface ImportSource {
  pages: { dir: string; html: string; screen?: Buffer }[];
  designMd?: string;
}

export interface ImportOptions {
  slug: string;
  name: string;
  description?: string;
  websiteType: string;
  version: number;
  fetcher: FetchLike;
  /** Page folder → page key, when the export doesn't make it clear which page is which. */
  pageMap?: Record<string, string>;
  /** Keep the pages in the order given (the first is the home page) instead of the navigation's order. */
  keepOrder?: boolean;
  /** Where the package's files will be served from (defaults to the repo location, public/builder-templates). */
  assetBase?: string;
  /** The developer's choice of design colour for each theme role (from the upload screen). */
  themeOverrides?: ThemeOverrides;
}

export interface ImportResult {
  pkg: TemplatePackage;
  css: string;
  /** Package-relative path → contents (fonts, images, thumbnails). */
  files: Map<string, Buffer>;
  thumbnails: string[];
  report: string;
  /** Named colours of the design, to pick theme roles from. */
  palette: { name: string; value: string }[];
}

const ICON_CLASS = /^material-(symbols|icons)/;
const humanize = (key: string) => key.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

interface PageInfo {
  dir: string;
  parsed: ParsedPage;
  path?: string;
  screen?: Buffer;
}

/** The nav links of a page: the first element holding 3+ `data-path` links. */
function navLinks(body: IREl): IREl[] {
  for (const el of walk(body)) {
    const links = el.children.filter((c): c is IREl => c.kind === "el" && "data-path" in c.attrs);
    if (links.length >= 3) return links;
  }
  return [];
}

/** Which `data-path` this page is: its aria-current link, or the one nav link styled differently from the rest. */
function ownPath(body: IREl): string | undefined {
  for (const el of walk(body)) if (el.attrs["aria-current"] === "page" && el.attrs["data-path"]) return el.attrs["data-path"];
  const links = navLinks(body);
  const byClass = new Map<string, IREl[]>();
  for (const l of links) byClass.set(l.attrs.class ?? "", [...(byClass.get(l.attrs.class ?? "") ?? []), l]);
  const unique = [...byClass.values()].filter((g) => g.length === 1);
  return links.length >= 3 && unique.length === 1 ? unique[0]![0]!.attrs["data-path"] : undefined;
}

const STOP = new Set(["and", "the", "a", "of", "for", "page", "noir", "needle"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
const near = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** For pages that don't mark themselves in the nav: the unclaimed path sharing the most words with the page. */
function guessPath(p: PageInfo, candidates: Map<string, number>): string | undefined {
  const h1 = [...walk(p.parsed.body)].find((e) => e.tag === "h1");
  const own = new Set([...words(p.dir), ...words(p.parsed.title), ...(h1 ? words(textOf(h1)) : [])]);
  let best: { path: string; score: number; links: number } | undefined;
  for (const [path, links] of candidates) {
    const score = words(path).filter((w) => [...own].some((o) => near(o, w))).length;
    if (score > 0 && (!best || score > best.score || (score === best.score && links > best.links))) best = { path, score, links };
  }
  return best?.path;
}

/** Colour token named by a utility class ("hover:bg-brand-lime/80" → "brand-lime" for prefix "bg"). */
const colorToken = (cls: string, prefix: "bg" | "text") => cls.split(":").pop()!.match(new RegExp(`^${prefix}-([a-zA-Z][\\w-]*?)(?:\\/\\d+)?$`))?.[1];

/** How the home page uses colour: its body's background and text, and what buttons and links are filled with. */
function colorHints(body: IREl): ColorHints {
  const own = classList(body).filter((c) => !c.includes(":"));
  const buttonBgs = new Map<string, number>();
  for (const el of walk(body)) {
    if (el.tag !== "button" && el.tag !== "a") continue;
    for (const c of classList(el)) {
      if (c.includes(":")) continue;
      const t = colorToken(c, "bg");
      if (t) buttonBgs.set(t, (buttonBgs.get(t) ?? 0) + 1);
    }
  }
  return {
    bodyBg: own.map((c) => colorToken(c, "bg")).find(Boolean),
    bodyText: own.map((c) => colorToken(c, "text")).find(Boolean),
    buttonBgs,
  };
}

function commonPrefix(names: string[]): string {
  if (names.length < 2) return "";
  let p = names[0]!;
  for (const n of names) while (!n.startsWith(p)) p = p.slice(0, -1);
  return p.slice(0, p.lastIndexOf("_") + 1);
}

export async function importTemplate(src: ImportSource, opts: ImportOptions): Promise<ImportResult> {
  const report = new Report();
  if (!src.pages.length) throw new Error("No pages found (expected folders with a code.html each).");
  const base = opts.assetBase ?? packageBase(opts.slug, opts.version);
  const scope = `[data-vt="${opts.slug}"]`;

  // 1. Parse every page.
  const pages: PageInfo[] = src.pages.map((p) => ({ dir: p.dir, parsed: parsePage(p.html, report), screen: p.screen }));

  // 2. Design tokens: each page's Tailwind config, then DESIGN.md on top.
  const design = tokensFromDesignMd(src.designMd, report);
  const tokens = mergeTokens(...pages.map((p) => tokensFromConfig(readTailwindConfig(p.parsed.tailwindConfig, report), report)), design.tokens);
  const dark = pages.some((p) => p.parsed.htmlClass.split(/\s+/).includes("dark"));
  const theme = builderTheme(tokens, dark, report, colorHints(pages[0]!.parsed.body), opts.themeOverrides);

  // 3. Which page is which, and their order (the navigation's order, home first).
  const prefix = commonPrefix(pages.map((p) => p.dir));
  for (const p of pages) p.path = opts.pageMap?.[p.dir] ?? ownPath(p.parsed.body);
  const linkCounts = new Map<string, number>();
  for (const p of pages) for (const el of walk(p.parsed.body)) if (el.attrs["data-path"]) linkCounts.set(el.attrs["data-path"], (linkCounts.get(el.attrs["data-path"]) ?? 0) + 1);
  for (const p of pages.filter((x) => !x.path)) {
    const claimed = new Set(pages.map((x) => x.path));
    p.path = guessPath(p, new Map([...linkCounts].filter(([k]) => !claimed.has(k)))) ?? slugify(p.dir.slice(prefix.length));
  }
  report.note(`Pages matched to links: ${pages.map((p) => `${p.dir} → “${p.path}”`).join(", ")}. If one is wrong, re-import with --map <folder>=<link>.`);
  const navOrder = navLinks(pages[0]!.parsed.body).map((l) => l.attrs["data-path"]!);
  const rank = (p: PageInfo) => (navOrder.includes(p.path!) ? navOrder.indexOf(p.path!) : navOrder.length + pages.indexOf(p));
  if (!opts.keepOrder) pages.sort((a, b) => rank(a) - rank(b));
  const keyOf = new Map(pages.map((p, i) => [p.path!, i === 0 ? "" : slugify(p.path!)]));
  const navText = new Map(navLinks(pages[0]!.parsed.body).map((l) => [l.attrs["data-path"]!, textOf(l)]));
  const missing = new Set<string>();

  const classes: ClassContext = { custom: new Set(), radiusDefault: "DEFAULT" in tokens.radius };
  for (const p of pages) for (const el of walk(p.parsed.body)) classList(el).filter((c) => ICON_CLASS.test(c)).forEach((c) => classes.custom.add(c));

  const env: FieldEnv = {
    classes,
    candidates: new Set(),
    images: new Set(),
    icons: new Set(),
    report,
    linkFor: (path) => {
      if (keyOf.has(path)) return `tpl:${keyOf.get(path)}`;
      if (!missing.has(path)) report.warn(`Links to “${path}” point to a page that isn't in the export; they link nowhere until you set them.`);
      missing.add(path);
      return "#";
    },
  };

  // 4. Sections and their editable content.
  const outPages: TemplatePage[] = pages.map((p) => {
    const { frame, sections } = splitSections(p.parsed.body, report);
    const key = keyOf.get(p.path!)!;
    const used = new Set<string>();
    const frameClasses = rewriteClassList(frame.join(" "), classes);
    frameClasses.split(" ").forEach((c) => c && env.candidates.add(c));
    return {
      key,
      // The home page is "Home" unless the navigation names it; other pages fall back to their file or folder name.
      title: (navText.get(p.path!) || (key === "" ? "Home" : humanize(p.path!))).slice(0, 60),
      frame: frameClasses,
      sections: sections.map((s): TemplateSection => {
        let id = `${key || "home"}-${slugify(s.label)}`.slice(0, 70);
        for (let n = 2; used.has(id); n++) id = `${key || "home"}-${slugify(s.label)}-${n}`.slice(0, 80);
        used.add(id);
        return { id, label: s.label.slice(0, 60), ...convertSection(s.el, env) };
      }),
    };
  });
  const empty = outPages.filter((p) => !p.sections.length);
  if (empty.length) throw new Error(`No sections found on: ${empty.map((p) => p.title).join(", ")}`);

  // 5. Fonts and images into the package.
  const fonts = await collectFonts({ links: [...new Set(pages.flatMap((p) => p.parsed.fontLinks))], icons: env.icons, base, scope, fetcher: opts.fetcher, report });
  const images = await collectImages({ urls: env.images, base, fetcher: opts.fetcher, report, placeholderColor: theme.surface });
  const asset = (v: string) => (v.startsWith(ASSET) ? (images.map.get(v.slice(ASSET.length)) ?? "") : v);
  for (const page of outPages) {
    for (const s of page.sections) {
      for (const k of Object.keys(s.defaults)) s.defaults[k] = asset(s.defaults[k]!);
      for (const r of s.repeaters) for (const d of r.defaults) for (const k of Object.keys(d)) d[k] = asset(d[k]!);
    }
  }

  // 6. The stylesheet.
  const css = await compileTemplateCss({ slug: opts.slug, candidates: env.candidates, theme: themeCss(tokens), extra: fonts.css, report });

  // 7. Thumbnails.
  const files = new Map([...fonts.files, ...images.files]);
  const thumbnails: string[] = [];
  for (const p of pages) {
    if (!p.screen) continue;
    const file = `thumb-${keyOf.get(p.path!) || "home"}.webp`;
    files.set(file, await thumbnail(p.screen));
    thumbnails.push(file);
  }

  const pkg: TemplatePackage = {
    format: PACKAGE_FORMAT,
    slug: opts.slug,
    version: opts.version,
    name: opts.name,
    description: opts.description ?? `${outPages.length}-page design imported from ${pages[0]!.dir}.`,
    websiteType: opts.websiteType,
    theme,
    pages: outPages,
    notes: design.notes,
    importedAt: new Date().toISOString(),
  };
  const valid = validatePackage(pkg);
  if (!valid.success) throw new Error(`The imported package is invalid: ${valid.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);

  const sectionCount = outPages.reduce((n, p) => n + p.sections.length, 0);
  const fieldCount = outPages.reduce((n, p) => n + p.sections.reduce((m, s) => m + s.fields.length + s.repeaters.reduce((k, r) => k + r.fields.length, 0), 0), 0);
  const listCount = outPages.reduce((n, p) => n + p.sections.reduce((m, s) => m + s.repeaters.length, 0), 0);
  report.note(`${outPages.length} pages: ${outPages.map((p) => `${p.title} (${p.key ? `/${p.key}` : "/"}, ${p.sections.length} sections)`).join(", ")}.`);
  report.note(`${sectionCount} sections, ${fieldCount} editable fields, ${listCount} editable lists.`);
  report.note(`Theme: ${theme.scheme}, accent ${theme.accent}, headings ${theme.fontHeading}, body ${theme.fontBody}.`);
  report.note(`Stylesheet ${(css.length / 1024).toFixed(0)} KB, ${files.size} asset files.`);
  if (pages.some((p) => p.parsed.styles.length)) report.count("page <style> blocks left out (page boilerplate)", pages.reduce((n, p) => n + p.parsed.styles.length, 0));
  report.note("Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.");

  return { pkg, css, files, thumbnails, report: report.toMarkdown(`${opts.name} v${opts.version}`), palette: extractPalette(tokens) };
}
