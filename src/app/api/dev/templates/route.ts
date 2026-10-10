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

const MAX_BODY = 4_000_000;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
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
  const dev = await session();
  if (!dev) return fail(401, SESSION_ENDED);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return fail(413, "That upload is over 4 MB. Leave out screenshots or split it up.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "The upload couldn't be read.");
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const screens = form.getAll("screens").map((f) => (f instanceof File && f.size ? f : null));
  const design = form.get("designMd");

  const { uploadTemplate } = await import("@/server/builder/upload-service");
  const outcome = await uploadTemplate(
    {
      name: String(form.get("name") ?? ""),
      slug: String(form.get("slug") ?? ""),
      websiteType: String(form.get("websiteType") ?? "BUSINESS"),
      description: String(form.get("description") ?? ""),
      designMd: design instanceof File && design.size ? await design.text() : undefined,
      pages: await Promise.all(
        files.map(async (f, i) => ({
          fileName: f.name,
          html: await f.text(),
          screen: screens[i] ? Buffer.from(await screens[i]!.arrayBuffer()) : undefined,
        })),
      ),
    },
    { uploadedBy: dev.name, ipHash: await clientKey() },
  );
  return outcome.ok ? NextResponse.json(outcome) : fail(outcome.status, outcome.error);
}

/** Re-map a draft's theme colours from the design's palette, without uploading again. */
export async function PATCH(req: Request) {
  const dev = await session();
  if (!dev) return fail(401, SESSION_ENDED);
  const body = (await req.json().catch(() => null)) as { slug?: string; version?: number; colors?: Record<string, string> } | null;
  if (!body?.slug || !Number.isInteger(body.version)) return fail(400, "Missing template or version.");
  const { rethemeDraft } = await import("@/server/builder/upload-service");
  const outcome = await rethemeDraft(body.slug, body.version!, body.colors ?? {});
  return outcome.ok ? NextResponse.json(outcome) : fail(outcome.status, outcome.error);
}
