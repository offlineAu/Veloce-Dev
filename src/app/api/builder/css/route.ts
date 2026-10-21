import { BodyLimitError, readJson } from "@/server/security/body";
import { ProcessingBusyError, withCapacity } from "@/server/security/budget";
import { NextResponse } from "next/server";
import { compileExtraCss, validClasses, type CssTarget } from "@/server/builder/css-service";
import { readDevSession } from "@/server/security/dev-session";
import { allow } from "@/server/security/rate-limit";
import { clientKey } from "@/server/security/request";

/*
 * CSS for classes a visitor added in the builder (Style panel, Edit HTML). Public, like the builder itself, so it is
 * rate-limited and only compiles valid `vt:` class names; results are cached by content.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return new Response(null, { status: 403 });
  let input: unknown;
  try { input = await readJson(req); } catch (error) { return new Response(null, { status: error instanceof BodyLimitError ? error.status : 400 }); }
  const body = (input) as { slug?: unknown; version?: unknown; theme?: unknown; classes?: unknown } | null;
  const classes = validClasses(body?.classes);
  if (!classes.length) return new Response("", { headers: { "Content-Type": "text/css" } });
  if (!(await allow("css:global:hour", 3000, 3600_000)) || !(await allow(`css:${await clientKey()}`, 240, 3600_000))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const target: CssTarget | null =
    typeof body?.slug === "string" && Number.isInteger(body.version)
      ? { slug: body.slug, version: body.version as number }
      : body?.theme && typeof body.theme === "object"
        ? { site: body.theme as never }
        : null;
  if (!target) return NextResponse.json({ error: "Missing template or theme" }, { status: 400 });

  let css: string | null;
  const includeDrafts = !!(await readDevSession());
  try { css = await withCapacity("css", 2, () => compileExtraCss(target, classes, { includeDrafts })); }
  catch (error) { if (error instanceof ProcessingBusyError) return new Response(null, { status: 503, headers: { "Retry-After": "10" } }); throw error; }
  if (css === null) return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  return new Response(css, { headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
