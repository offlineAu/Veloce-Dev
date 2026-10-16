"use client";

import { memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "@puckeditor/core";
import { Search } from "lucide-react";
import { KIND_TITLES, type SectionKind } from "@/lib/builder/section-labels";
import { sectionDefaults, type TemplatePackage, type TemplateSection } from "@/lib/builder/template-package";
import { renderNode } from "./node-tree";
import { TemplateContext } from "./template-registry";
import { TEMPLATE_SECTION_PREFIX, uniqueSections } from "./template-blocks";

/*
 * The template's sections as pictures (Figma's assets panel): at the top of the Blocks tab, grouped by what they are
 * (Navigation, Hero, Features…), with search. Each card is a Puck drawer item, so it drags onto the page like any
 * block (TemplateDropConverter turns it into design pieces). Thumbnails are the real section, drawn at desktop width
 * and scaled down, mounted only once scrolled into view.
 */

const DESIGN_WIDTH = 1280;
const ORDER = Object.keys(KIND_TITLES) as Exclude<SectionKind, "utility">[];

/** One section, drawn small. */
export const SectionThumb = memo(function SectionThumb({ pkg, section, height: max = 112 }: { pkg: TemplatePackage; section: TemplateSection; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [natural, setNatural] = useState(0);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e?.contentRect.width ?? 0));
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setSeen(true), { rootMargin: "200px" });
    ro.observe(el);
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);
  const content = useMemo(() => {
    if (!seen) return null;
    const { values, items } = sectionDefaults(section);
    return renderNode(section.tree, { values, items, puck: { isEditing: false, metadata: { static: true } } } as never);
  }, [seen, section]);
  // Short parts (a top bar) get a short card; tall sections show their top.
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNatural(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [content]);
  const scale = width / DESIGN_WIDTH;
  const height = natural && scale ? Math.max(28, Math.min(max, natural * scale)) : max;
  return (
    <div ref={box} aria-hidden className="relative w-full overflow-hidden rounded-md border border-black/10 bg-white" style={{ height }}>
      {content && scale ? (
        // `transform` keeps a fixed header inside the card; inert, so nothing in it can be focused or clicked.
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left select-none" style={{ width: DESIGN_WIDTH, transform: `scale(${scale})` }} inert>
          <div ref={inner} data-vt={pkg.slug} data-vt-dark={pkg.theme.scheme === "dark" ? "" : undefined}>
            {content}
          </div>
        </div>
      ) : null}
    </div>
  );
});

/** The template's own stylesheet, once per panel (scoped to [data-vt], so it styles only the pictures). */
function TemplateStyles({ css }: { css: string }) {
  return <style>{css}</style>;
}

/** Shown above the Blocks tab's own list (Puck's `drawer` override). */
export function SectionGallery() {
  const template = useContext(TemplateContext);
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    if (!template) return [];
    const q = query.trim().toLowerCase();
    const sections = uniqueSections(template.pkg).filter((s) => s.kind !== "utility" && (!q || `${s.label} ${s.kind ? KIND_TITLES[s.kind as Exclude<SectionKind, "utility">] : ""}`.toLowerCase().includes(q)));
    return ORDER.map((kind) => ({ kind, sections: sections.filter((s) => (s.kind ?? "other") === kind) })).filter((g) => g.sections.length);
  }, [template, query]);
  if (!template) return null;
  return (
    <section aria-label={`${template.pkg.name} sections`} className="flex flex-col gap-3 border-b border-black/10 px-3 pb-4 pt-3">
      <TemplateStyles css={template.css} />
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] opacity-70">{template.pkg.name}</h3>
        <span className="text-[11px] opacity-60">Drag onto the page</span>
      </div>
      <label className="flex items-center gap-1.5 rounded-md border border-black/15 px-2 py-1.5 text-sm">
        <Search size={14} aria-hidden className="opacity-60" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sections" aria-label="Search sections" className="min-w-0 flex-1 bg-transparent outline-none" />
      </label>
      {groups.length ? null : <p className="text-xs opacity-70">No sections match “{query}”.</p>}
      {groups.map((g) => (
        <div key={g.kind} className="flex flex-col gap-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-60">{KIND_TITLES[g.kind]}</h4>
          <Drawer>
            <div className="grid grid-cols-1 gap-2">
              {g.sections.map((s) => (
                <Drawer.Item key={s.id} name={`${TEMPLATE_SECTION_PREFIX}${s.id}`} label={s.label}>
                  {() => (
                    <div className="flex cursor-grab flex-col gap-1 rounded-lg p-1 hover:bg-black/[0.04] active:cursor-grabbing" title={`Drag “${s.label}” onto the page`}>
                      <SectionThumb pkg={template.pkg} section={s} />
                      <span className="truncate px-0.5 text-xs font-medium">{s.label}</span>
                    </div>
                  )}
                </Drawer.Item>
              ))}
            </div>
          </Drawer>
        </div>
      ))}
    </section>
  );
}
