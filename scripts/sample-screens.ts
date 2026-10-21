/**
 * Capture the landing screen of every page of every sample website (src/content/samples.ts) for the home page's
 * carousel: the first screen of the live preview at laptop size (1440×900, the slides' 16:10 shape), so a slide shows
 * the page's landing area rather than the whole page shrunk down.
 *
 *   npm run samples:screens                       # against http://localhost:3000 (start `npm run dev` first)
 *   npm run samples:screens -- --base https://…   # another server
 *   npm run samples:screens -- noir-needle        # only these templates
 *
 * Writes public/images/samples/<slug>-v<N>-<page>.webp. Run it again after importing a new version of a sample.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { watermarkedPreview } from "../src/lib/security/watermark";
import { findImported } from "../src/content/builder-templates";
import { SAMPLE_SITES, screenPath } from "../src/content/samples";

const { values: v, positionals } = parseArgs({ allowPositionals: true, options: { base: { type: "string", default: "http://localhost:3000" } } });
const only = new Set(positionals);
const samples = SAMPLE_SITES.filter((s) => !only.size || only.has(s.slug));
if (!samples.length) {
  console.error(`✗ No samples match ${[...only].join(", ")}.`);
  process.exit(1);
}

const VIEWPORT = { width: 1440, height: 900 };
const OUT = { width: 960, height: 600 };
// The preview's own bar (pinned to the bottom) and the Next.js dev badge aren't part of the design.
const HIDE = "body > div.fixed.bottom-0, nextjs-portal { display: none !important; }";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  mkdirSync(path.join("public", "images", "samples"), { recursive: true });
  try {
    for (const s of samples) {
      const t = findImported(s.slug);
      if (!t) {
        console.warn(`! ${s.slug}: not an imported template, skipped`);
        continue;
      }
      for (const p of t.pages) {
        const url = `${v.base}/build/preview/${s.token}?page=${encodeURIComponent(p.key ? `/${p.key}` : "/")}`;
        const res = await page.goto(url, { waitUntil: "networkidle" });
        if (!res?.ok()) throw new Error(`${url} answered ${res?.status()}`);
        await page.addStyleTag({ content: HIDE });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        const file = path.join("public", screenPath(s, p.key));
        const original = await sharp(await page.screenshot()).resize(OUT.width, OUT.height).png().toBuffer();
        const preview = await watermarkedPreview(original, "veloceapp.dev", OUT.width);
        writeFileSync(file, preview);
        console.log(`✓ ${file}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
