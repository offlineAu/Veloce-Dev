import type { ReactNode } from "react";
import { CardRibbons } from "@/components/brand/card-ribbons";
import { BorderBeam } from "@/components/motion/border-beam";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { StaggerText } from "@/components/motion/stagger-text";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  titleId,
  lead,
  tone = "accent",
  as: Tag = "h2",
  bold = 0,
  className,
}: {
  eyebrow?: string;
  /** Plain text: it is split into words for the stagger effect. */
  title: string;
  /** How many trailing words of the title are set bold on their own line. */
  bold?: number;
  titleId?: string;
  lead?: ReactNode;
  tone?: "accent" | "sage";
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <Reveal className={cn("flex max-w-3xl flex-col gap-4", className)}>
      {eyebrow ? (
        <p className={cn("flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.14em]", tone === "accent" ? "text-accent-700" : "text-sage-700")}>
          <span aria-hidden className="size-2 bg-current" />
          {eyebrow}
        </p>
      ) : null}
      <Tag id={titleId} className="text-[clamp(32px,4.2vw,52px)] leading-[1.05] text-ink">
        <StaggerText text={title} bold={bold} />
      </Tag>
      {lead ? <p className="text-[17px] leading-relaxed text-muted">{lead}</p> : null}
    </Reveal>
  );
}

