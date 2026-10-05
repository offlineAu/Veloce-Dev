/**
 * Reading-progress bar at the top of the page. CSS scroll-driven animation (animation-timeline: scroll()),
 * so it runs off the main thread. Progressive enhancement: renders nothing where unsupported or when the user
 * prefers reduced motion (see globals.css).
 */
export function ScrollProgress() {
  return <div aria-hidden className="scroll-progress" />;
}
