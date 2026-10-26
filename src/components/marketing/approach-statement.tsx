import { ArrowUpRight } from "lucide-react";
import { landing } from "@/content/site";
import { StaggerText } from "@/components/motion/stagger-text";

/** An open editorial statement: the message carries the section. */
export function ApproachStatement({ contactHref = "#contact" }: { contactHref?: string }) {
  return (
    <div className="grid gap-8 border-y border-line py-16 md:grid-cols-[1fr_2fr] md:gap-14 md:py-24">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted">
        {landing.approachEyebrow}
      </p>
      <div className="flex min-w-0 flex-col items-start gap-7">
        <h2 id="fit-title" className="max-w-[18ch] text-[clamp(40px,5.8vw,76px)] leading-[1.02] tracking-[-0.05em] text-ink">
          <StaggerText text={landing.approachTitle} bold={6} />
        </h2>
        <p className="max-w-[48ch] text-[17px] leading-relaxed text-muted">{landing.approachLead}</p>
        <a href={contactHref} className="inline-flex min-h-11 items-center gap-3 border-b border-ink py-2 text-sm font-semibold text-ink transition-colors hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-700">
          {landing.approachCta}
          <ArrowUpRight aria-hidden className="size-4" />
        </a>
      </div>
    </div>
  );
}
