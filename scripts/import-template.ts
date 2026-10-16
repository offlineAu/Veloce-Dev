/**
 * Import a design export (e.g. a Google Stitch zip) as a site-builder template.
 *
 *   npm run template:import -- ~/Downloads/stitch_export.zip --slug noir-needle --name "Tattoo studio" --type BUSINESS \
 *     [--description "…"] [--version 2] [--map folder=page-key …] [--force] [--offline] [--hints hints.json] [--bake]
 *
 * Input: a .zip or a folder holding one folder per page with `code.html` (and `screen.png`), plus an optional
 * DESIGN.md; or a single hand-written .html page.
 *
 * --bake runs each page once in a headless browser first (lib/builder/bake-capture.ts), for templates whose
 * script builds part of the page: what it built is imported, and a screenshot of it becomes the page's thumbnail
 * when the export has none. A hints file can also hold a bake recipe, for a page that holds several (an app whose
 * views are switched by its script): `{ "bake": { "pages": [{ "dir": "overview", "before": "…" }] }, "behaviours": […] }`.
 * Each recipe page is the export's first page, run with its `before` steps (an async function body, with `wait(ms)`),
 * in the recipe's order (the first is the home page). Output: public/builder-templates/<slug>/v<N>/ (template.json, theme.css, fonts, images, thumbnails),
 * a review report in src/content/builder-templates/reports/, and a manifest entry. New versions start unpublished:
 * review them at /build?template=<slug>&review=1, then run `npm run template:publish -- <slug>`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { unzipSync } from "fflate";
import { chromium } from "@playwright/test";
import { importTemplate, type ImportSource } from "../src/lib/builder/import";
import type { FetchLike } from "../src/lib/builder/import/assets";
import type { BehaviourHint } from "../src/lib/builder/import/behaviours";
import { BAKE_MESSAGE, withCapture } from "../src/lib/builder/bake-capture";
import type { ImportedTemplateEntry } from "../src/content/builder-templates";

const WEBSITE_TYPES = ["BUSINESS", "CORPORATE", "ECOMMERCE_STORE", "WEB_APP", "LANDING_PAGE", "OTHER"];

const { values: v, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    slug: { type: "string" },
    name: { type: "string" },
    type: { type: "string", default: "BUSINESS" },
    description: { type: "string" },
    version: { type: "string" },
    map: { type: "string", multiple: true },
    force: { type: "boolean" },
    offline: { type: "boolean" },
    // Interactions the importer can't recognise on its own (scripts/template-hints/<slug>.json, import/behaviours.ts).
    hints: { type: "string" },
    // Run each page's script once before importing (what it builds from data comes along).
    bake: { type: "boolean" },
  },
});

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const input = positionals[0];
if (!input || !v.slug || !v.name) fail("Usage: template:import <zip|folder> --slug <slug> --name <name> [--type BUSINESS]");
if (!/^[a-z0-9-]{1,40}$/.test(v.slug)) fail("--slug may only use lowercase letters, digits and dashes.");
if (!WEBSITE_TYPES.includes(v.type!)) fail(`--type must be one of ${WEBSITE_TYPES.join(", ")}.`);
const slug: string = v.slug;
const name: string = v.name;

/** All files of the export as relative path → bytes. */
function readExport(file: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  if (!existsSync(file)) fail(`Not found: ${file}`);
  if (statSync(file).isDirectory()) {
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else out.set(path.relative(file, full).split(path.sep).join("/"), readFileSync(full));
      }
    };
    walk(file);
  } else {
    for (const [name, data] of Object.entries(unzipSync(readFileSync(file)))) {
      if (!name.endsWith("/") && !name.includes("..")) out.set(name, Buffer.from(data));
    }
  }
  return out;
}

