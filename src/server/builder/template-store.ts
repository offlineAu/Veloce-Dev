import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { findImported, isKnownVersion } from "@/content/builder-templates";
import type { TemplatePackage } from "@/lib/builder/template-package";

const cache = new Map<string, { pkg: TemplatePackage; css: string } | null>();

/** Root of the template packages. Kept literal so the server bundle only includes public/builder-templates. */
let root = path.join(process.cwd(), "public", "builder-templates");
export const setTemplateRootForTests = (dir: string) => {
  root = path.join(dir, "builder-templates");
  cache.clear();
};

/**
 * Reads an imported template version from disk. Only versions listed in the manifest are ever read, so a design can't
 * make the server open arbitrary files. New submissions need a published version (in production); showing a design
 * that was already submitted works with any version it was made with, even one unpublished since.
 */
export function readTemplate(slug: string, version: number, { requirePublished = true } = {}): { pkg: TemplatePackage; css: string } | null {
  if (!/^[a-z0-9-]{1,40}$/.test(slug) || !Number.isInteger(version)) return null;
  if (requirePublished ? !isKnownVersion(slug, version) : !findImported(slug)?.versions.includes(version)) return null;
  const key = `${slug}@${version}`;
  if (!cache.has(key)) {
    try {
      const dir = path.join(root, slug, `v${version}`);
      const pkg = JSON.parse(readFileSync(path.join(dir, "template.json"), "utf8")) as TemplatePackage;
      const css = readFileSync(path.join(dir, "theme.css"), "utf8");
      cache.set(key, pkg.slug === slug && pkg.version === version ? { pkg, css } : null);
    } catch {
      cache.set(key, null);
    }
  }
  return cache.get(key) ?? null;
}
