"use client";

import { normalizePackage } from "@/lib/builder/section-labels";
import { createContext, useEffect, useState } from "react";
import type { TemplateRef } from "@/lib/builder/site-doc";
import { templateFileUrl, type TemplatePackage } from "@/lib/builder/template-package";

export interface LoadedTemplate {
  pkg: TemplatePackage;
  css: string;
}

/** The template the open site is built on, for editor chrome outside the canvas (toolbar labels, dialogs). */
export const TemplateContext = createContext<LoadedTemplate | undefined>(undefined);

const cache = new Map<string, Promise<LoadedTemplate>>();
const key = (ref: TemplateRef) => `${ref.slug}@${ref.version}`;

/**
 * Fetches a template's package and stylesheet once per version (published versions never change, so a cached copy
 * never goes stale; a draft being reviewed is fetched fresh on each page load).
 */
export function loadTemplate(ref: TemplateRef): Promise<LoadedTemplate> {
  let p = cache.get(key(ref));
  if (!p) {
    p = Promise.all([
      // Always asked again (cheap when unchanged): a version not yet published can be imported again in its place.
      fetch(templateFileUrl(ref.slug, ref.version, "template.json"), { cache: "no-cache" }).then((r) => (r.ok ? (r.json() as Promise<TemplatePackage>) : Promise.reject(new Error(`template ${r.status}`)))),
      fetch(templateFileUrl(ref.slug, ref.version, "theme.css"), { cache: "no-cache" }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`theme ${r.status}`)))),
    ]).then(([pkg, css]) => ({ pkg: normalizePackage(pkg), css }));
    p.catch(() => cache.delete(key(ref))); // let a later attempt retry
    cache.set(key(ref), p);
  }
  return p;
}

/** The template a site is built on, once loaded; undefined while loading or for sites without one. */
export function useTemplate(ref: TemplateRef | undefined): LoadedTemplate | undefined {
  return useTemplateStatus(ref).template;
}

/** The template for `ref`, and whether loading it has finished (loaded, failed, or there's nothing to load). */
export function useTemplateStatus(ref: TemplateRef | undefined): { template: LoadedTemplate | undefined; settled: boolean } {
  const [loaded, setLoaded] = useState<{ key: string; value?: LoadedTemplate } | null>(null);
  const wanted = ref ? key(ref) : null;
  useEffect(() => {
    if (!ref) return;
    let live = true;
    loadTemplate(ref).then(
      (value) => live && setLoaded({ key: key(ref), value }),
      () => live && setLoaded({ key: key(ref) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `wanted` identifies the ref
  }, [wanted]);
  const mine = loaded && loaded.key === wanted ? loaded : null;
  return { template: mine?.value, settled: !wanted || !!mine };
}
