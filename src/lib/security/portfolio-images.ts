/** Bust the CDN/optimizer keys used before watermarked previews were published. */
export function portfolioImageUrl(src: string): string {
  return src.startsWith("/images/") && /\.webp$/.test(src) ? `${src}?preview=20261021` : src;
}
