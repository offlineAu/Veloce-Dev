/*
 * The format of an imported template: what the importer (scripts/import-template.ts) writes to
 * public/builder-templates/<slug>/v<version>/template.json and what the editor, preview page and server read.
 *
 * Sections are stored as a JSON tree of already-sanitised elements, never as HTML, and rendered with
 * React.createElement (lib/builder/node-tree.tsx). Visitor edits only ever replace values bound to fields.
 */
import type { ThemeTokens } from "./theme";

export const PACKAGE_FORMAT = 1;

/** Prefix on every template utility class, so a template never collides with the site's own classes. */
export const CLASS_PREFIX = "vt:";

export type AttrValue = string | number | boolean | Record<string, string>;

export interface ElementNode {
  /** HTML or SVG tag name. */
  t: string;
  /** Attributes with React names (className, htmlFor, strokeWidth, style as an object). */
  a?: Record<string, AttrValue>;
  c?: TreeNode[];
  /** Attribute name → field id whose value replaces it (src, alt, href, aria-label…). */
  b?: Record<string, string>;
}

/** Text bound to a field. */
export interface FieldText {
  f: string;
}

/** A run of similar siblings (cards, nav links, steps) that visitors can add to or remove from. */
export interface RepeatNode {
  r: string;
  item: ElementNode;
}

export type TreeNode = string | ElementNode | FieldText | RepeatNode;

export type FieldKind = "text" | "textarea" | "image" | "link";

export interface FieldDef {
  id: string;
  kind: FieldKind;
  label: string;
}

export interface RepeaterDef {
  id: string;
  label: string;
  itemLabel: string;
  fields: FieldDef[];
  defaults: Record<string, string>[];
  max: number;
}

export interface TemplateSection {
  id: string;
  label: string;
  tree: ElementNode;
  fields: FieldDef[];
  defaults: Record<string, string>;
  repeaters: RepeaterDef[];
}

export interface TemplatePage {
  /** Stable key within the template, also its default path ("" for the home page). */
  key: string;
  title: string;
  /** Classes of the original <body>/<main>, applied around the page. */
  frame: string;
  sections: TemplateSection[];
}

export interface TemplatePackage {
  format: typeof PACKAGE_FORMAT;
  slug: string;
  version: number;
  name: string;
  description: string;
  websiteType: string;
  theme: ThemeTokens;
  pages: TemplatePage[];
  /** Design guidance from the source (DESIGN.md prose), shown to the team during review. */
  notes?: string;
  importedAt: string;
}

/** Where a repo template's files live (public/builder-templates, committed with the code). */
export const packageBase = (slug: string, version: number) => `/builder-templates/${slug}/v${version}`;

/** Where an uploaded template's files are served from (stored in the database). */
export const uploadBase = (slug: string, version: number) => `/build/t/${slug}/v${version}`;

/**
 * The URL the editor fetches a template's package or stylesheet from. Served by one route for both kinds of
 * template, so the browser never needs to know where a template came from.
 */
export const templateFileUrl = (slug: string, version: number, file: "template.json" | "theme.css") => `${uploadBase(slug, version)}/${file}`;

/** A template as the picker lists it: the version this visitor should start from. */
export interface TemplateListing {
  slug: string;
  name: string;
  description: string;
  websiteType: string;
  scheme: "light" | "dark";
  source: "repo" | "upload";
  version: number;
  /** Not published yet: only developers see it. */
  draft: boolean;
  pages: { key: string; title: string }[];
  thumbnail?: string;
}

export const findSection = (pkg: TemplatePackage | undefined, sectionId: string) => {
  for (const page of pkg?.pages ?? []) {
    const s = page.sections.find((x) => x.id === sectionId);
    if (s) return s;
  }
  return undefined;
};

/** Every field value a section can hold, defaults included: what the editor starts a new section with. */
export const sectionDefaults = (s: TemplateSection) => ({
  values: { ...s.defaults },
  items: Object.fromEntries(s.repeaters.map((r) => [r.id, r.defaults.map((d) => ({ ...d }))])),
});
