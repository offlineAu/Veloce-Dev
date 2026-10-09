import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CardRibbons } from "@/components/brand/card-ribbons";
import { BorderBeam } from "@/components/motion/border-beam";
import { OpenInquiryButton } from "@/components/forms/inquiry";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { builderGuide } from "@/content/site";

/** Builds a /build link that keeps the visitor's referral, so a design sent from the builder stays attributed. */
const buildHref = (refToken?: string, template?: string) => {
  const q = new URLSearchParams();
  if (template) q.set("template", template);
  if (refToken) q.set("ref", refToken);
  const s = q.toString();
  return s ? `/build?${s}` : "/build";
};

/** "What we offer": how to design a site in the builder, with a way into it. */
export function BuilderGuide({ refToken }: { refToken?: string }) {
  const { heading, lead, steps, templates, note } = builderGuide;
  return (
    <div data-builder-guide className="relative grid gap-10 overflow-hidden rounded-xl bg-accent-100 p-7 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
      <CardRibbons />
      <BorderBeam />
      <div className="relative flex flex-col items-start gap-5">
        <Badge className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em]">What we offer</Badge>
        <h2 id="offer-title" className="text-[clamp(30px,3.6vw,46px)] leading-[1.1]">{heading}</h2>
        <p className="max-w-[46ch] text-[17px] leading-relaxed text-ink">{lead}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={buildHref(refToken)} className={buttonVariants({ size: "lg" })}>
            Open the builder <ArrowRight aria-hidden />
          </Link>
          <OpenInquiryButton variant="outline" size="lg">Rather just talk?</OpenInquiryButton>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink">Or jump straight into a template:</p>
          <ul className="flex flex-wrap gap-2" aria-label="Start from a template">
            {templates.map((t) => (
              <li key={t.id}>
                <Link
                  href={buildHref(refToken, t.id)}
                  className="inline-flex min-h-11 items-center rounded-full bg-bg px-4 text-[15px] font-semibold text-ink ring-2 ring-transparent transition-colors hover:ring-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted">{note}</p>
      </div>

      <ol className="relative flex flex-col gap-3 rounded-xl bg-bg p-6 shadow-md sm:p-8" aria-label="How it works">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-lg p-2">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-100 font-heading text-lg text-accent-700">
              {i + 1}
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-heading text-[clamp(19px,1.8vw,22px)] leading-tight">{s.title}</span>
              <span className="text-[15.5px] leading-relaxed text-muted">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
