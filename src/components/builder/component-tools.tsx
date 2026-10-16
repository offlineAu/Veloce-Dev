"use client";

import { useContext, useEffect, useState } from "react";
import { ActionBar } from "@puckeditor/core";
import { Component, Crosshair, Image as ImageIcon, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { isSlot, mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import { componentOf, detach, ensureKeys, findMain, instanceOf, makeComponent, newComponentId, sameDesign, syncContent, syncDoc } from "@/lib/builder/components";
import type { BuilderData } from "./config";
import { ExtrasContext } from "./editor-context";
import { usePuck } from "./editor-hooks";
import { blockName } from "./layers";
import { UploadButton, uploadedImages } from "./media-tools";

/*
 * Components in the editor (lib/builder/components.ts has the rules):
 *   ComponentActions  the block toolbar: make a component, detach a copy, go to the main one
 *   ComponentSync     keeps copies in step with their main component as it's edited (this page now, other pages in
 *                     the stored site), and turns a duplicated main component into a copy
 *   AssetsPanel       the Assets tab: components to insert, and every image used on the site
 */

const ROOT_ZONE = "root:default-zone";

/** Puts `block` after the selected block (or at the end of the page). */
function useInsert() {
  const dispatch = usePuck((s) => s.dispatch);
  const selected = usePuck((s) => s.selectedItem);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const content = usePuck((s) => s.appState.data.content);
  return (block: BlockItem) => {
    const where = selected ? getSelectorForId(String(selected.props.id)) : undefined;
    const zone = where?.zone ?? ROOT_ZONE;
    const index = where ? where.index + 1 : content.length;
    const into = (items: BlockItem[]): BlockItem[] => {
      if (zone === ROOT_ZONE) return [...items.slice(0, index), block, ...items.slice(index)];
      const at = zone.lastIndexOf(":");
      const [id, slot] = [zone.slice(0, at), zone.slice(at + 1)];
      return mapBlocks(items, (b) => {
        if (b.props.id !== id) return b;
        const list = isSlot(b.props[slot]) ? (b.props[slot] as BlockItem[]) : [];
        return { ...b, props: { ...b.props, [slot]: [...list.slice(0, index), block, ...list.slice(index)] } };
      });
    };
    dispatch({ type: "setData", data: (prev) => ({ ...prev, content: into(prev.content as BlockItem[]) as BuilderData["content"] }), recordHistory: true });
    dispatch({ type: "setUi", ui: { itemSelector: { zone, index } } });
  };
}

export function ComponentActions() {
  const selected = usePuck((s) => s.selectedItem) as BlockItem | null;
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const dispatch = usePuck((s) => s.dispatch);
  const extras = useContext(ExtrasContext);
  if (!selected || !extras) return null;
  const ref = componentOf(selected);
  const replace = (block: BlockItem) => {
    const where = getSelectorForId(String(selected.props.id));
    if (where) dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone, data: block as never });
  };

  if (!ref)
    return (
      <ActionBar.Action
        label="Make a component (reuse it anywhere; copies follow it)"
        onClick={() => {
          const id = newComponentId();
          const { main, def } = makeComponent(selected, id, blockName(selected, selected.type));
          replace(main);
          extras.updateDoc((doc) => ({ ...doc, components: { ...doc.components, [id]: def } }));
          toast.success(`“${def.name}” is now a component. Insert copies from the Assets tab.`);
        }}
      >
        <Component aria-hidden size={16} />
      </ActionBar.Action>
    );
  if (ref.main) return null;
  return (
    <>
      <ActionBar.Action label="Go to the main component" onClick={() => {
        const where = findMain(extras.getDoc(), ref.id);
        if (!where) {
          replace({ ...selected, props: { ...selected.props, component: { id: ref.id, main: true } } });
          toast("The main component was deleted: this copy is the main one now.");
        } else if (where.pageId === extras.activePageId) {
          const sel = getSelectorForId(String(where.block.props.id));
          if (sel) dispatch({ type: "setUi", ui: { itemSelector: sel } });
        } else {
          extras.navigate(where.pageId);
          toast("The main component is on this page (outlined in violet).");
        }
      }}>
        <Crosshair aria-hidden size={16} />
      </ActionBar.Action>
      <ActionBar.Action label="Detach (stop following the component)" onClick={() => replace(detach(selected))}>
        <Unlink aria-hidden size={16} />
      </ActionBar.Action>
    </>
  );
}

