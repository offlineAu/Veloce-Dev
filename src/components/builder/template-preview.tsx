"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Render } from "@puckeditor/core";
import { pageRefs } from "@/lib/builder/site-doc";
import { docFromTemplate } from "@/lib/builder/template-doc";
import { builderConfig, type BuilderData } from "./config";
import { useTemplate } from "./template-registry";

/** Width the miniature is laid out at before scaling, so it shows the desktop design. */
const DESIGN_WIDTH = 1280;
/** Only the top of the home page is visible in a card. */
const SECTIONS = 3;

/**
 * A live miniature of a template's home page, for templates uploaded without a screenshot. It renders the real
 * sections (the same package the editor loads, cached), laid out at desktop width and scaled to fit the card.
 */
export function TemplatePreview({ slug, version }: { slug: string; version: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const template = useTemplate({ slug, version });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale((entry?.contentRect.width ?? 0) / DESIGN_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const view = useMemo(() => {
    if (!template) return null;
    const doc = docFromTemplate(template.pkg);
    const home = doc.pages[0]!;
    const data = { ...home.data, content: home.data.content.slice(0, SECTIONS) } as Partial<BuilderData>;
    return { data, metadata: { template, pages: pageRefs(doc) } };
  }, [template]);

  return (
    <div ref={box} aria-hidden className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-surface">
      {view && scale ? (
        // `transform` also makes the design's fixed header sit inside the card instead of the dialog.
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left select-none" style={{ width: DESIGN_WIDTH, transform: `scale(${scale})` }} inert>
          <Render config={builderConfig} data={view.data} metadata={view.metadata} />
        </div>
      ) : (
        <div className="grid h-full place-items-center text-xs text-muted">Loading preview…</div>
      )}
    </div>
  );
}
