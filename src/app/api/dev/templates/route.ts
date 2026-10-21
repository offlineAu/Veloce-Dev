import { BodyLimitError, readForm, readJson } from "@/server/security/body";
import { ProcessingBusyError, withCapacity } from "@/server/security/budget";
import { allow } from "@/server/security/rate-limit";
import { NextResponse } from "next/server";
import { DevAuthError, requireDevSession } from "@/server/security/dev-session";
import { clientKey } from "@/server/security/request";

/*
 * Developer template uploads (multipart, so the 1 MB Server Action limit doesn't apply). The session is checked
 * before anything else; the upload service, and the importer it loads, run only after that.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY = 24_000_000;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "private, no-store" } });
const SESSION_ENDED = "Your developer session has ended. Unlock the panel again.";

async function session() {
  try {
    return await requireDevSession();
  } catch (e) {
    if (e instanceof DevAuthError) return null;
    throw e;
  }
}

/** Upload one or more HTML pages (first = home) as a new draft version. */
export async function POST(req: Request) {
  try { return await withCapacity("template-import", 1, () => upload(req)); }
  catch (error) { if (error instanceof ProcessingBusyError) return fail(503, error.message); throw error; }
}

async function upload(req: Request) {
  const dev = await session();
  if (!dev) return fail(401, SESSION_ENDED);
  if (req.headers.get("origin") !== new URL(req.url).origin) return fail(403, "Same-origin request required.");
  if (!await allow("templates:global:day", 100, 86_400_000)) return fail(429, "Daily import budget reached.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return fail(413, "That upload is over 24 MB. Reduce the image sizes or split it up.");

  let form: FormData;
  try {
    form = await readForm(req, MAX_BODY);
  } catch (error) {
    return fail(error instanceof BodyLimitError ? error.status : 400, "The upload could not be read within its limits.");
  }
  let totalBytes = 0;
  for (const value of form.values()) totalBytes += value instanceof File ? value.size : Buffer.byteLength(value);
  if (totalBytes > MAX_BODY) return fail(413, "That upload is over 24 MB. Reduce the image sizes or split it up.");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const screens = form.getAll("screens").map((f) => (f instanceof File && f.size ? f : null));
  // Each page as its script left it (optional, one per page; components/dev/bake.ts).
  const rendered = form.getAll("rendered").map((f) => (f instanceof File && f.size ? f : null));
  const design = form.get("designMd");
  const assets = form.getAll("assets").filter((f): f is File => f instanceof File);
  if (assets.length > 100 || assets.reduce((n, f) => n + f.size, 0) > 10_000_000) return fail(413, "Image files must total at most 10 MB (100 files maximum).");
  if (assets.some((f) => !/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(f.name) || f.name.includes("..") || f.name.startsWith("/"))) return fail(400, "Choose image files with relative paths.");
  const baseVersion = Number(form.get("baseVersion"));
  if (baseVersion && (!Number.isInteger(baseVersion) || baseVersion < 1)) return fail(400, "Invalid source version.");
  const sourceSlug = String(form.get("slug") ?? "");
  const { db } = await import("@/server/db");
  const previous = baseVersion ? await db.builderTemplateVersion.findFirst({ where: { version: baseVersion, template: { slug: sourceSlug } }, select: { assets: { where: { OR: [{ path: { startsWith: "source/assets/" } }, { path: { startsWith: "img/" } }] }, select: { path: true, bytes: true } } } }) : null;
  if (baseVersion && !previous) return fail(404, "Template version not found.");
  const mergedAssets = new Map((previous?.assets ?? []).filter(a => a.path.startsWith("source/assets/")).map((a) => [a.path.slice("source/assets/".length), Buffer.from(a.bytes)]));
  for (const file of assets) {
    // Individual files can replace an image previously selected through a folder picker.
    const matches = [...mergedAssets.keys()].filter(key => key === file.name || key.endsWith(`/${file.name}`));
    const assetPath = matches.length === 1 ? matches[0]! : file.name;
    mergedAssets.set(assetPath, Buffer.from(await file.arrayBuffer()));
  }

  const { uploadTemplate } = await import("@/server/builder/upload-service");
  const outcome = await uploadTemplate(
    {
      name: String(form.get("name") ?? ""),
      slug: String(form.get("slug") ?? ""),
      websiteType: String(form.get("websiteType") ?? "BUSINESS"),
      description: String(form.get("description") ?? ""),
      designMd: design instanceof File && design.size ? await design.text() : undefined,
      storedImageFiles: new Map((previous?.assets ?? []).filter(a => a.path.startsWith("img/")).map(a => [a.path, Buffer.from(a.bytes)])),
      assets: [...mergedAssets].map(([path, bytes]) => ({ path, bytes })),
      pages: await Promise.all(
        files.map(async (f, i) => ({
          fileName: f.name,
          html: await f.text(),
          screen: screens[i] ? Buffer.from(await screens[i]!.arrayBuffer()) : undefined,
          rendered: rendered[i] ? await rendered[i]!.text() : undefined,
        })),
      ),
    },
    { uploadedBy: dev.name, ipHash: await clientKey() },
  );
  if (outcome.ok) {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/build");
  }
  return outcome.ok ? NextResponse.json(outcome) : fail(outcome.status, outcome.error);
}

/** Re-map a draft's theme colours from the design's palette, without uploading again. */
export async function PATCH(req: Request) {
  const dev = await session();
  if (!dev) return fail(401, SESSION_ENDED);
  if (req.headers.get("origin") !== new URL(req.url).origin) return fail(403, "Same-origin request required.");
  let input: unknown;
  try { input = await readJson(req); } catch (error) { return fail(error instanceof BodyLimitError ? error.status : 400, "Invalid request body."); }
  const body = (input) as { slug?: string; version?: number; colors?: Record<string, string> } | null;
  if (!body?.slug || !Number.isInteger(body.version)) return fail(400, "Missing template or version.");
  const { rethemeDraft } = await import("@/server/builder/upload-service");
  const outcome = await rethemeDraft(body.slug, body.version!, body.colors ?? {});
  return outcome.ok ? NextResponse.json(outcome) : fail(outcome.status, outcome.error);
}

/** Original source is only available to authenticated developers, including after publication. */
export async function GET(req: Request) {
  if (!(await session())) return fail(401, SESSION_ENDED);
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const version = Number(url.searchParams.get("version"));
  if (!/^[a-z0-9-]{1,40}$/.test(slug) || !Number.isInteger(version) || version < 1) return fail(400, "Missing template or version.");
  const { db } = await import("@/server/db");
  const row = await db.builderTemplateVersion.findFirst({
    where: { version, template: { slug } },
    select: { package: true, assets: { where: { path: "source/design.json" }, select: { bytes: true } } },
  });
  if (!row) return fail(404, "Template version not found.");
  const pkg = row.package as { name?: string; description?: string; websiteType?: string };
  const source = row.assets[0] ? JSON.parse(Buffer.from(row.assets[0].bytes).toString("utf8")) : { pages: [] };
  return NextResponse.json({ ok: true, name: pkg.name, description: pkg.description, websiteType: pkg.websiteType, ...source }, { headers: { "Cache-Control": "private, no-store" } });
}
