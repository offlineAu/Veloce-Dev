/**
 * Hero headline with a CSS-only word rise (no JavaScript, so it never waits for hydration and does not delay LCP
 * beyond the ~0.7s animation). Each word slides up out of a clipped line; delays are staggered. Under
 * prefers-reduced-motion the words simply appear (see .hero-word in globals.css). The text stays real text,
 * read normally by assistive tech.
 */
export function HeroHeadline({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((w, i, all) => (
        <span key={i} className="-mb-[0.1em] inline-block overflow-hidden pb-[0.1em] align-top">
          <span className="hero-word inline-block" style={{ animationDelay: `${120 + i * 90}ms` }}>
            {w}
            {i < all.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </>
  );
}
