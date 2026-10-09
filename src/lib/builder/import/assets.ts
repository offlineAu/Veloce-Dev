/*
 * Step 6: everything the design loads from elsewhere is copied into the package, so a template never makes a
 * request to another site (and the site's security policy can stay strict):
 *   - Google Fonts: the stylesheet is fetched, its woff2 files downloaded, and @font-face rewritten to them.
 *     Icon fonts (Material Symbols) are cut down to the icons the design uses.
 *   - Images: downloaded and re-encoded as WebP, at most 1600px wide. Failures become a neutral placeholder.
 *   - Page screenshots: small WebP thumbnails for the template picker.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { customClassName } from "./classes";
import type { Report } from "./report";

export interface FetchLike {
  (url: string, init?: { headers?: Record<string, string> }): Promise<{ ok: boolean; status: number; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }>;
}

/** Google serves woff2 only to browsers it recognises. */
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_BYTES = 15_000_000;
const KEEP_SUBSETS = /^(latin|latin-ext)$/;
const ICON_FAMILY = /^Material (Symbols|Icons)/;

const hash = (s: string | Buffer) => createHash("sha1").update(s).digest("hex").slice(0, 16);

async function download(fetcher: FetchLike, url: string): Promise<Buffer> {
  const res = await fetcher(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("too large");
  return buf;
}

/** Family names requested by a Google Fonts css2 URL. */
export function familiesIn(url: string): string[] {
  try {
    return new URL(url).searchParams.getAll("family").map((f) => f.split(":")[0]!.replace(/\+/g, " "));
  } catch {
    return [];
  }
}

export interface FontResult {
  css: string;
  files: Map<string, Buffer>;
  /** Non-utility classes the font stylesheets define (e.g. "material-symbols-outlined"). */
  classes: Set<string>;
}

export async function collectFonts(opts: {
  links: string[];
  icons: Set<string>;
  base: string;
  scope: string;
  fetcher: FetchLike;
  report: Report;
}): Promise<FontResult> {
  const files = new Map<string, Buffer>();
  const classes = new Set<string>();
  const sheets: string[] = [];
  const iconFamilies = new Set<string>();

  // Text fonts: the export's own links (they list the weights the design uses), without the icon families.
  const textLinks = new Set<string>();
  for (const link of opts.links) {
    const families = familiesIn(link);
    families.filter((f) => ICON_FAMILY.test(f)).forEach((f) => iconFamilies.add(f));
    if (families.some((f) => !ICON_FAMILY.test(f))) {
      const u = new URL(link);
      const keep = u.searchParams.getAll("family").filter((f) => !ICON_FAMILY.test(f.split(":")[0]!.replace(/\+/g, " ")));
      u.searchParams.delete("family");
      keep.forEach((f) => u.searchParams.append("family", f));
      textLinks.add(u.toString());
    }
  }
  // Icon fonts: every axis (so FILL and weight variations still work), only the icons in use.
  const icons = [...opts.icons].filter((i) => /^[a-z0-9_]{1,40}$/.test(i)).sort();
  const iconLinks = [...iconFamilies].map(
    (f) => `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, "+")}:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=${icons.join(",")}&display=block`,
  );
  if (iconFamilies.size && !icons.length) opts.report.warn("An icon font is linked but no icons were found; it was left out.");

  for (const link of [...textLinks, ...(icons.length ? iconLinks : [])]) {
    let css: string;
    try {
      const res = await opts.fetcher(link, { headers: { "User-Agent": BROWSER_UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      css = await res.text();
    } catch (e) {
      opts.report.warn(`Couldn't download fonts from ${link.slice(0, 90)}… (${(e as Error).message}). Text falls back to similar system fonts.`);
      continue;
    }
    // Blocks look like "/* latin */ @font-face { … }"; keep latin subsets (or unlabelled faces, e.g. icon fonts).
    for (const [, subset, face] of css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]*\})/g)) {
      if (!face || (subset && !KEEP_SUBSETS.test(subset))) continue;
      let out = face;
      for (const m of face.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) {
        try {
          const buf = await download(opts.fetcher, m[1]!);
          const file = `fonts/${hash(m[1]!)}.woff2`;
          files.set(file, buf);
          out = out.replace(m[0], `url(${opts.base}/${file})`);
        } catch (e) {
          opts.report.warn(`A font file couldn't be downloaded (${(e as Error).message}).`);
          out = "";
          break;
        }
      }
      if (out) sheets.push(out);
    }
    // The icon font's own class rule (".material-symbols-outlined { font-family: … }"), namespaced to the template.
    for (const m of css.matchAll(/\.([a-z][\w-]*)\s*\{([^}]*)\}/g)) {
      classes.add(m[1]!);
      sheets.push(`${opts.scope} .${customClassName(m[1]!)}{${m[2]}}`);
    }
  }
  opts.report.count("font files bundled", files.size);
  return { css: sheets.join("\n"), files, classes };
}

export interface ImageResult {
  /** Original address → package path. */
  map: Map<string, string>;
  files: Map<string, Buffer>;
}

export async function collectImages(opts: { urls: Iterable<string>; base: string; fetcher: FetchLike; report: Report; placeholderColor: string }): Promise<ImageResult> {
  const map = new Map<string, string>();
  const files = new Map<string, Buffer>();
  let placeholder: string | undefined;
  for (const url of opts.urls) {
    try {
      const src = await download(opts.fetcher, url);
      const webp = await sharp(src).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      const file = `img/${hash(url)}.webp`;
      files.set(file, webp);
      map.set(url, `${opts.base}/${file}`);
    } catch (e) {
      opts.report.warn(`An image couldn't be downloaded (${(e as Error).message}); a placeholder was used. Replace it in the editor.`);
      if (!placeholder) {
        placeholder = "img/placeholder.webp";
        files.set(placeholder, await sharp({ create: { width: 1200, height: 900, channels: 3, background: opts.placeholderColor } }).webp().toBuffer());
      }
      map.set(url, `${opts.base}/${placeholder}`);
    }
  }
  opts.report.count("images bundled", files.size);
  return { map, files };
}

/** The top of a full-page screenshot, small, for the template picker. */
export async function thumbnail(png: Buffer): Promise<Buffer> {
  const resized = await sharp(png).resize({ width: 480 }).toBuffer({ resolveWithObject: true });
  return sharp(resized.data)
    .extract({ left: 0, top: 0, width: resized.info.width, height: Math.min(resized.info.height, 640) })
    .webp({ quality: 78 })
    .toBuffer();
}
