/**
 * Subtle animated "aura" behind the hero: three blurred colour blobs drifting slowly.
 * Pure CSS (transform only, no JS, no backdrop-filter), decorative and aria-hidden. Colours come from the theme
 * tokens so it follows the page palette. Static under prefers-reduced-motion. The concept is inspired by
 * VengeanceUI's aurora-hero; it is implemented independently to stay light.
 */
export function Aura() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[780px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
    >
      <div className="aura-blob aura-a absolute -left-24 top-8 size-[520px] rounded-full bg-accent-200 opacity-70 blur-3xl" />
      <div className="aura-blob aura-b absolute right-[-120px] top-20 size-[560px] rounded-full bg-sage-200 opacity-80 blur-3xl" />
      <div className="aura-blob aura-c absolute left-[35%] top-[260px] size-[420px] rounded-full bg-accent-100 opacity-90 blur-3xl" />
    </div>
  );
}
