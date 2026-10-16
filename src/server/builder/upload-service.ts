import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/builder/site-doc";
import { normalizeTheme, readableOn, type ThemeTokens } from "@/lib/builder/theme";
import { uploadBase, type TemplatePackage } from "@/lib/builder/template-package";
import type { FetchLike } from "@/lib/builder/import/assets";
import { db } from "@/server/db";
import { prepareTemplateHtml, SOURCE_PATH } from "./template-source";
import { createSafeFetch } from "./safe-fetch";
import { contentTypeFor, isRepoTemplate } from "./template-registry";

/*
 * Turning uploaded HTML into a draft template version, and re-theming drafts. Used only by /api/dev/templates (which
 * checks the developer session first); the importer itself is loaded on demand here and nowhere else.
 */

export const MAX_HTML = 1_000_000;
const MAX_RENDERED = 3_000_000;
export const MAX_PAGES = 12;
const MAX_ASSET_BYTES = 10_000_000;
const WEBSITE_TYPES = ["BUSINESS", "CORPORATE", "ECOMMERCE_STORE", "WEB_APP", "LANDING_PAGE", "OTHER"];
const HEX = /^#[0-9a-f]{6}$/i;
const ROLES = ["accent", "bg", "surface", "fg", "muted", "line"];

export interface UploadInput {
  name: string;
  slug?: string;
  websiteType: string;
  description?: string;
  /** In page order: the first is the home page. */
  pages: { fileName: string; html: string; screen?: Buffer; rendered?: string }[];
  designMd?: string;
  assets?: { path: string; bytes: Buffer }[];
  /** Images loaded from the selected version by the authenticated upload route. */
  storedImageFiles?: ReadonlyMap<string, Buffer>;
}

export type UploadOutcome =
  | {
      ok: true;
      slug: string;
      version: number;
      report: string;
      palette: { name: string; value: string }[];
      theme: ThemeTokens;
      pages: { title: string; sections: number }[];
    }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string) => ({ ok: false as const, status, error });

