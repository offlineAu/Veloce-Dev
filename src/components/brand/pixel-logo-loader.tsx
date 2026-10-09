import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { LOGO_POLYGONS } from "./logo";
import { LOGO_CELLS, MARK_HEIGHT, MARK_WIDTH } from "./pixel-logo-loader-geometry";
import styles from "./pixel-logo-loader.module.css";

type PixelLogoLoaderProps = ComponentProps<"svg"> & {
  variant?: "page" | "compact";
};

/** Decorative waiting indicator. The caller supplies loading text and status semantics. */
export function PixelLogoLoader({ variant = "page", className, ...props }: PixelLogoLoaderProps) {
  const clipId = `pixel-logo-${useId()}`;
  const size = variant === "page" ? 80 : 20;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      {...props}
      viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      width={size}
      height={size}
      fill="currentColor"
      className={cn(styles.loader, "shrink-0", className)}
      data-pixel-loader={variant}
    >
      <defs>
        <clipPath id={clipId}>
          {LOGO_POLYGONS.map((points) => <polygon key={points} points={points} />)}
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {LOGO_CELLS[variant].map(({ step, ...cell }) => (
          <rect key={`${cell.x}-${cell.y}`} {...cell} className={cn(styles.tile, styles[`step${step}`])} />
        ))}
      </g>
      <g className={styles.solid}>
        {LOGO_POLYGONS.map((points) => <polygon key={points} points={points} />)}
      </g>
    </svg>
  );
}
