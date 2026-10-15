/**
 * Full-bleed, decorative background for a page section: a soft colour glow over a faint paper grain, with an optional
 * hand-drawn motif ("contours": loose topographic lines bleeding off the side; "doodles": sketchbook marks beside the
 * heading). The parent <section> must be `relative`. Static SVG + CSS (see .section-backdrop in globals.css); colours
 * come from theme tokens so it follows every palette. No animation, no JS.
 */
export type BackdropMotif = "contours" | "doodles";

export function SectionBackdrop({
  tone = "accent",
  side = "left",
  motif,
  seed = 1,
}: {
  tone?: "accent" | "sage";
  side?: "left" | "center" | "right";
  motif?: BackdropMotif;
  /** Varies the contour shape so neighbouring sections don't repeat. */
  seed?: number;
}) {
  return (
    <div aria-hidden className="section-backdrop" data-tone={tone} data-side={side}>
      <div className="grain section-backdrop-grain" />
      {motif === "contours" ? <Contours seed={seed} /> : null}
      {motif === "doodles" ? <Doodles /> : null}
    </div>
  );
}

/**
 * Solid colour panel behind a section, inset from the viewport edges with rounded corners like the hero card, for
 * sections that should read as their own surface rather than floating on the canvas. The parent <section> must be `relative`.
 */
export function SectionBand() {
  return (
    <div aria-hidden className="section-band">
      <div className="grain section-backdrop-grain" />
    </div>
  );
}

/** Closed, wobbly ring through `n` points, smoothed with Catmull-Rom curves so it reads as drawn, not plotted. */
function ring(cx: number, cy: number, r: number, phase: number, n = 40) {
  const pts = Array.from({ length: n }, (_, i): [number, number] => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.09 * Math.sin(3 * a + phase) + 0.05 * Math.sin(5 * a - phase * 1.7) + 0.03 * Math.sin(2 * a + phase * 0.6);
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.82];
  });
  const p = (i: number) => pts[(i + n) % n]!;
  let d = `M${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function Contours({ seed }: { seed: number }) {
  // Nested rings with a slowly drifting phase: like a hand-traced map, they flow together without crossing.
  const rings = Array.from({ length: 11 }, (_, i) => ({ d: ring(450, 450, 48 + i * 40, seed * 2.3 + i * 0.07), strong: i % 4 === 3 }));
  return (
    <svg className="section-backdrop-contours" viewBox="0 0 900 900" fill="none">
      {rings.map((r) => (
        <path key={r.d} d={r.d} strokeWidth={r.strong ? 1.6 : 1} opacity={r.strong ? 1 : 0.65} />
      ))}
    </svg>
  );
}

function Doodles() {
  return (
    <svg className="section-backdrop-doodles" viewBox="0 0 420 300" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* loose circle that overshoots where it closes, like one drawn around a note */}
      <path d="M236 52c46-6 88 22 90 62 2 44-40 74-92 72-50-2-84-30-80-66 4-38 44-64 96-62 12 0 22 2 30 6" strokeWidth={2.2} />
      {/* curved arrow pointing into the section */}
      <path d="M118 218c-26-30-28-74 6-104 18-16 40-22 62-20" strokeWidth={2.2} />
      <path d="M170 82l18 12-16 14" strokeWidth={2.2} />
      {/* scribbled underline */}
      <path d="M210 236c14-10 26 8 40-2s26 6 40-4 26 6 40-2 22 4 34-4" strokeWidth={2} />
      {/* hand-drawn sparkle */}
      <path d="M356 40l4 30M342 56l32-4M347 44l22 22M368 44l-20 22" strokeWidth={1.8} />
      {/* a few pencil ticks */}
      <path d="M56 70l10 6M50 92l14 2M60 112l10-4" strokeWidth={1.8} />
    </svg>
  );
}
