/*
 * Chat action revealed above the floating launcher, with a visible icon and label.
 * Usage: <Button className={fabClass}><Icon/><span className={fabLabelClass}>Start a conversation</span></Button>
 */
export const fabClass =
  "h-14 min-w-14 w-auto justify-center gap-2.5 overflow-hidden rounded-full border border-accent-300/40 bg-gradient-to-br from-accent-300 via-accent-600 to-accent-700 pl-5 pr-6 text-[15px] font-semibold text-on-accent " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_10px_28px_-6px_color-mix(in_srgb,var(--color-accent)_60%,transparent)] " +
  "transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none";

export const fabLabelClass =
  "whitespace-nowrap";