const inputPath = path.resolve(input.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
// A single hand-written page is an export of one page.
const files = /\.html?$/i.test(inputPath) && statSync(inputPath).isFile()
  ? new Map([["home/code.html", readFileSync(inputPath)]])
  : readExport(inputPath);
const source: ImportSource = { pages: [] };
for (const [name, data] of files) {
  const m = name.match(/(?:^|\/)([^/]+)\/code\.html$/);
  if (m) {
    const dir = name.slice(0, -"code.html".length);
    source.pages.push({ dir: m[1]!, html: data.toString("utf8"), screen: files.get(`${dir}screen.png`) });
  } else if (/(^|\/)DESIGN\.md$/i.test(name) && !source.designMd) {
    source.designMd = data.toString("utf8");
  }
}
source.pages.sort((a, b) => a.dir.localeCompare(b.dir));
if (!source.pages.length) fail("No pages found: expected folders that each contain a code.html.");

const manifestFile = path.join("src/content/builder-templates/manifest.json");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as ImportedTemplateEntry[];
const existing = manifest.find((t) => t.slug === slug);
const version = v.version ? Number(v.version) : Math.max(0, ...(existing?.versions ?? [])) + 1;
if (!Number.isInteger(version) || version < 1) fail("--version must be a positive whole number.");
const outDir = path.join("public/builder-templates", slug, `v${version}`);
if (existsSync(outDir) && !v.force) fail(`${outDir} already exists. Versions are immutable once used; import as a new --version, or pass --force while it's unpublished.`);
if (existing?.published.includes(version) && v.force) fail(`v${version} of ${slug} is published; import a new version instead.`);

interface BakeRecipe {
  pages: { dir: string; before?: string }[];
}
interface HintsFile {
  bake?: BakeRecipe;
  behaviours?: BehaviourHint[];
}
const hintsFile: HintsFile = (() => {
  if (!v.hints) return {};
  const raw = JSON.parse(readFileSync(v.hints, "utf8")) as BehaviourHint[] | HintsFile;
  return Array.isArray(raw) ? { behaviours: raw } : raw;
})();
if (hintsFile.bake && !v.bake) fail("The hints file has a bake recipe: pass --bake too.");

/** Each page as its script leaves it, plus a screenshot (the page's landing area, desktop width). */
async function bake(pages: ImportSource["pages"], recipe?: BakeRecipe): Promise<ImportSource["pages"]> {
  const jobs: { dir: string; html: string; before?: string; screen?: Buffer }[] = recipe
    ? recipe.pages.map((p) => ({ dir: p.dir, html: pages[0]!.html, before: p.before }))
    : pages;
  const browser = await chromium.launch();
  try {
    const out: ImportSource["pages"] = [];
    for (const job of jobs) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const token = crypto.randomUUID();
      const baked = new Promise<string>((resolve) => void page.exposeFunction("__veloceBaked", resolve));
      await page.addInitScript((type) => {
        addEventListener("message", (e) => {
          if (e.data?.type === type) (window as unknown as { __veloceBaked: (h: string) => void }).__veloceBaked(e.data.html);
        });
      }, BAKE_MESSAGE);
      // Served from its own made-up origin: storage works, and the page can't reach this site.
      await page.route("https://bake.invalid/", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: withCapture(job.html, token, job.before) }));
      page.on("pageerror", (e) => console.warn(`  ! ${job.dir}: the page's script failed: ${e.message}`));
      await page.goto("https://bake.invalid/", { waitUntil: "load", timeout: 30_000 });
      const html = await Promise.race([baked, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${job.dir}: the page didn't finish within 30 s`)), 30_000))]);
      await page.evaluate(() => document.fonts.ready);
      const screen = job.screen ?? (await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 1707 }, fullPage: true }));
      out.push({ dir: job.dir, html, screen });
      console.log(`  baked ${job.dir} (${(html.length / 1024).toFixed(0)} KB)`);
      await page.close();
    }
    return out;
  } finally {
    await browser.close();
  }
}

const pageMap = Object.fromEntries((v.map ?? []).map((m) => m.split("=") as [string, string]));
const offline: FetchLike = async () => ({ ok: false, status: 0, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) });

async function main() {
  if (v.bake) {
    console.log("Running each page once (--bake)…");
    source.pages = await bake(source.pages, hintsFile.bake).catch((e: Error) => fail(e.message));
  }
  console.log(`Importing ${source.pages.length} pages as ${slug} v${version}…`);
  const result = await importTemplate(source, {
    slug,
    name,
    description: v.description,
    websiteType: v.type!,
    version,
    pageMap,
    // A recipe lists its pages in order, the home page first.
    keepOrder: Boolean(hintsFile.bake),
    hints: hintsFile.behaviours,
    fetcher: v.offline ? offline : (fetch as unknown as FetchLike),
  }).catch((e: Error) => fail(e.message));

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "template.json"), JSON.stringify(result.pkg));
  writeFileSync(path.join(outDir, "theme.css"), result.css);
  for (const [rel, data] of result.files) {
    mkdirSync(path.dirname(path.join(outDir, rel)), { recursive: true });
    writeFileSync(path.join(outDir, rel), data);
  }
  const reportDir = "src/content/builder-templates/reports";
  mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `${slug}-v${version}.md`);
  writeFileSync(reportFile, result.report);

  const entry: ImportedTemplateEntry = {
    slug,
    name,
    description: result.pkg.description,
    websiteType: v.type!,
    scheme: result.pkg.theme.scheme,
    versions: [...new Set([...(existing?.versions ?? []), version])].sort((a, b) => a - b),
    published: existing?.published ?? [],
    pages: result.pkg.pages.map((p) => ({ key: p.key, title: p.title })),
    thumbnails: result.thumbnails,
    importedAt: result.pkg.importedAt,
  };
  writeFileSync(manifestFile, `${JSON.stringify(existing ? manifest.map((t) => (t.slug === slug ? entry : t)) : [...manifest, entry], null, 2)}\n`);

  console.log(`✓ Wrote ${outDir}`);
  console.log(`  Review: ${reportFile}`);
  console.log(`  Preview: /build?template=${slug}&review=1   Publish: npm run template:publish -- ${slug}`);
}

void main();
