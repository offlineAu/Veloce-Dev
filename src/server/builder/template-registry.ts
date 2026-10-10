import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { currentVersion, findImported, isDraftVersion, isKnownVersion, showDrafts, visibleTemplates } from "@/content/builder-templates";
import { packageBase, uploadBase, type TemplateListing, type TemplatePackage } from "@/lib/builder/template-package";
import { db } from "@/server/db";

/*
 * Every template the builder offers, from two places:
 *   - repo templates: imported with the CLI, committed under public/builder-templates and listed in manifest.json;
 *   - uploaded templates: uploaded by a developer on the live site, stored in Postgres.
 * Slugs are shared between the two. Visitors only see published versions; developers (dev session) and local
 * development also see drafts.
 */

export interface LoadedPackage {
  pkg: TemplatePackage;
  css: string;
}

export interface Access {
  /**
   * A developer session: can see drafts. (Repo templates' drafts are also visible while developing locally, for CLI
   * review; uploaded drafts always need the session.)
   */
  includeDrafts?: boolean;
  /** For a new design: only versions a visitor could pick. Off when showing a design that was already submitted. */
  requirePublished?: boolean;
}

/** Root of the repo packages. Kept literal so the server bundle only includes public/builder-templates. */
let root = path.join(process.cwd(), "public", "builder-templates");
const cache = new Map<string, LoadedPackage | null>();

export const setTemplateRootForTests = (dir: string) => {
  root = path.join(dir, "builder-templates");
  cache.clear();
};

const SLUG = /^[a-z0-9-]{1,40}$/;
const ASSET_PATH = /^(fonts|img)\/[\w-]{1,64}\.(woff2|webp|png|jpe?g)$|^thumb-[\w-]{1,64}\.webp$/;

const CONTENT_TYPES: Record<string, string> = { woff2: "font/woff2", webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
export const contentTypeFor = (file: string) => CONTENT_TYPES[file.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";

export const isRepoTemplate = (slug: string) => !!findImported(slug);

function readRepo(slug: string, version: number): LoadedPackage | null {
  const key = `repo:${slug}@${version}`;
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

/**
 * Which statuses of an uploaded version this request may see: published always; unpublished only when showing
 * something already made with it; drafts only to developers.
 */
function allowedStatuses({ includeDrafts = false, requirePublished = true }: Access) {
  const out: ("PUBLISHED" | "UNPUBLISHED" | "DRAFT")[] = ["PUBLISHED"];
  if (!requirePublished) out.push("UNPUBLISHED");
  if (includeDrafts) out.push("DRAFT");
  return out;
}

/** A template version's package and stylesheet, or null when it doesn't exist or this request may not see it. */
export async function readTemplate(slug: string, version: number, access: Access = {}): Promise<LoadedPackage | null> {
  if (!SLUG.test(slug) || !Number.isInteger(version) || version < 1) return null;
  const { includeDrafts = false, requirePublished = true } = access;

  if (isRepoTemplate(slug)) {
    const listed = requirePublished ? isKnownVersion(slug, version, includeDrafts || showDrafts()) : !!findImported(slug)?.versions.includes(version);
    return listed ? readRepo(slug, version) : null;
  }

  const row = await db.builderTemplateVersion.findFirst({
    where: { version, template: { slug }, status: { in: allowedStatuses(access) } },
    select: { package: true, css: true, status: true },
  });
  if (!row) return null;
  const key = `upload:${slug}@${version}`;
  // Published versions never change; drafts can be re-themed while under review, so they are never cached.
  if (row.status !== "DRAFT" && cache.has(key)) return cache.get(key)!;
  const loaded = { pkg: row.package as unknown as TemplatePackage, css: row.css };
  if (row.status !== "DRAFT") cache.set(key, loaded);
  return loaded;
}

/** A font, image or thumbnail of a template version. */
export async function readAsset(slug: string, version: number, file: string, access: Access = {}): Promise<{ bytes: Buffer; contentType: string; draft: boolean } | null> {
  if (!SLUG.test(slug) || !Number.isInteger(version) || !ASSET_PATH.test(file)) return null;
  if (isRepoTemplate(slug)) {
    if (!(await readTemplate(slug, version, access))) return null;
    try {
      return { bytes: readFileSync(path.join(root, slug, `v${version}`, file)), contentType: contentTypeFor(file), draft: false };
    } catch {
      return null;
    }
  }
  const row = await db.builderTemplateAsset.findFirst({
    where: { path: file, version: { version, template: { slug }, status: { in: allowedStatuses(access) } } },
    select: { bytes: true, contentType: true, version: { select: { status: true } } },
  });
  return row ? { bytes: Buffer.from(row.bytes), contentType: row.contentType, draft: row.version.status === "DRAFT" } : null;
}

/** The templates a visitor (or, with drafts, a developer) can start a site from: one entry per template. */
export async function listTemplates({ includeDrafts = false }: { includeDrafts?: boolean } = {}): Promise<TemplateListing[]> {
  const repoDrafts = includeDrafts || showDrafts();
  const repo: TemplateListing[] = visibleTemplates(repoDrafts).map((t) => {
    const version = currentVersion(t, repoDrafts)!;
    return {
      slug: t.slug,
      name: t.name,
      description: t.description,
      websiteType: t.websiteType,
      scheme: t.scheme,
      source: "repo",
      version,
      draft: isDraftVersion(t, version),
      pages: t.pages,
      thumbnail: t.thumbnails[0] ? `${packageBase(t.slug, version)}/${t.thumbnails[0]}` : undefined,
    };
  });

  const rows = await db.builderTemplate.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      slug: true, name: true, description: true, websiteType: true, scheme: true,
      versions: {
        where: { status: { in: includeDrafts ? ["DRAFT", "PUBLISHED"] : ["PUBLISHED"] } },
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true, status: true, thumbnails: true, package: true },
      },
    },
  });
  const uploaded = rows.flatMap((t): TemplateListing[] => {
    const v = t.versions[0];
    if (!v || isRepoTemplate(t.slug)) return [];
    const thumbs = (v.thumbnails as string[] | null) ?? [];
    const pkg = v.package as unknown as TemplatePackage;
    return [{
      slug: t.slug,
      name: t.name,
      description: t.description,
      websiteType: t.websiteType,
      scheme: t.scheme === "dark" ? "dark" : "light",
      source: "upload",
      version: v.version,
      draft: v.status === "DRAFT",
      pages: pkg.pages.map((p) => ({ key: p.key, title: p.title })),
      thumbnail: thumbs[0] ? `${uploadBase(t.slug, v.version)}/${thumbs[0]}` : undefined,
    }];
  });
  return [...repo, ...uploaded];
}

/** Whether an image address inside a design belongs to this template version. */
export const isOwnAsset = (pkg: TemplatePackage, value: string) =>
  [packageBase(pkg.slug, pkg.version), uploadBase(pkg.slug, pkg.version)].some((base) => value.startsWith(`${base}/`)) && !value.includes("..");
