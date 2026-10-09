/*
 * Chat action revealed above the floating launcher, with a visible icon and label.
 * Usage: <Button className={fabClass}><Icon/><span className={fabLabelClass}>Start a conversation</span></Button>
 */
export const fabClass =
  "h-14 min-w-14 w-auto justify-center gap-2.5 overflow-hidden rounded-full border border-on-inverse/10 bg-inverse pl-5 pr-6 text-[15px] font-semibold text-on-inverse [&_svg]:text-accent " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_14px_32px_-8px_color-mix(in_srgb,var(--color-inverse)_55%,transparent)] " +
  "transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none";

export const fabLabelClass =
  "whitespace-nowrap";
