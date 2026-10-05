import styles from "./card-ribbons.module.css";

/** Three soft diagonal ribbons echoing the Veloce mark. Decorative only. */
export function CardRibbons({ activeStage }: { activeStage?: "think" | "build" | "improve" }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 200"
      className={styles.motif}
      data-card-ribbons
      data-active-stage={activeStage}
    >
      <g strokeWidth="10" strokeLinejoin="round">
        <path className={styles.ribbon} data-stage="think" d="M 98 -28 L 136 10 L 34 112 L -4 74 Z" />
        <path className={styles.ribbon} data-stage="build" d="M 164 -10 L 202 28 L 86 144 L 48 106 Z" />
        <path className={styles.ribbon} data-stage="improve" d="M 230 8 L 268 46 L 164 150 L 126 112 Z" />
      </g>
    </svg>
  );
}
