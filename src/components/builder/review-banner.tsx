"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishVersionAction } from "@/server/actions/dev-templates";
import { ChevronDown } from "lucide-react";
import type { TemplatePackage } from "@/lib/builder/template-package";

export interface ReviewInfo {
  slug: string;
  version: number;
  published: boolean;
  report: string;
  /** An uploaded template under a developer session: publishing happens right here. */
  canPublish: boolean;
}

const storageKey = (r: ReviewInfo) => `veloce.builder.review.${r.slug}.v${r.version}`;

function loadChecked(r: ReviewInfo): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(storageKey(r)) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Development-only review of an imported template version: the import report and a checklist of every section to
 * compare against the design's screenshots before running `npm run template:publish`.
 */
export function ReviewBanner({ review, pkg }: { review: ReviewInfo; pkg?: TemplatePackage }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>(() => loadChecked(review));
  const [published, setPublished] = useState(review.published);
  const [pending, startTransition] = useTransition();

  const publish = () =>
    startTransition(async () => {
      const r = await publishVersionAction(review.slug, review.version);
      if (r.ok) {
        setPublished(true);
        toast.success(`${review.slug} v${review.version} is live in the template picker.`);
      } else toast.error(r.error);
    });
  const sections = pkg?.pages.flatMap((p) => p.sections.map((s) => ({ id: s.id, label: s.label, page: p.title }))) ?? [];
  const done = sections.filter((s) => checked.includes(s.id)).length;

  const toggle = (id: string) => {
    const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
    setChecked(next);
    try {
      window.localStorage.setItem(storageKey(review), JSON.stringify(next));
    } catch {
      /* the checklist simply isn't remembered */
    }
  };

  return (
    <section aria-label="Template review" className="border-b border-line bg-accent-100 text-sm text-ink">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <strong>Reviewing {review.slug} v{review.version}</strong>
        <span>{published ? "Published" : review.canPublish ? "Draft: only developers can see it" : "Not published: only visible while developing"}</span>
        <span>Checked {done} of {sections.length} sections</span>
        {review.canPublish && !published ? (
          <Button size="sm" onClick={publish} disabled={pending}>
            {pending ? "Publishing…" : "Publish"}
          </Button>
        ) : null}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="ml-auto inline-flex min-h-9 items-center gap-1 font-semibold underline-offset-2 hover:underline">
          {open ? "Hide" : "Show"} report and checklist <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open ? (
        <div className="grid max-h-[45vh] gap-6 overflow-auto border-t border-line px-4 py-3 md:grid-cols-2">
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{review.report || "No report found for this version."}</pre>
          <div>
            <p className="mb-2 font-semibold">
              Compare each section with the original design, then {review.canPublish ? "publish it with the button above" : <>publish with <code>npm run template:publish -- {review.slug}</code></>}.
            </p>
            <ul className="flex flex-col gap-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <label className="flex min-h-8 items-center gap-2">
                    <input type="checkbox" checked={checked.includes(s.id)} onChange={() => toggle(s.id)} className="size-4" />
                    <span>
                      <span className="text-muted">{s.page} ·</span> {s.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
