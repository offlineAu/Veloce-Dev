"use client";

import { createContext, useContext, type MouseEvent } from "react";
import { FieldLabel } from "@puckeditor/core";
import type { Collection, Menus } from "@/lib/builder/content";
import { PAGE_LINK, type PageRef } from "@/lib/builder/site-doc";
import { safeHref } from "./blocks/shared";

/** What blocks know about the site around them, passed through the editor's `metadata`. */
export interface BuilderMetadata {
  pages?: PageRef[];
  /** Editor preview mode: switch to another page instead of following the link. */
  navigate?: (pageId: string) => void;
  /** Published preview: where another page of this design lives (and an item of the collection it shows). */
  pageHref?: (page: PageRef, itemSlug?: string) => string;
  /** The site's collections and menus (content.ts), and which page shows each collection's items. */
  collections?: Collection[];
  menus?: Menus;
  itemPages?: Record<string, string>;
}

/**
 * Props for a link inside a visitor's page. Links to other pages are stored as "page:<id>" and resolve per context:
 * a tab switch in the editor's preview, a real URL on the preview page, nothing at all while editing.
 */
export function linkProps(href: string | undefined, puck: { isEditing?: boolean; metadata?: unknown }) {
  const meta = (puck.metadata ?? {}) as BuilderMetadata;
  const editing = !!puck.isEditing;
  if (href?.startsWith(PAGE_LINK)) {
    // "page:<id>" or, for an item of a collection, "page:<id>/<item slug>".
    const [pageId, itemSlug] = href.slice(PAGE_LINK.length).split("/");
    const page = meta.pages?.find((p) => p.id === pageId);
    if (!page) return { href: "#", tabIndex: editing ? -1 : undefined };
    if (meta.pageHref) return { href: meta.pageHref(page, itemSlug) };
    return {
      href: "#",
      "data-page-link": page.id,
      tabIndex: editing ? -1 : undefined,
      onClick: (e: MouseEvent) => {
        e.preventDefault();
        meta.navigate?.(page.id);
      },
    };
  }
  return { href: safeHref(href), tabIndex: editing ? -1 : undefined };
}

/** The pages of the site being edited, for the link picker in the side panel. */
export const PagesContext = createContext<PageRef[]>([]);

/** Side-panel field: link to one of the site's pages, or type any URL. */
export function LinkField({ value, onChange, readOnly, id }: { value: string | undefined; onChange: (v: string) => void; readOnly?: boolean; id: string }) {
  const pages = useContext(PagesContext);
  const isPage = !!value?.startsWith(PAGE_LINK);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <select
        id={id}
        aria-label="Link to"
        disabled={readOnly}
        value={isPage ? value : "url"}
        onChange={(e) => onChange(e.target.value === "url" ? "" : e.target.value)}
        className="min-h-9 rounded border px-2"
      >
        <option value="url">Web address or #section</option>
        {pages.map((p) => <option key={p.id} value={`${PAGE_LINK}${p.id}`}>Page: {p.title}</option>)}
      </select>
      {isPage ? null : (
        <input
          aria-label="Link address"
          disabled={readOnly}
          value={value ?? ""}
          placeholder="https://… or #contact"
          onChange={(e) => onChange(e.target.value)}
          className="min-h-9 rounded border px-2"
        />
      )}
    </div>
  );
}

/** Puck field definition for any link prop. Custom fields draw their own label. */
export const linkField = (label: string) => ({
  type: "custom" as const,
  label,
  render: ({ value, onChange, readOnly, id }: { value: string; onChange: (v: string) => void; readOnly?: boolean; id: string }) => (
    <FieldLabel label={label} el="div" readOnly={readOnly}>
      <LinkField value={value} onChange={onChange} readOnly={readOnly} id={id} />
    </FieldLabel>
  ),
});