export function ServiceCard({
  title,
  description,
  benefit,
  icon,
  index = 0,
  numbered = false,
  action,
}: {
  title: string;
  description: string;
  benefit?: string | null;
  icon?: string | null;
  index?: number;
  /** Show the 01, 02… index (original offer page). */
  numbered?: boolean;
  action?: ReactNode;
}) {
  const sage = index % 2 === 1;
  return (
    <Card className="h-full gap-3 rounded-lg border-0 bg-surface p-7 shadow-none transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between">
        <span className={cn("grid size-13 place-items-center rounded-full", sage ? "bg-sage-100 text-sage-700" : "bg-accent-100 text-accent-700")}>
          <Icon name={icon} className="size-6" />
        </span>
        {numbered ? (
          <span aria-hidden className="font-heading text-[15px] text-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 text-[22px] leading-tight">{title}</h3>
      <p className="text-[15.5px] leading-relaxed text-muted">{description}</p>
      {benefit ? <p className="text-[15px] font-semibold text-ink">{benefit}</p> : null}
      {action ? <div className="mt-auto pt-2">{action}</div> : null}
    </Card>
  );
}

export function FeatureCard({ title, body, icon }: { title: string; body: string; icon?: string }) {
  return (
    <div className="flex items-start gap-4 rounded-lg bg-neutral-100 p-5 transition-colors hover:bg-sage-100">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-200 text-sage-800">
        <Icon name={icon} className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[19px] leading-tight">{title}</h3>
        <p className="text-[15px] leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}

const stepTones = [
  "bg-accent-100 text-accent-800",
  "bg-sage-200 text-sage-800",
  "bg-accent-200 text-accent-800",
  "bg-neutral-200 text-sage-800",
];

export function ProcessStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <Reveal as="li" delay={((n - 1) % 3) * 0.08} className="flex flex-col gap-3">
      <div aria-hidden className="flex items-center gap-3">
        <span className={cn("grid size-[68px] shrink-0 place-items-center rounded-full font-heading text-2xl", stepTones[(n - 1) % stepTones.length])}>
          {String(n).padStart(2, "0")}
        </span>
        <span className="h-1.5 flex-1 rounded-full bg-neutral-200" />
      </div>
      <h3 className="mt-2 text-[21px] leading-tight">
        <span className="sr-only">Step {n}: </span>
        {title}
      </h3>
      <p className="max-w-[32ch] text-[15.5px] leading-relaxed text-muted">{body}</p>
    </Reveal>
  );
}

export function TestimonialCard({ quote, name, role }: { quote: string; name: string; role?: string }) {
  return (
    <figure className="flex flex-col gap-5 rounded-xl bg-surface p-8">
      <blockquote className="text-[20px] leading-relaxed">&ldquo;{quote}&rdquo;</blockquote>
      <figcaption className="text-[15px]">
        <strong className="font-semibold">{name}</strong>
        {role ? <span className="text-muted"> · {role}</span> : null}
      </figcaption>
    </figure>
  );
}

export function ReferralBadge({ name, initials: ini }: { name: string; initials: string }) {
  return (
    <span className="inline-flex items-center gap-3 rounded-full bg-bg py-2 pl-2 pr-5 shadow-md">
      <span aria-hidden className="grid size-9 place-items-center rounded-full bg-sage-700 text-[13px] font-bold text-on-sage">
        {ini || "★"}
      </span>
      <span className="text-sm leading-tight">
        <span className="block text-xs text-muted">Introduced by</span>
        <strong className="font-semibold">{name}</strong>
      </span>
    </span>
  );
}

export function ReferralOfferCard({
  title,
  description,
  validUntil,
  variant = "light",
  claim,
  blocks,
  children,
}: {
  title?: string | null;
  description?: string | null;
  validUntil?: string | null;
  variant?: "light" | "dark";
  claim: string;
  /** Optional info tiles (e.g. what you get / why / how to claim), as in the original referral page. */
  blocks?: { label: string; text: string }[];
  children?: ReactNode;
}) {
  const dark = variant === "dark";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-8 sm:p-12",
        dark ? "border border-line bg-surface text-ink" : "bg-accent-100 text-ink",
      )}
    >
      <CardRibbons />
      <div className="relative flex flex-col items-start gap-5">
        <p className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em]", dark ? "bg-accent text-on-accent" : "bg-accent-600 text-on-accent")}>
          <Icon name="gift" className="size-3.5" /> Special offer
        </p>
        {title ? (
          <p className={cn("max-w-[24ch] font-heading text-[clamp(26px,3vw,38px)] leading-tight", dark && "text-accent-800")}>{title}</p>
        ) : null}
        {description ? <p className={cn("max-w-[56ch] text-[17px] leading-relaxed", dark ? "text-ink/90" : "text-muted")}>{description}</p> : null}
        {blocks?.length ? (
          <div className="mt-2 grid w-full gap-4 sm:grid-cols-3">
            {blocks.map((b) => (
              <div key={b.label} className="flex flex-col gap-2 rounded-lg bg-bg/10 p-6">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-accent-700">{b.label}</p>
                <p className="text-base leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className={cn("max-w-[56ch] text-[15px] leading-relaxed", dark ? "text-ink/85" : "text-muted")}>
            <strong className="font-semibold">How to claim:</strong> {claim}
          </p>
        )}
        {validUntil ? <p className={cn("text-sm", dark ? "text-ink/85" : "text-muted")}>Valid until {validUntil}.</p> : null}
        {children}
      </div>
    </div>
  );
}

/** Sales-page offer layout from the original: tinted panel, copy on the left, "your offer" card on the right. */
export function OfferSplit({
  heading,
  lead,
  title,
  description,
  lines,
  badge = "Special offer",
  cardLabel = "Your offer",
  children,
}: {
  heading: string;
  lead: string;
  title?: string | null;
  description?: string | null;
  lines: string[];
  badge?: string;
  cardLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative grid items-center gap-8 overflow-hidden rounded-xl bg-accent-100 p-7 sm:p-12 lg:grid-cols-2 lg:gap-16">
      <CardRibbons />
      <BorderBeam />
      <div className="relative flex flex-col items-start gap-4">
        <Badge className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em]">{badge}</Badge>
        <h2 className="text-[clamp(30px,3.6vw,46px)] leading-[1.1]">{heading}</h2>
        <p className="max-w-[46ch] text-[17px] leading-relaxed text-ink">{lead}</p>
      </div>
      <div className="relative flex flex-col gap-4 rounded-xl bg-bg p-7 shadow-md sm:p-9">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-accent-100 text-accent-700">
            <Icon name="gift" className="size-5" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-accent-700">{cardLabel}</span>
        </div>
        {title ? <p className="font-heading text-[clamp(24px,2.6vw,32px)] leading-tight">{title}</p> : null}
        {description ? <p className="text-[16px] leading-relaxed text-muted">{description}</p> : null}
        <div className="flex flex-col gap-1.5 text-[14.5px] leading-snug text-muted">
          {lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