export async function uploadTemplate(input: UploadInput, ctx: { uploadedBy: string; ipHash: string; fetcher?: FetchLike }): Promise<UploadOutcome> {
  const name = input.name.trim().slice(0, 60);
  const slug = (input.slug?.trim() || slugify(name)).slice(0, 40);
  if (!name) return fail(400, "Give the template a name.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return fail(400, "The slug may only use lowercase letters, digits and dashes.");
  if (!WEBSITE_TYPES.includes(input.websiteType)) return fail(400, "Pick a website type.");
  if (isRepoTemplate(slug)) return fail(409, `“${slug}” is a built-in template. Choose another slug.`);
  if (!input.pages.length) return fail(400, "Add at least one HTML file.");
  if (input.pages.length > MAX_PAGES) return fail(400, `Up to ${MAX_PAGES} pages per template.`);
  if (input.pages.some((p) => !/\.html?$/i.test(p.fileName) || p.html.length > MAX_HTML)) return fail(400, "Pages must be .html files under 1 MB each.");
  // The page as its script finished it (captured in the developer's browser, components/dev/bake.ts) is imported
  // when there is one; the file as written stays the source. Both go through the same importer.
  if (input.pages.some((p) => (p.rendered?.length ?? 0) > MAX_RENDERED)) return fail(400, "A page grew too large once its script ran (over 3 MB).");

  const existing = await db.builderTemplate.findUnique({ where: { slug }, select: { versions: { select: { version: true }, orderBy: { version: "desc" }, take: 1 } } });
  const version = (existing?.versions[0]?.version ?? 0) + 1;

  const assets = new Map((input.assets ?? []).map((a) => [a.path, a.bytes]));
  if (assets.size > 100 || [...assets.values()].reduce((n, b) => n + b.length, 0) > MAX_ASSET_BYTES) return fail(413, "Upload up to 100 image files, totalling at most 10 MB.");
  const remote = ctx.fetcher ?? createSafeFetch();
  const fetchers: FetchLike[] = [];
  const imageLabels = new Map<string, string>();
  const used = new Set<string>();
  let pages;
  try {
    pages = input.pages.map((p, i) => {
      let dir = slugify(p.fileName.replace(/\.html?$/i, "")) || `page-${i + 1}`;
      while (used.has(dir)) dir = `${dir}-${i + 1}`;
      used.add(dir);
      const prepared = prepareTemplateHtml(p.rendered || p.html, p.fileName, assets, remote);
      // Give each page its own synthetic namespace for local images.
      const prefix = `https://template-assets.invalid/page-${i}/`;
      for (const [url, label] of prepared.labels) imageLabels.set(url.replace("https://template-assets.invalid/", prefix), label);
      fetchers.push(async (url, init) => prepared.fetcher(url.replace(prefix, "https://template-assets.invalid/"), init));
      return { dir, html: prepared.html.replaceAll("https://template-assets.invalid/", prefix), screen: p.screen };
    });
  } catch (e) { return fail(422, (e as Error).message); }
  const fetcher: FetchLike = (url, init) => {
    const match = url.match(/^https:\/\/template-assets\.invalid\/page-(\d+)\//);
    return match && fetchers[Number(match[1])] ? fetchers[Number(match[1])]!(url, init) : remote(url, init);
  };

  const { importTemplate } = await import("@/lib/builder/import");
  let result: Awaited<ReturnType<typeof importTemplate>>;
  try {
    result = await importTemplate(
      { pages, designMd: input.designMd?.slice(0, 200_000) },
      {
        slug,
        name,
        description: input.description?.trim().slice(0, 300) || undefined,
        websiteType: input.websiteType,
        version,
        keepOrder: true,
        assetBase: uploadBase(slug, version),
        strictImages: true,
        storedImageFiles: input.storedImageFiles,
        fetcher,
      },
    );
  } catch (e) {
    let message = (e as Error).message;
    for (const [url, label] of [...imageLabels].sort((a, b) => b[0].length - a[0].length)) message = message.replaceAll(url, label);
    return fail(422, `The design couldn't be imported: ${message}`);
  }
  const assetBytes = [...result.files.values()].reduce((n, b) => n + b.length, 0);
  if (assetBytes > MAX_ASSET_BYTES) return fail(413, "The design's images and fonts add up to more than 10 MB.");

  // Source files are private: the public asset route only serves fonts, images and thumbnails.
  result.files.set(SOURCE_PATH, Buffer.from(JSON.stringify({ pages: input.pages.map(({ fileName, html }) => ({ fileName, html })), designMd: input.designMd?.slice(0, 200_000) })));
  for (const [assetPath, bytes] of assets) result.files.set(`source/assets/${assetPath}`, bytes);
  try {
    await db.$transaction(
      async (tx) => {
        const template = await tx.builderTemplate.upsert({
          where: { slug },
          create: { slug, name, description: result.pkg.description, websiteType: input.websiteType, scheme: result.pkg.theme.scheme },
          update: { name, description: result.pkg.description, websiteType: input.websiteType, scheme: result.pkg.theme.scheme },
          select: { id: true },
        });
        const created = await tx.builderTemplateVersion.create({
          data: {
            templateId: template.id,
            version,
            package: result.pkg as unknown as Prisma.InputJsonValue,
            css: result.css,
            report: result.report,
            thumbnails: result.thumbnails,
            uploadedBy: ctx.uploadedBy,
            uploaderIpHash: ctx.ipHash,
          },
          select: { id: true },
        });
        if (result.files.size) {
          await tx.builderTemplateAsset.createMany({
            data: [...result.files].map(([path, bytes]) => ({ versionId: created.id, path, contentType: contentTypeFor(path), bytes: new Uint8Array(bytes) })),
          });
        }
      },
      { timeout: 30_000 },
    );
  } catch (e) {
    // Two uploads of the same template at once both picked the same version number.
    if ((e as { code?: string }).code === "P2002") return fail(409, "Another upload of this template just finished. Try again.");
    throw e;
  }

  return {
    ok: true,
    slug,
    version,
    report: result.report,
    palette: result.palette,
    theme: result.pkg.theme,
    pages: result.pkg.pages.map((p) => ({ title: p.title, sections: p.sections.length })),
  };
}

/** Re-map a draft's theme colours from the design's palette (hex values), without uploading again. */
export async function rethemeDraft(slug: string, version: number, colors: Record<string, string>): Promise<{ ok: true; theme: ThemeTokens } | { ok: false; status: number; error: string }> {
  const row = await db.builderTemplateVersion.findFirst({ where: { version, status: "DRAFT", template: { slug } }, select: { id: true, package: true } });
  if (!row) return fail(404, "Only drafts can be re-themed.");
  const pkg = row.package as unknown as TemplatePackage;
  const picked = Object.fromEntries(Object.entries(colors).filter(([k, v]) => ROLES.includes(k) && HEX.test(v)));
  const theme = normalizeTheme({ ...pkg.theme, ...picked, preset: undefined, ...(picked.accent ? { onAccent: readableOn(picked.accent) } : {}) });
  await db.builderTemplateVersion.update({ where: { id: row.id }, data: { package: { ...pkg, theme } as unknown as Prisma.InputJsonValue } });
  return { ok: true, theme };
}
