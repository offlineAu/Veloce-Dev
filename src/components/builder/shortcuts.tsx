"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionBar } from "@puckeditor/core";
import { ClipboardPaste, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { isSlot, withFreshIds, type BlockItem } from "@/lib/builder/blocks";
import type { BuilderData } from "./config";
import { usePuck } from "./editor-hooks";

/*
 * Keyboard shortcuts and a clipboard for the editor, on the page and inside the canvas:
 *   ⌘/Ctrl C, X, V   copy, cut, paste (the clipboard is kept in this browser, so it works across pages)
 *   ⌘/Ctrl D          duplicate
 *   Alt ↑ / ↓         move up / down among its neighbours
 *   Esc               select the block around it (again: select nothing)
 *   ?                 show these shortcuts
 * Undo, redo and Delete are Puck's own. Keys typed into a field are left alone; in text on the canvas, typing,
 * pasting text and copying selected words stay the browser's.
 */

const CLIPBOARD_KEY = "veloce.builder.clipboard.v1";
const ROOT_ZONE = "root:default-zone";

function readClip(): BlockItem | null {
  try {
    const raw = localStorage.getItem(CLIPBOARD_KEY);
    return raw ? (JSON.parse(raw) as BlockItem) : null;
  } catch {
    return null;
  }
}
function writeClip(block: BlockItem) {
  try {
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(block));
    return true;
  } catch {
    return false;
  }
}

/** A form field (side panel, dialogs): every key is the field's. */
const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};
/** Text being edited on the canvas (clicking a heading puts the caret in it). */
const inText = (t: EventTarget | null) => !!(t as HTMLElement | null)?.isContentEditable;

/** The blocks of a zone ("root:default-zone" or "<block id>:<slot>"), read from the page. */
function zoneItems(content: BlockItem[], zone: string): BlockItem[] | undefined {
  if (zone === ROOT_ZONE) return content;
  const at = zone.lastIndexOf(":");
  const [id, slot] = [zone.slice(0, at), zone.slice(at + 1)];
  const find = (items: BlockItem[]): BlockItem[] | undefined => {
    for (const b of items) {
      if (b.props.id === id) return isSlot(b.props[slot]) || Array.isArray(b.props[slot]) ? (b.props[slot] as BlockItem[]) : undefined;
      for (const v of Object.values(b.props)) {
        if (!isSlot(v)) continue;
        const hit = find(v);
        if (hit) return hit;
      }
    }
    return undefined;
  };
  return find(content);
}

/** The page with `block` put into `zone` at `index`. */
function insertInto(content: BlockItem[], zone: string, index: number, block: BlockItem): BlockItem[] {
  if (zone === ROOT_ZONE) return [...content.slice(0, index), block, ...content.slice(index)];
  const at = zone.lastIndexOf(":");
  const [id, slot] = [zone.slice(0, at), zone.slice(at + 1)];
  const visit = (items: BlockItem[]): BlockItem[] =>
    items.map((b) => {
      const props: BlockItem["props"] = {};
      for (const [k, v] of Object.entries(b.props)) props[k] = isSlot(v) ? visit(v) : v;
      if (b.props.id === id) {
        const list = Array.isArray(props[slot]) ? (props[slot] as BlockItem[]) : [];
        props[slot] = [...list.slice(0, index), block, ...list.slice(index)];
      }
      return { ...b, props };
    });
  return visit(content);
}

