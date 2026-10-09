"use client";

import { Render } from "@puckeditor/core";
import type { PageRef, SitePage } from "@/lib/builder/site-doc";
import { builderConfig, type BuilderData } from "./config";
import type { BuilderMetadata } from "./links";
import type { LoadedTemplate } from "./template-registry";

/** One page of a submitted design, as the editor showed it but without editing tools. Links between pages work. */
export function DraftRender({ page, pages, template }: { page: SitePage; pages: PageRef[]; template?: LoadedTemplate }) {
  const metadata: BuilderMetadata & { template?: LoadedTemplate } = {
    pages,
    template,
    pageHref: (p) => `?page=${encodeURIComponent(p.path)}`,
  };
  return <Render config={builderConfig} data={page.data as Partial<BuilderData>} metadata={metadata} />;
}
