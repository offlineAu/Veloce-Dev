import manifest from "./manifest.json";

/**
 * Imported templates, as listed by the importer in manifest.json (scripts/import-template.ts writes it; change it only
 * through `npm run template:import` / `template:publish`). The packages themselves live in public/builder-templates.
 */
export interface ImportedTemplateEntry {
  slug: string;
  name: string;
  description: string;
  websiteType: string;
  scheme: "light" | "dark";
  /** Every imported version. Old versions stay on disk so submitted designs keep rendering. */
  versions: number[];
  /** Versions the team reviewed and published. Only these appear in production. */
  published: number[];
  /** Pages and screen thumbnails of the latest version (thumbnails are relative to its folder). */
  pages: { key: string; title: string }[];
  thumbnails: string[];
  importedAt: string;
}

export const IMPORTED_TEMPLATES = manifest as ImportedTemplateEntry[];

/** Unpublished versions are visible while developing (for review) and never in production. */
export const showDrafts = () => process.env.NODE_ENV !== "production";

/** The version new sites should start from, or undefined when nothing is visible. */
export const currentVersion = (t: ImportedTemplateEntry, drafts = showDrafts()) => {
  const list = drafts ? t.versions : t.published;
  return list.length ? Math.max(...list) : undefined;
};

export const isDraftVersion = (t: ImportedTemplateEntry, version: number) => !t.published.includes(version);

export const visibleTemplates = (drafts = showDrafts()) => IMPORTED_TEMPLATES.filter((t) => currentVersion(t, drafts) !== undefined);

export const findImported = (slug: string | null | undefined) => IMPORTED_TEMPLATES.find((t) => t.slug === slug);

/** Whether a site may reference this template version (server-side check on submitted designs). */
export const isKnownVersion = (slug: string, version: number, drafts = showDrafts()) => {
  const t = findImported(slug);
  return !!t && t.versions.includes(version) && (drafts || t.published.includes(version));
};
