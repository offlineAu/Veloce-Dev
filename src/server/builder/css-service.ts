import "server-only";
import { createHash } from "node:crypto";
import { normalizeTheme, type ThemeTokens } from "@/lib/builder/theme";
import { CLASS_PREFIX } from "@/lib/builder/template-package";
import { missingFrom, siteThemeCss, themeFromCss } from "@/lib/builder/theme-vars";
import { db } from "@/server/db";
import { readTemplate, type Access } from "./template-registry";

/*
 * Compiles the classes a visitor added (Style panel, Edit HTML) that the template's stylesheet doesn't already define,
 * against the template's own theme, so `vt:grid-cols-5` or `vt:bg-primary/20` work on any design. Results are cached
 * in memory and in Postgres by a hash of template version, theme and classes. Only `vt:`-prefixed class names are
 * compiled, and the output is scoped to the template (or "site"), like a template's own stylesheet.
 */

const CLASS_TOKEN = /^[\w:/[\]().%#,!'"&>*+~=@-]{1,200}$/;
export const MAX_CLASSES = 400;

const memory = new Map<string, string>();
const remember = (key: string, css: string) => {
  if (memory.size > 300) memory.delete(memory.keys().next().value!);
  memory.set(key, css);
};

export const validClasses = (classes: unknown): string[] =>
  Array.isArray(classes)
    ? [...new Set(classes.filter((c): c is string => typeof c === "string" && c.startsWith(CLASS_PREFIX) && CLASS_TOKEN.test(c)))].sort().slice(0, MAX_CLASSES)
    : [];

export type CssTarget = { slug: string; version: number } | { site: ThemeTokens };

/** CSS for `classes` on a template version (only those its stylesheet lacks) or on a site without a template. */
export async function compileExtraCss(target: CssTarget, classes: string[], access: Access = {}): Promise<string | null> {
  let scope: string;
  let theme: string;
  let wanted = classes;
  if ("slug" in target) {
    const tpl = await readTemplate(target.slug, target.version, { requirePublished: false, ...access });
    if (!tpl) return null;
    wanted = missingFrom(tpl.css, classes);
    scope = target.slug;
    theme = themeFromCss(tpl.css);
  } else {
    scope = "site";
    theme = siteThemeCss(normalizeTheme(target.site));
  }
  if (!wanted.length) return "";

  const key = createHash("sha256").update(JSON.stringify([scope, "slug" in target ? target.version : 0, theme, wanted])).digest("hex");
  const hit = memory.get(key) ?? (await db.builderCssCache.findUnique({ where: { key }, select: { css: true } }))?.css;
  if (hit !== undefined) {
    remember(key, hit);
    return hit;
  }

  const [{ compileTemplateCss }, { Report }] = await Promise.all([import("@/lib/builder/import/css"), import("@/lib/builder/import/report")]);
  const css = await compileTemplateCss({ slug: scope, candidates: wanted, theme, extra: "", report: new Report() });
  remember(key, css);
  await db.builderCssCache.upsert({ where: { key }, create: { key, css }, update: {} }).catch(() => undefined);
  return css;
}
