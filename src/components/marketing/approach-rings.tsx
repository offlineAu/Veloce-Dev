import { Check } from "lucide-react";
import { landing } from "@/content/site";
import { buttonVariants } from "@/components/ui/button";
import { StaggerText } from "@/components/motion/stagger-text";

/*
 * "Built around your business" panel from the reference design: centred message over concentric rings, with small
 * floating cards. The cards are decorative (aria-hidden) and describe how the work runs; they never show names,
 * quotes or results. Cards appear from md (the two small charts from lg) so phones get just the message.
 */
const card = "absolute z-10 rounded-2xl border border-line bg-surface/90 shadow-sm backdrop-blur-sm";

export function ApproachRings({ contactHref = "#contact" }: { contactHref?: string }) {
  const c = landing.approachCards;
  return (
    <div className="relative flex w-full flex-col items-center overflow-hidden rounded-[28px] border border-line bg-neutral-200 px-6 py-16 text-center sm:px-14 lg:px-20 lg:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center opacity-60">
        {[320, 460, 600, 740].map((d, i) => (
          <span key={d} className="absolute rounded-full border border-ink/10" style={{ width: d, height: d, opacity: 1 - i * 0.2 }} />
        ))}
      </div>

      <div aria-hidden className={`${card} left-10 top-10 hidden items-center gap-3 p-2 pr-4 md:flex`}>
        <span className="grid size-10 place-items-center rounded-xl bg-inverse text-accent">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span className="text-left">
          <span className="block text-[11px] font-bold text-ink">{c.early.title}</span>
          <span className="block font-mono text-[10px] text-accent-700">{c.early.note}</span>
        </span>
      </div>

      <div aria-hidden className={`${card} bottom-12 right-10 hidden items-center gap-3 p-2 pr-4 md:flex`}>
        <span className="grid size-10 place-items-center rounded-xl bg-accent font-mono text-[11px] font-bold text-on-accent">01</span>
        <span className="text-left">
          <span className="block text-[11px] font-bold text-ink">{c.scope.title}</span>
          <span className="block font-mono text-[10px] text-accent-700">{c.scope.note}</span>
        </span>
      </div>

      <div aria-hidden className={`${card} bottom-16 left-16 hidden rounded-xl p-3 text-left font-mono lg:block`}>
        <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold text-ink">
          <span className="size-2 rounded-full bg-accent" />
          {c.progress.title}
        </p>
        <span className="block h-1 w-28 overflow-hidden rounded-full bg-neutral-300">
          <span className="block h-full w-4/5 bg-inverse" />
        </span>
        <p className="mt-1.5 text-[9px] text-muted">{c.progress.note}</p>
      </div>

      <div aria-hidden className={`${card} right-16 top-14 hidden rounded-xl p-3 text-left font-mono lg:block`}>
        <p className="mb-1.5 text-[10px] font-bold text-ink">{c.improve.title}</p>
        <span className="flex h-6 w-24 items-end gap-1">
          {["h-3", "h-4", "h-5"].map((h) => (
            <span key={h} className={`w-3 rounded-t bg-neutral-300 ${h}`} />
          ))}
          <span className="h-6 w-3 rounded-t bg-inverse" />
          <span className="h-6 w-3 rounded-t bg-accent" />
        </span>
        <p className="mt-1.5 text-[9px] text-muted">{c.improve.note}</p>
      </div>

      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-4">
        <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted">
          <span aria-hidden className="size-2 bg-current" />
          {landing.approachEyebrow}
        </p>
        <h2 id="fit-title" className="text-[clamp(30px,4vw,48px)] leading-[1.08] text-ink">
          <StaggerText text={landing.approachTitle} bold={6} />
        </h2>
        <p className="pt-1 text-[15px] leading-relaxed text-muted">{landing.approachLead}</p>
        <a href={contactHref} className={buttonVariants({ size: "sm", className: "mt-3 px-8 font-mono text-xs uppercase tracking-[0.08em]" })}>
          {landing.approachCta}
        </a>
      </div>
    </div>
  );
}
