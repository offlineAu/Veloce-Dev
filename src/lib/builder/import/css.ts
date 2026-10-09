/*
 * Step 3b: the template stylesheet. Compiles exactly the (prefixed) classes the design uses with Tailwind v4, on top of
 * the design's own @theme, then scopes the theme variables to [data-vt="<slug>"] so two templates (or the site
 * itself) never share variables. No preflight: the page already has Tailwind's base styles.
 */
import { compile, optimize } from "@tailwindcss/node";
import { CLASS_PREFIX } from "../template-package";
import { escapeClass } from "./classes";
import type { Report } from "./report";

export async function compileTemplateCss(opts: {
  slug: string;
  candidates: Iterable<string>;
  theme: string;
  /** Rules that are not Tailwind output (font faces, the icon font's class), appended as they are. */
  extra: string;
  report: Report;
}): Promise<string> {
  const prefix = CLASS_PREFIX.replace(/:$/, "");
  const input = [
    `@import "tailwindcss/theme.css" layer(theme) prefix(${prefix});`,
    `@import "tailwindcss/utilities.css" layer(utilities);`,
    // Stitch designs use class-based dark mode (<html class="dark">); the template root carries data-vt-dark instead.
    `@custom-variant dark (&:where([data-vt-dark], [data-vt-dark] *));`,
    opts.theme,
  ].join("\n");
  const compiler = await compile(input, { base: process.cwd(), onDependency: () => {} });
  const candidates = [...new Set(opts.candidates)];
  const built = compiler.build(candidates);

  const missing = candidates.filter((c) => c.startsWith(CLASS_PREFIX) && !built.includes(`.${escapeClass(c)}`));
  if (missing.length) {
    opts.report.warn(
      `${missing.length} class names produced no CSS (unknown to Tailwind v4 or custom to the export): ${missing.slice(0, 25).map((c) => `\`${c.slice(CLASS_PREFIX.length)}\``).join(", ")}${missing.length > 25 ? ", …" : ""}`,
    );
  }

  const scope = `[data-vt="${opts.slug}"]`;
  const scoped = built.replace(/:root,\s*:host/g, scope).replace(/(^|[\s,}]):root(?=[\s,{])/g, `$1${scope}`);
  return optimize(`${scoped}\n${opts.extra}`, { minify: true }).code;
}
