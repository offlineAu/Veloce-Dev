/**
 * Publish a reviewed template version so it appears in the builder in production.
 *
 *   npm run template:publish -- noir-needle [--version 2] [--unpublish]
 *
 * Without --version, the latest imported version is published. Commit the manifest and the package folder afterwards.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { ImportedTemplateEntry } from "../src/content/builder-templates";

const { values: v, positionals } = parseArgs({ allowPositionals: true, options: { version: { type: "string" }, unpublish: { type: "boolean" } } });
const slug = positionals[0];
const file = "src/content/builder-templates/manifest.json";
const manifest = JSON.parse(readFileSync(file, "utf8")) as ImportedTemplateEntry[];
const t = manifest.find((x) => x.slug === slug);
if (!t) {
  console.error(`✗ No imported template "${slug}". Known: ${manifest.map((x) => x.slug).join(", ") || "none"}.`);
  process.exit(1);
}
const version = v.version ? Number(v.version) : Math.max(...t.versions);
if (!t.versions.includes(version)) {
  console.error(`✗ ${slug} has no v${version} (has ${t.versions.join(", ")}).`);
  process.exit(1);
}
// Unpublishing hides a version from new sites; designs already submitted with it keep rendering.
t.published = v.unpublish ? t.published.filter((x) => x !== version) : [...new Set([...t.published, version])].sort((a, b) => a - b);
writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✓ ${slug} v${version} ${v.unpublish ? "unpublished" : "published"}. Commit ${file} and public/builder-templates/${slug}/.`);
