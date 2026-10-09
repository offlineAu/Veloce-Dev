import { cn } from "@/lib/utils";

/**
 * The Veloce mark: three slanted bars. Vector trace of the owner's supplied logo (Gemini-generated PNG), simplified to
 * straight-edged polygons. Uses currentColor so each placement follows its selected palette.
 */
export const LOGO_POLYGONS = [
  "59.8,0 60.1,27 13.7,73.3 0,59.6",
  "96.4,0.3 96.8,21.2 46.7,72.1 46.2,73.2 54.8,73.5 28.3,99.9 28.4,68.6",
  "96.6,31.3 96.4,48.9 72.5,73.1 55.7,73.1",
] as const;

export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 96.8 100"
      fill="currentColor"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {LOGO_POLYGONS.map((p) => (
        <polygon key={p} points={p} />
      ))}
    </svg>
  );
}
