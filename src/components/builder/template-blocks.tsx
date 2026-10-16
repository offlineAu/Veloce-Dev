"use client";

import { useContext, useEffect, useMemo } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { isSlot, mapBlocks, PAGE_SECTION_TYPES, type BlockItem } from "@/lib/builder/blocks";
import { ELEMENT_TYPES } from "@/lib/builder/elements";
import { deviceValues } from "@/lib/builder/class-groups";
import { placeItem } from "@/lib/builder/free-layout";
import { sectionPieces, templatePageIds } from "@/lib/builder/template-doc";
import { sectionDefaults, type TemplatePackage, type TemplateSection } from "@/lib/builder/template-package";
import type { BuilderData, builderConfig } from "./config";
import { usePuck } from "./editor-hooks";
import { PagesContext } from "./links";
import { renderNode } from "./node-tree";

/*
 * The site's designer template, offered in the Blocks panel: one block per section of the template ("Header",
 * "Immersive Editorial Hero", "Footer"…), dragged in anywhere between the page's sections like the ready-made ones.
 * While dragging it shows the section as designed; once dropped, TemplateDropConverter swaps it for the section's
 * design pieces (everything editable and draggable, like the rest of a template site), with links to the template's
 * pages pointing at the site's own pages. These block types exist only in the editor: they never reach a saved site.
 */
export const TEMPLATE_SECTION_PREFIX = "TemplateSection:";
const PREFIX = TEMPLATE_SECTION_PREFIX;

type BaseConfig = typeof builderConfig;

/** The template's sections, one per name (headers and footers repeat on every page). */
export function uniqueSections(pkg: TemplatePackage): TemplateSection[] {
  const seen = new Set<string>();
  return pkg.pages.flatMap((p) => p.sections).filter((s) => {
    const key = s.label.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The editor's block list with the template's sections added as their own group, first in the panel. */
export function useTemplateConfig(base: BaseConfig, pkg: TemplatePackage | undefined): BaseConfig {
  return useMemo(() => {
    if (!pkg) return base;
    const sections = uniqueSections(pkg);
    const components: Record<string, ComponentConfig> = {};
    for (const section of sections) {
      const { values, items } = sectionDefaults(section);
      components[`${PREFIX}${section.id}`] = {
        label: section.label,
        fields: {},
        render: ({ puck }) => <>{renderNode(section.tree, { values, items, puck })}</>,
      };
    }
    return {
      ...base,
      categories: {
        // Offered as pictures above the list (section-gallery.tsx), not as a list of names.
        templateSections: { title: `${pkg.name} sections`, components: Object.keys(components), visible: false },
        ...base.categories,
      },
      components: { ...base.components, ...components },
    } as unknown as BaseConfig;
  }, [base, pkg]);
}

const isPlaceholder = (b: BlockItem) => b.type.startsWith(PREFIX);
const PIECES = new Set<string>(ELEMENT_TYPES);
const PAGE_LEVEL = new Set<string>(PAGE_SECTION_TYPES);
const isPageLevel = (b: BlockItem) => PAGE_LEVEL.has(b.type) || isPlaceholder(b);
/** An item of a free layout without a free place (just dropped in, or pasted). */
const unplaced = (b: BlockItem) => deviceValues(String(b.props.className ?? ""), /^(static|relative|absolute|fixed|sticky)$/).tablet !== "absolute";
const isDecorLayer = (b: BlockItem) =>
  !(Array.isArray(b.props.items) && b.props.items.length) && /(^|\s)vt:(absolute|fixed)(\s|$)/.test(String(b.props.className ?? ""));

/**
 * A block's slots with every whole page section dropped inside a design piece taken out (`pulled`, in page order).
 * Puck only drops into the innermost zone under the pointer, and on a template site the pieces fill each section, so
 * a Hero or a template section dropped "on" a section lands inside it; it belongs beside it.
 */
function pullOut(block: BlockItem, pulled: BlockItem[]): BlockItem {
  const inPiece = PIECES.has(block.type);
  let changed = false;
  const props: BlockItem["props"] = {};
  for (const [k, v] of Object.entries(block.props)) {
    if (!isSlot(v)) {
      props[k] = v;
      continue;
    }
    const kept: BlockItem[] = [];
    for (const child of v) {
      if (inPiece && isPageLevel(child)) {
        pulled.push(child);
        changed = true;
      } else {
        const next = pullOut(child, pulled);
        if (next !== child) changed = true;
        kept.push(next);
      }
    }
    props[k] = kept;
  }
  return changed ? { ...block, props } : block;
}

/**
 * The page with dropped page sections moved beside the section they were dropped on, template sections as pieces, and
 * decorative layers marked; null when nothing needed changing.
 */
export function tidyDrops(content: BlockItem[], toPieces: (b: BlockItem) => BlockItem): BlockItem[] | null {
  let changed = false;
  const out = content.flatMap((top) => {
    const pulled: BlockItem[] = [];
    const next = pullOut(top, pulled);
    if (next !== top || pulled.length) changed = true;
    return [next, ...pulled];
  });
  const converted = mapBlocks(out, (b) => {
    if (isPlaceholder(b)) {
      changed = true;
      return toPieces(b);
    }
    // Sites made before decorative layers were marked: an empty positioned group is one (see sectionToElements).
    if (b.type === "Box" && !b.props.decor && isDecorLayer(b)) {
      changed = true;
      return { ...b, props: { ...b.props, decor: true } };
    }
    // Something dropped into a free layout gets a place in it (near the top left), from tablets up.
    if (b.type === "Box" && b.props.free && isSlot(b.props.items) && b.props.items.some(unplaced)) {
      changed = true;
      const place = (c: BlockItem, i: number): BlockItem => {
        const at = { x: 24 + 16 * (i % 4), y: 24 + 16 * (i % 4) };
        if (PIECES.has(c.type)) return { ...c, props: { ...c.props, className: placeItem(String(c.props.className ?? ""), at, "desktop") } };
        // Builder blocks (Heading, Button…) have no class list: they're placed inside a group of their own.
        return { type: "Box", props: { id: `Box-${crypto.randomUUID()}`, tag: "div", className: placeItem("", { ...at, w: 480 }, "desktop"), items: [c] } };
      };
      const items = b.props.items.map((c, i) => (unplaced(c) ? place(c, i) : c));
      return { ...b, props: { ...b.props, items } };
    }
    return b;
  });
  return changed ? converted : null;
}

/** Inside <Puck>: tidies every drop (see tidyDrops), in the same undo step as the drop itself. */
export function TemplateDropConverter({ pkg }: { pkg: TemplatePackage | undefined }) {
  const content = usePuck((s) => s.appState.data.content);
  const dispatch = usePuck((s) => s.dispatch);
  const pages = useContext(PagesContext);

  useEffect(() => {
    const ids = pkg ? templatePageIds(pkg, pages) : new Map<string, string>();
    const toPieces = (b: BlockItem): BlockItem => {
      const section = pkg?.pages.flatMap((p) => p.sections).find((s) => s.id === b.type.slice(PREFIX.length));
      return section ? sectionPieces(section, ids) : b;
    };
    const next = tidyDrops(content as BlockItem[], toPieces);
    if (!next) return;
    dispatch({
      type: "setData",
      data: (prev) => ({ ...prev, content: (tidyDrops(prev.content as BlockItem[], toPieces) ?? prev.content) as BuilderData["content"] }),
      // Part of the drop: undo takes it away again.
      recordHistory: false,
    });
  }, [content, pkg, pages, dispatch]);

  return null;
}
