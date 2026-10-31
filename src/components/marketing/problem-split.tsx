import { ArrowDown, Check, FileSpreadsheet, Hourglass, MessagesSquare } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { story } from "@/content/site";

const problemIcons = [MessagesSquare, FileSpreadsheet, Hourglass];

/** The story's opening: the workarounds a visitor will recognise, set beside what changes once they are one system. */
export function ProblemSplit() {
  return (
    <section className="grid gap-6 py-14 md:py-20 lg:grid-cols-2 lg:gap-10" aria-labelledby="problem-title">
      <Reveal className="flex flex-col gap-7 lg:py-10">
        <h2 id="problem-title" className="max-w-[16ch] text-[clamp(30px,3.6vw,46px)] leading-[1.06] tracking-[-0.04em] text-ink">{story.problemTitle}</h2>
        <ul className="flex flex-col gap-4">
          {story.problems.map((text, i) => {
            const Icon = problemIcons[i % problemIcons.length]!;
            return (
              <li key={text} className="flex items-center gap-4 text-[17px] leading-snug text-muted">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink"><Icon className="size-[18px]" /></span>
                {text}
              </li>
            );
          })}
        </ul>
      </Reveal>
      <Reveal className="flex flex-col gap-7 rounded-xl bg-inverse p-7 text-on-inverse sm:p-10">
        <h2 className="max-w-[18ch] text-[clamp(30px,3.6vw,46px)] leading-[1.06] tracking-[-0.04em] text-on-inverse">{story.resolutionTitle}</h2>
        <ul className="flex flex-col gap-4">
          {story.resolutions.map((text) => (
            <li key={text} className="flex items-center gap-4 text-[17px] leading-snug text-on-inverse/85">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-on-accent"><Check className="size-[18px]" /></span>
              {text}
            </li>
          ))}
        </ul>
        <a href="#examples" className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-accent hover:underline">
          {story.resolutionCta} <ArrowDown aria-hidden className="size-4" />
        </a>
      </Reveal>
    </section>
  );
}
