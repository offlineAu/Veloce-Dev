/**
 * Full-bleed, decorative background for a page section: one soft colour glow, optionally with a faint dot texture.
 * The parent <section> must be `relative`. Pure CSS (see .section-backdrop in globals.css), colours come from theme
 * tokens so it follows both palettes. Static: no animation, no JS.
 */
export function SectionBackdrop({
  tone = "accent",
  side = "left",
  dots = false,
}: {
  tone?: "accent" | "sage";
  side?: "left" | "center" | "right";
  dots?: boolean;
}) {
  return <div aria-hidden className="section-backdrop" data-tone={tone} data-side={side} data-dots={dots || undefined} />;
}
