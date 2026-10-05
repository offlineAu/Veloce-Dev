"use client";

import { useId, useState } from "react";
import { ArrowRight, ChevronDown, Globe, RefreshCw, Workflow } from "lucide-react";
import { servicePaths, type ServiceItem } from "@/content/site";
import { LogoMark } from "@/components/brand/logo";
import { OpenInquiryButton } from "@/components/forms/inquiry";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import styles from "./veloce-bento.module.css";

export function ServicesExplorer({ services }: { services: ServiceItem[] }) {
  const [path, setPath] = useState("all");
  const [open, setOpen] = useState<string | null>(services[0]?.slug ?? null);
  const id = useId();
  const icons = { globe: Globe, flow: Workflow, refresh: RefreshCw };
  const knownSlugs = new Set<string>(servicePaths.flatMap((p) => [...p.slugs]));
  const otherServices = services.filter((s) => !knownSlugs.has(s.slug));
  const selectedPath = servicePaths.find((p) => p.id === path);
  const shown = path === "other" ? otherServices : selectedPath ? services.filter((s) => (selectedPath.slugs as readonly string[]).includes(s.slug)) : services;

  function choosePath(next: string) {
    setPath(next);
    setOpen(null);
  }

  return (
    <div className={cn(styles.services, "mt-12")} data-services-explorer>
      <aside className={styles.servicePicker} aria-label="Choose the work you need">
        <div className={styles.pickerIntro}><LogoMark className={styles.mark} /><p className={styles.eyebrow}>Start with the need</p></div>
        <h3>What needs to work better?</h3>
        <p className={styles.muted}>Choose a direction to explore the services that fit. A project can bring several of these together.</p>
        <div className={styles.pathList} role="group" aria-label="Service directions">
          {servicePaths.map((p) => {
            const count = services.filter((s) => (p.slugs as readonly string[]).includes(s.slug)).length;
            if (!count) return null;
            const PathIcon = icons[p.icon];
            return (
              <button key={p.id} type="button" aria-pressed={path === p.id} aria-controls={`${id}-services`} className={styles.pathButton} onClick={() => choosePath(p.id)}>
                <PathIcon aria-hidden /><span><strong>{p.label}</strong><small>{p.description}</small></span><ArrowRight aria-hidden className={styles.pathArrow} />
              </button>
            );
          })}
          {otherServices.length ? <button type="button" aria-pressed={path === "other"} aria-controls={`${id}-services`} className={styles.pathButton} onClick={() => choosePath("other")}><span><strong>Other services</strong><small>More ways we can help your business.</small></span><ArrowRight aria-hidden /></button> : null}
        </div>
        <button type="button" className={styles.textButton} aria-pressed={path === "all"} aria-controls={`${id}-services`} onClick={() => choosePath("all")}>Explore all services <span aria-hidden>({services.length})</span><ArrowRight aria-hidden /></button>
      </aside>
      <div className={styles.serviceResults} id={`${id}-services`}>
        <div className={styles.resultHeading}><p className={styles.eyebrow}>{selectedPath?.label ?? (path === "other" ? "Other services" : "What we can build")}</p><p className={styles.muted} role="status">{shown.length} {shown.length === 1 ? "service" : "services"} · Select one to read more</p></div>
        <div className={styles.serviceGrid}>
          {shown.map((s) => {
            const expanded = open === s.slug;
            const index = services.indexOf(s);
            const detailId = `${id}-detail-${index}`;
            return (
              <article key={s.slug} className={styles.serviceCard} data-expanded={expanded}>
                <h3><button type="button" className={styles.serviceToggle} aria-expanded={expanded} aria-controls={detailId} onClick={() => setOpen(expanded ? null : s.slug)}>
                  <span className={styles.serviceGlyph}><Icon name={s.icon} /></span><span>{s.title}</span><ChevronDown aria-hidden className={styles.chevron} />
                </button></h3>
                {s.benefit ? <p className={styles.serviceBenefit}>{s.benefit}</p> : null}
                <div id={detailId} hidden={!expanded} className={styles.serviceDetail}>
                  <p>{s.description}</p>
                  <OpenInquiryButton service={{ slug: s.slug, title: s.title }} variant="ghost" size="sm" className={styles.inquiry} aria-label={`Ask about ${s.title}`}>Ask about this <ArrowRight aria-hidden className="size-4" /></OpenInquiryButton>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
