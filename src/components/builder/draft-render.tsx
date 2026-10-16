"use client";

import { Render } from "@puckeditor/core";
import type { Collection, Menus } from "@/lib/builder/content";
import type { PageRef, SitePage } from "@/lib/builder/site-doc";
import { builderConfig, type BuilderData } from "./config";
import type { BuilderMetadata } from "./links";
import type { LoadedTemplate } from "./template-registry";

type SiteContent = { collections?: Collection[]; menus?: Menus; itemPages?: Record<string, string> };

/**
 * One page of a submitted design, as the editor showed it but without editing tools. Links between pages work, and a
 * collection's item page shows the item in the address (`itemSlug`).
 */
export function DraftRender({ page, pages, template, extraCss, content, itemSlug }: { page: SitePage; pages: PageRef[]; template?: LoadedTemplate; extraCss?: string; content?: SiteContent; itemSlug?: string }) {
  const metadata: BuilderMetadata & { template?: LoadedTemplate; extraCss?: string; itemSlug?: string } = {
    pages,
    template,
    extraCss,
    ...content,
    itemSlug,
    pageHref: (p, slug) => `?page=${encodeURIComponent(slug ? `${p.path === "/" ? "" : p.path}/${slug}` : p.path)}`,
  };
  return <Render config={builderConfig} data={page.data as Partial<BuilderData>} metadata={metadata} />;
}
