"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MAX_HTML_BYTES } from "@/lib/builder/sanitize-limits";
import type { SiteDoc } from "@/lib/builder/site-doc";
import { htmlBlock, useAppendBlocks } from "./editor-hooks";
import { loadTemplates, saveTemplates } from "./storage";

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** Pastes HTML (a snippet, an embed or a whole page) as one Custom HTML block at the bottom of the page. */
export function ImportHtmlDialog({ open, onOpenChange }: DialogProps) {
  const append = useAppendBlocks();
  const [html, setHtml] = useState("");
  const tooBig = html.length > MAX_HTML_BYTES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="Import HTML"
        description="Paste HTML and CSS from anywhere. It becomes a Custom HTML block you can move around like any other. Scripts are removed for safety."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!html.trim() || tooBig) return;
            append([htmlBlock(html)]);
            setHtml("");
            onOpenChange(false);
            toast.success("HTML added to the bottom of the page");
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            HTML
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={12}
              spellCheck={false}
              placeholder={'<section class="promo">\n  <h2>Summer sale</h2>\n</section>'}
              aria-invalid={tooBig}
              className="rounded-md border border-line p-3 font-mono text-[13px] font-normal"
            />
          </label>
          {tooBig ? <p role="alert" className="text-sm text-danger">That&apos;s more than {MAX_HTML_BYTES / 1000} KB. Split it into smaller blocks.</p> : null}
          <Button type="submit" className="self-start" disabled={!html.trim() || tooBig}>Add to page</Button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

/** Saves the whole site, every page, to "My templates" in this browser. */
export function SaveTemplateDialog({ open, onOpenChange, getDoc }: DialogProps & { getDoc: () => SiteDoc }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Save as template" description="Keep this site, with all its pages, as a starting point for later. Templates are saved in this browser.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const doc = structuredClone(getDoc());
            const name = String(new FormData(e.currentTarget).get("name") ?? "").trim() || doc.pages[0]!.title || "My template";
            const ok = saveTemplates([...loadTemplates(), { id: crypto.randomUUID(), name, doc, createdAt: Date.now() }]);
            if (ok) toast.success(`Saved “${name}” to My templates`);
            else toast.error("Your browser didn't let us save that template.");
            onOpenChange(false);
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Template name
            <input name="name" autoFocus maxLength={60} className="min-h-11 rounded-md border border-line px-3 font-normal" />
          </label>
          <Button type="submit" className="self-start">Save template</Button>
        </form>
      </ModalContent>
    </Dialog>
  );
}