/** Inside <Puck>: syncs copies with their main component as it changes. */
export function ComponentSync() {
  const content = usePuck((s) => s.appState.data.content) as BlockItem[];
  const dispatch = usePuck((s) => s.dispatch);
  const extras = useContext(ExtrasContext);

  useEffect(() => {
    if (!extras) return;
    const doc = extras.getDoc();
    const defs = doc.components ?? {};
    const seen = new Set<string>();
    let next = content;
    let changed = false;
    const changedMains: BlockItem[] = [];
    // Elsewhere on the site, a main component with the same id may already exist (on another page).
    const mainElsewhere = (id: string) => {
      const m = findMain(doc, id);
      return !!m && m.pageId !== extras.activePageId;
    };
    // (mapBlocks always builds a new tree: `changed` says whether anything in it actually changed.)
    next = mapBlocks(next, (b) => {
      const ref = componentOf(b);
      if (!ref?.main) return b;
      // Duplicated or pasted: only one main component per id; the others become copies.
      if (seen.has(ref.id) || mainElsewhere(ref.id)) {
        changed = true;
        return { ...b, props: { ...b.props, component: { id: ref.id } } };
      }
      seen.add(ref.id);
      const def = defs[ref.id];
      if (!def || sameDesign(b, def.block)) return b;
      const keyed = ensureKeys(b);
      changed = true;
      changedMains.push(keyed);
      return keyed;
    });
    for (const main of changedMains) {
      const id = componentOf(main)!.id;
      next = syncContent(next, id, main, defs[id]!.block) ?? next;
    }
    if (changed) dispatch({ type: "setData", data: (prev) => ({ ...prev, content: next as BuilderData["content"] }), recordHistory: false });
    if (changedMains.length)
      extras.updateDoc((d) => changedMains.reduce((acc, main) => syncDoc(acc, componentOf(main)!.id, main, extras.activePageId), d));
  }, [content, dispatch, extras]);

  return null;
}

/** The Assets tab: the site's components (insert a copy) and images (use one on the selected image). */
export function AssetsPanel() {
  const extras = useContext(ExtrasContext);
  const insert = useInsert();
  const selected = usePuck((s) => s.selectedItem) as BlockItem | null;
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const dispatch = usePuck((s) => s.dispatch);
  // This browser's uploads come first (newest first), then every other picture on the site.
  const [uploads, setUploads] = useState(uploadedImages);
  if (!extras) return null;
  const doc = extras.getDoc();
  const components = Object.entries(doc.components ?? {});

  // Every picture on the site: images, and groups with a background photo.
  const images = new Set<string>(uploads);
  for (const p of doc.pages)
    mapBlocks(p.data.content, (b) => {
      for (const k of ["src", "bg", "image"]) {
        const v = b.props[k];
        if (typeof v === "string" && /^(https:\/\/|\/)/.test(v) && !v.startsWith("//")) images.add(v);
      }
      return b;
    });
  const imageField = selected && ["DImage", "Image"].includes(selected.type) ? "src" : selected?.type === "Hero" ? "image" : selected?.type === "Box" ? "bg" : undefined;
  const applyImage = (src: string) => {
    if (!selected || !imageField) return;
    const where = getSelectorForId(String(selected.props.id));
    if (where) dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone, data: { ...selected, props: { ...selected.props, [imageField]: src } } as never });
  };

  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] opacity-70">
          <Component size={16} aria-hidden /> Components
        </h3>
        {components.length ? null : <p className="text-xs opacity-70">Select a block and press the component button in its toolbar to reuse it anywhere. Copies follow every change to the main one, and keep their own texts and pictures.</p>}
        {components.map(([id, def]) => {
          const main = findMain(doc, id)?.block ?? def.block;
          return (
            <div key={id} className="flex items-center gap-2 rounded border px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate">{def.name}</span>
              <button type="button" aria-label={`Insert ${def.name}`} onClick={() => insert(instanceOf(main, id))} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
                <Plus size={14} aria-hidden /> Insert
              </button>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] opacity-70">
          <ImageIcon size={16} aria-hidden /> Images
        </h3>
        <p className="text-xs opacity-70">{imageField ? "Click a picture to use it on the selected block, or upload one." : "Select an image (or a group) to swap its picture for one of these."}</p>
        <UploadButton
          onUploaded={(src) => {
            setUploads(uploadedImages());
            if (imageField) applyImage(src);
          }}
        >
          {imageField ? "Upload and use" : "Upload an image"}
        </UploadButton>
        <div className="grid grid-cols-3 gap-2">
          {[...images].slice(0, 90).map((src) => (
            <button
              key={src}
              type="button"
              disabled={!imageField}
              title={src}
              onClick={() => applyImage(src)}
              className="aspect-square overflow-hidden rounded border enabled:hover:ring-2 enabled:hover:ring-blue-600 disabled:opacity-70"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
