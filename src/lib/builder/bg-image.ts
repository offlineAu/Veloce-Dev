/*
 * Background photos in imported designs. Exports often set photos as inline `style="background-image: url(…)"`
 * rather than <img>. The importer turns that URL into an image field (bound as `bg`), and renderers set it back as
 * a CSS background through bgImage(), which only accepts plain https or same-site package addresses.
 */

/** The first url(...) of an inline background or background-image declaration. */
const BG_DECL = /(?:^|;)\s*background(?:-image)?\s*:[^;]*?url\(\s*(['"]?)([^'")]+)\1\s*\)/i;

/** The photo address of an inline style attribute, or undefined. */
export function backgroundUrl(style: string | undefined): string | undefined {
  const m = style?.match(BG_DECL);
  return m?.[2]?.trim() || undefined;
}

const SAFE_SRC = /^(https:\/\/|\/(?!\/))[^\s'"()\\<>]+$/i;

/** A CSS background-image value for an image field's value, or undefined when it's empty or not a safe address. */
export function bgImage(src: string | undefined): string | undefined {
  return src && SAFE_SRC.test(src) ? `url("${src}")` : undefined;
}
