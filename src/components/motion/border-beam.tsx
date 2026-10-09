import { cn } from "@/lib/utils";
import { PauseOffscreen } from "./pause-offscreen";

/*
 * A light that travels around the border of its (relatively positioned, rounded) parent.
 * Adapted from VengeanceUI "border-beam" (MIT): keyframes moved to globals.css (no styled-jsx), theme colours,
 * decorative and aria-hidden, and static under prefers-reduced-motion.
 */
export function BorderBeam({
  className,
  size = 220,
  duration = 14,
  borderWidth = 2,
  colorFrom = "var(--color-accent)",
  colorTo = "var(--color-sage)",
  delay = 0,
}: {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}) {
  return (
    <div
      aria-hidden
      style={
        {
          "--size": size,
          "--duration": duration,
          "--border-width": borderWidth,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--delay": delay,
        } as React.CSSProperties
      }
      className={cn(
        "border-beam pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]",
        "![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        "after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:[animation:border-beam_calc(var(--duration)*1s)_infinite_linear] after:[animation-delay:calc(var(--delay)*1s)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:90%_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]",
        className,
      )}
    >
      <PauseOffscreen />
    </div>
  );
}