/** Editor actions shared by the shortcuts and the block toolbar. */
export function useEditorActions() {
  const dispatch = usePuck((s) => s.dispatch);
  const selected = usePuck((s) => s.selectedItem);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const getParentById = usePuck((s) => s.getParentById);
  const content = usePuck((s) => s.appState.data.content) as BlockItem[];

  const selector = selected ? getSelectorForId(String(selected.props.id)) : undefined;

  const copy = useCallback(() => {
    if (!selected) return false;
    if (writeClip(selected as BlockItem)) toast.success("Copied. Paste it with ⌘V / Ctrl+V, on any page.");
    return true;
  }, [selected]);

  const paste = useCallback(() => {
    const clip = readClip();
    if (!clip) {
      toast("Nothing copied yet. Select a block and press ⌘C / Ctrl+C.");
      return;
    }
    const [block] = withFreshIds([clip]);
    // After the selected block, or at the end of the page. A whole section pasted into a design moves beside it
    // (TemplateDropConverter tidies it like a drop).
    const zone = selector?.zone ?? ROOT_ZONE;
    const index = selector ? selector.index + 1 : content.length;
    dispatch({ type: "setData", data: (prev) => ({ ...prev, content: insertInto(prev.content as BlockItem[], zone, index, block!) as BuilderData["content"] }) });
    dispatch({ type: "setUi", ui: { itemSelector: { zone, index } } });
  }, [selector, content.length, dispatch]);

  const cut = useCallback(() => {
    if (!selector || !copy()) return;
    dispatch({ type: "remove", index: selector.index, zone: selector.zone });
  }, [selector, copy, dispatch]);

  const duplicate = useCallback(() => {
    if (selector) dispatch({ type: "duplicate", sourceIndex: selector.index, sourceZone: selector.zone });
  }, [selector, dispatch]);

  const move = useCallback(
    (by: -1 | 1) => {
      if (!selector) return;
      const length = zoneItems(content, selector.zone)?.length ?? 0;
      const to = selector.index + by;
      if (to < 0 || to >= length) return;
      dispatch({ type: "reorder", sourceIndex: selector.index, destinationIndex: to, destinationZone: selector.zone });
      dispatch({ type: "setUi", ui: { itemSelector: { zone: selector.zone, index: to } } });
    },
    [selector, content, dispatch],
  );

  const selectParent = useCallback(() => {
    if (!selected) return;
    const parent = getParentById(String(selected.props.id));
    const up = parent ? getSelectorForId(String(parent.props.id)) : undefined;
    dispatch({ type: "setUi", ui: { itemSelector: up ?? null } });
  }, [selected, getParentById, getSelectorForId, dispatch]);

  return { selected, copy, cut, paste, duplicate, move, selectParent };
}

/** Inside <Puck>: listens on the editor and inside the canvas iframe. */
export function EditorShortcuts() {
  const actions = useEditorActions();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || inField(e.target)) return;
      // In text on the canvas, typing, pasting text and copying selected words stay the browser's.
      const text = inText(e.target);
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const run = (fn: () => unknown) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };
      if (mod && !e.shiftKey && !e.altKey) {
        const wordsSelected = !!(e.target as Node | null)?.ownerDocument?.getSelection()?.toString();
        if (key === "c" && actions.selected && !wordsSelected) return run(actions.copy);
        if (key === "x" && actions.selected && !wordsSelected) return run(actions.cut);
        if (key === "v" && !text) return run(actions.paste);
        if (key === "d" && actions.selected) return run(actions.duplicate);
        return;
      }
      if (e.altKey && !mod && (e.key === "ArrowUp" || e.key === "ArrowDown") && actions.selected) return run(() => actions.move(e.key === "ArrowUp" ? -1 : 1));
      if (e.key === "Escape" && actions.selected) return run(actions.selectParent);
      if (e.key === "?" && !mod && !text) return run(() => setHelp(true));
    };

    // The canvas is an iframe that Puck may replace: keep a listener on whichever one is there.
    let frameDoc: Document | null = null;
    const attach = () => {
      const doc = document.querySelector<HTMLIFrameElement>("iframe")?.contentDocument ?? null;
      if (doc === frameDoc) return;
      frameDoc?.removeEventListener("keydown", onKey, true);
      frameDoc = doc;
      frameDoc?.addEventListener("keydown", onKey, true);
    };
    attach();
    const timer = window.setInterval(attach, 1000);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKey, true);
      frameDoc?.removeEventListener("keydown", onKey, true);
    };
  }, [actions]);

  return (
    <Dialog open={help} onOpenChange={setHelp}>
      <ModalContent title="Keyboard shortcuts" description="They work on the page and in the side panels, except while you're typing.">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
          {[
            ["⌘/Ctrl + C, X, V", "Copy, cut and paste a block (also between pages)"],
            ["⌘/Ctrl + D", "Duplicate"],
            ["Alt + ↑ / ↓", "Move up or down"],
            ["Esc", "Select the block around it"],
            ["Delete", "Delete"],
            ["⌘/Ctrl + Z", "Undo (add Shift to redo)"],
            ["?", "Show these shortcuts"],
          ].map(([k, d]) => (
            <div key={k} className="contents">
              <dt><kbd className="rounded border px-1.5 py-0.5 font-mono text-[13px]">{k}</kbd></dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </ModalContent>
    </Dialog>
  );
}

/** Copy and Paste in the selected block's toolbar. */
export function ClipboardActions() {
  const { selected, copy, paste } = useEditorActions();
  if (!selected) return null;
  return (
    <>
      <ActionBar.Action label="Copy (⌘C)" onClick={copy}>
        <Copy aria-hidden size={16} />
      </ActionBar.Action>
      <ActionBar.Action label="Paste after (⌘V)" onClick={paste}>
        <ClipboardPaste aria-hidden size={16} />
      </ActionBar.Action>
    </>
  );
}
