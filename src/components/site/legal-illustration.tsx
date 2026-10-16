/** Small editorial drawings, using the site's own palette rather than a photographic backdrop. */
export function LegalIllustration({ kind }: { kind: "privacy" | "terms" }) {
  return (
    <svg viewBox="0 0 300 230" fill="none" aria-hidden="true" focusable="false">
      <path d="M34 203H267" stroke="var(--color-line)" strokeWidth="1.5" strokeLinecap="round" />
      <g transform="rotate(-8 138 123)">
        <path d="M63 63a9 9 0 0 1 9-9h44l14 15h81a9 9 0 0 1 9 9v116H63V63Z" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="1.5" />
      </g>
      <g transform="rotate(6 158 112)">
        <path d="M96 32h92l28 28v123a9 9 0 0 1-9 9H96a9 9 0 0 1-9-9V41a9 9 0 0 1 9-9Z" fill="var(--color-neutral-100)" stroke="var(--color-ink)" strokeWidth="1.5" />
        <path d="M188 32v22a6 6 0 0 0 6 6h22" stroke="var(--color-ink)" strokeWidth="1.5" />
        <path d="M107 65h35M107 86h62M107 98h76M107 110h48" stroke="var(--color-line)" strokeWidth="3" strokeLinecap="round" />
        {kind === "privacy" ? (
          <>
            <path d="m152 123 25 9v20c0 18-25 31-25 31s-25-13-25-31v-20l25-9Z" fill="var(--color-sage-200)" stroke="var(--color-sage-800)" strokeWidth="1.5" strokeLinejoin="round" />
            <rect x="142" y="147" width="20" height="16" rx="3" stroke="var(--color-sage-800)" strokeWidth="1.5" />
            <path d="M146 147v-5a6 6 0 0 1 12 0v5M152 153v4" stroke="var(--color-sage-800)" strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="m108 148 5 5 9-10M108 169l5 5 9-10" stroke="var(--color-sage-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M133 149h48M133 170h34" stroke="var(--color-line)" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </g>
      {kind === "privacy" ? (
        <g transform="rotate(-12 229 159)">
          <rect x="203" y="137" width="51" height="43" rx="7" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="1.5" />
          <path d="m204 140 24 18 25-18" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="252" cy="137" r="5" fill="var(--color-accent)" />
        </g>
      ) : (
        <g transform="rotate(32 229 135)">
          <path d="M224 76a6 6 0 0 1 12 0v98l-6 16-6-16V76Z" fill="var(--color-sage-200)" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M224 88h12M224 174h12M230 187v3" stroke="var(--color-ink)" strokeWidth="1.5" />
          <path d="M224 76a6 6 0 0 1 12 0v12h-12V76Z" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="1.5" />
        </g>
      )}
      <path d="M47 99v12m-6-6h12M245 67v8m-4-4h8" stroke="var(--color-sage-700)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="64" cy="151" r="3" fill="var(--color-accent)" />
    </svg>
  );
}
