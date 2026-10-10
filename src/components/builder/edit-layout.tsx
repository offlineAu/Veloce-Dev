"use client";

import { useCallback, useContext } from "react";
import { ActionBar } from "@puckeditor/core";
import { LayoutGrid } from "lucide-react";
import { mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import { sectionToElements } from "@/lib/builder/elements";
import { findSection } from "@/lib/builder/template-package";
import { usePuck } from "./editor-hooks";
import { TemplateContext } from "./template-registry";

/**
 * Takes the selected locked design section apart into design pieces, in place, as one undoable step. Everything the
 * visitor already changed (texts, links, images, list items) is kept.
 */
export function useEditLayout() {
  const selected = usePuck((s) => s.selectedItem);
  const dispatch = usePuck((s) => s.dispatch);
  const template = useContext(TemplateContext);
  const section = selected?.type === "DesignSection" && template ? findSection(template.pkg, String(selected.props.sectionId)) : undefined;

  const run = useCallback(() => {
    if (!selected || !section) return;
    const id = String(selected.props.id);
    const props = selected.props as { values?: Record<string, string>; items?: Record<string, Record<string, string>[]> };
    const block = sectionToElements(section, props.values, props.items);
    // Puck's "replace" keeps a block's id, but this is a different block: swap it in the page tree in one step.
    const swap = (items: BlockItem[]) => mapBlocks(items, (b) => (b.props.id === id ? block : b));
    dispatch({
      type: "setData",
      data: (prev) => ({ ...prev, content: swap(prev.content as BlockItem[]) as typeof prev.content }),
    });
    dispatch({ type: "setUi", ui: { itemSelector: null }, recordHistory: false });
  }, [selected, section, dispatch]);

  return section ? run : null;
}

/** Toolbar button on a selected design section. */
export function EditLayoutAction() {
  const run = useEditLayout();
  if (!run) return null;
  return (
    <ActionBar.Action label="Edit layout: move and change what's inside this section" onClick={run}>
      <LayoutGrid aria-hidden size={16} />
    </ActionBar.Action>
  );
}

/** The same, as a button at the top of the section's side panel. */
export function EditLayoutButton() {
  const run = useEditLayout();
  if (!run) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3 text-sm">
      <p>Want to move, remove or add things inside this section?</p>
      <button type="button" onClick={run} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-black px-3 font-semibold text-white">
        <LayoutGrid aria-hidden size={16} /> Edit layout
      </button>
      <p className="text-xs opacity-70">Its parts become blocks you can drag, duplicate, delete and style. Undo brings the section back.</p>
    </div>
  );
}
