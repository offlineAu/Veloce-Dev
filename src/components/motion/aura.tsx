import { PauseOffscreen } from "./pause-offscreen";

/**
 * Subtle animated "aura" behind the hero: three soft colour blobs drifting slowly.
 * Pure CSS: radial gradients (no blur filter, which is costly to repaint on low-end GPUs) moved by transform only, decorative and aria-hidden. Colours come from the theme
 * tokens so it follows the page palette. Static when motion is reduced. The concept is inspired by
 * VengeanceUI's aurora-hero; it is implemented independently to stay light.
 */
export function Aura() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[780px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
    >
      <PauseOffscreen />
      <div className="aura-blob aura-a absolute -left-40 -top-8 size-[680px] bg-[radial-gradient(closest-side,var(--color-accent-200),transparent)] opacity-70" />
      <div className="aura-blob aura-b absolute right-[-200px] -top-4 size-[720px] bg-[radial-gradient(closest-side,var(--color-sage-200),transparent)] opacity-80" />
      <div className="aura-blob aura-c absolute left-[30%] top-[190px] size-[560px] bg-[radial-gradient(closest-side,var(--color-accent-100),transparent)] opacity-90" />
    </div>
  );
}
