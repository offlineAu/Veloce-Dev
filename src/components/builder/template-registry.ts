"use client";

import { createContext, useEffect, useState } from "react";
import type { TemplateRef } from "@/lib/builder/site-doc";
import { packageBase, type TemplatePackage } from "@/lib/builder/template-package";

export interface LoadedTemplate {
  pkg: TemplatePackage;
  css: string;
}

/** The template the open site is built on, for editor chrome outside the canvas (toolbar labels, dialogs). */
export const TemplateContext = createContext<LoadedTemplate | undefined>(undefined);

const cache = new Map<string, Promise<LoadedTemplate>>();
const key = (ref: TemplateRef) => `${ref.slug}@${ref.version}`;

/**
 * Fetches an imported template's package and stylesheet from /builder-templates/… once per version. Versions are
 * immutable, so a cached copy never goes stale.
 */
export function loadTemplate(ref: TemplateRef): Promise<LoadedTemplate> {
  let p = cache.get(key(ref));
  if (!p) {
    const base = packageBase(ref.slug, ref.version);
    p = Promise.all([
      fetch(`${base}/template.json`).then((r) => (r.ok ? (r.json() as Promise<TemplatePackage>) : Promise.reject(new Error(`template ${r.status}`)))),
      fetch(`${base}/theme.css`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`theme ${r.status}`)))),
    ]).then(([pkg, css]) => ({ pkg, css }));
    p.catch(() => cache.delete(key(ref))); // let a later attempt retry
    cache.set(key(ref), p);
  }
  return p;
}

/** The template a site is built on, once loaded; undefined while loading or for sites without one. */
export function useTemplate(ref: TemplateRef | undefined): LoadedTemplate | undefined {
  const [loaded, setLoaded] = useState<{ key: string; value: LoadedTemplate } | null>(null);
  const wanted = ref ? key(ref) : null;
  useEffect(() => {
    if (!ref) return;
    let live = true;
    loadTemplate(ref).then(
      (value) => live && setLoaded({ key: key(ref), value }),
      () => undefined,
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `wanted` identifies the ref
  }, [wanted]);
  return loaded && loaded.key === wanted ? loaded.value : undefined;
}
