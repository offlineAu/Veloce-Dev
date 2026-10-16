"use client";

import { useContext, useState, useTransition } from "react";
import { Code2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BlockItem } from "@/lib/builder/blocks";
import { keptBlocks, replaceBlock, restoreKept, serializeElements } from "@/lib/builder/element-html";
import { ELEMENT_TYPES, sectionToElements } from "@/lib/builder/elements";
import { findSection } from "@/lib/builder/template-package";
import { htmlToPiecesAction } from "@/server/actions/builder-html";
import { usePuck } from "./editor-hooks";
import { TemplateContext } from "./template-registry";

/*
 * "Edit HTML" (Advanced): the selected piece, or a whole locked design section, as HTML. Applying sends the HTML
 * to the server, which sanitises it into pieces; they replace the selection as one undoable step. Builder blocks
 * inside (a Heading dropped into a card) are kept as <!--block:…--> markers and put back where the markers are.
 */

const PIECES = new Set<string>(ELEMENT_TYPES.filter((t) => t !== "DRich"));
const MAX = 50_000;

function useSelection(): { id: string; blocks: BlockItem[] } | null {
  const selected = usePuck((s) => s.selectedItem) as BlockItem | null;
  const template = useContext(TemplateContext);
  if (!selected) return null;
  if (PIECES.has(selected.type)) return { id: String(selected.props.id), blocks: [selected] };
  if (selected.type === "DesignSection" && template) {
    const section = findSection(template.pkg, String(selected.props.sectionId));
    if (!section) return null;
    const p = selected.props as { values?: Record<string, string>; items?: Record<string, Record<string, string>[]> };
    return { id: String(selected.props.id), blocks: [sectionToElements(section, p.values, p.items)] };
  }
  return null;
}

export function EditHtmlButton() {
  const selection = useSelection();
  const dispatch = usePuck((s) => s.dispatch);
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!selection) return null;

  const openEditor = () => {
    setHtml(serializeElements(selection.blocks));
    setError(null);
    setOpen(true);
  };

  const apply = () =>
    start(async () => {
      const r = await htmlToPiecesAction(html);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const blocks = restoreKept(r.blocks, keptBlocks(selection.blocks));
      dispatch({
        type: "setData",
        data: (prev) => ({ ...prev, content: replaceBlock(prev.content as BlockItem[], selection.id, blocks) as typeof prev.content }),
        recordHistory: true,
      });
      dispatch({ type: "setUi", ui: { itemSelector: null }, recordHistory: false });
      setOpen(false);
      toast.success(r.removed.length ? `HTML applied. Removed for safety: ${r.removed.join("; ")}` : "HTML applied");
    });

  const lines = html.split("\n").length;
  const tooBig = html.length > MAX;

  return (
    <>
      <button type="button" onClick={openEditor} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold">
        <Code2 aria-hidden size={16} /> Edit HTML
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <ModalContent
          title="Edit HTML"
          description="Change the markup and classes (Tailwind, without the vt: prefix). Scripts, event handlers and unsafe links are removed. <!--block:…--> lines are blocks from the builder; keep them where they should go."
          className="sm:max-w-3xl"
        >
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!tooBig && html.trim()) apply();
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              <span>
                HTML <span className="font-normal opacity-70">({lines} lines)</span>
              </span>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  } else if (e.key === "Tab" && !e.shiftKey) {
                    // Indent instead of leaving the editor (Shift+Tab or Esc still leave it).
                    e.preventDefault();
                    const t = e.currentTarget;
                    const { selectionStart: a, selectionEnd: b } = t;
                    setHtml(`${html.slice(0, a)}  ${html.slice(b)}`);
                    requestAnimationFrame(() => t.setSelectionRange(a + 2, a + 2));
                  }
                }}
                rows={20}
                spellCheck={false}
                wrap="off"
                aria-invalid={tooBig || !!error}
                aria-describedby="edit-html-help"
                className="max-h-[60vh] rounded-md border border-line p-3 font-mono text-[13px] font-normal leading-5"
              />
            </label>
            <p id="edit-html-help" className="text-xs text-muted">Tab indents. Press ⌘/Ctrl + Enter to apply. Undo puts the previous version back.</p>
            {tooBig ? <p role="alert" className="text-sm text-danger">That&apos;s more than {MAX / 1000} KB. Edit a smaller part.</p> : null}
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || tooBig || !html.trim()}>{pending ? "Applying…" : "Apply"}</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </ModalContent>
      </Dialog>
    </>
  );
}
