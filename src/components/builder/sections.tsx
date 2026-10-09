"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BlockItem } from "@/lib/builder/blocks";
import { sectionBlock } from "@/lib/builder/template-doc";
import type { TemplatePackage } from "@/lib/builder/template-package";
import { builderConfig } from "./config";
import { SAVE_SECTION_EVENT, useAppendBlocks } from "./editor-hooks";
import { loadSections, saveSections, type SavedSection } from "./storage";

const blockLabel = (type: string) => (builderConfig.components as Record<string, { label?: string }>)[type]?.label ?? type;

/**
 * Ready-made sections to add to the page: every section of the site's designer template, and "My sections" (blocks
 * the visitor saved from the block toolbar). Adding one puts a copy at the bottom of the page.
 */
export function SectionsDialog({ open, onOpenChange, template }: { open: boolean; onOpenChange: (open: boolean) => void; template?: TemplatePackage }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Add a section" description="Adding a section puts a copy at the bottom of this page. Drag it into place afterwards.">
        {template ? <TemplateSections pkg={template} onDone={() => onOpenChange(false)} /> : null}
        <h3 className="mb-2 mt-6 text-sm font-bold uppercase tracking-[0.08em] text-muted first:mt-0">My sections</h3>
        <SectionsList onDone={() => onOpenChange(false)} />
      </ModalContent>
    </Dialog>
  );
}

function TemplateSections({ pkg, onDone }: { pkg: TemplatePackage; onDone: () => void }) {
  const append = useAppendBlocks();
  return (
    <>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-muted">{pkg.name} sections</h3>
      {pkg.pages.map((page) => (
        <section key={page.key} aria-label={page.title} className="mb-3">
          <p className="text-sm font-semibold">{page.title}</p>
          <ul className="flex flex-col divide-y divide-line">
            {page.sections.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-2">
                <span className="text-[15px]">{s.label}</span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Add ${s.label}`}
                  onClick={() => {
                    append([sectionBlock(s)]);
                    onDone();
                    toast.success(`Added “${s.label}” to the bottom of the page`);
                  }}
                >
                  <Plus aria-hidden /> Add
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Mounted only while the dialog is open, so saved sections are read fresh each time. */
function SectionsList({ onDone }: { onDone: () => void }) {
  const [sections, setSections] = useState<SavedSection[]>(loadSections);
  const append = useAppendBlocks();
  return (
    <>
      {sections.length === 0 ? (
        <p className="text-muted">
          Nothing saved yet. Select a block on the page and click the bookmark icon in its toolbar to save it here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {sections.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="block font-semibold">{s.name}</span>
                <span className="text-sm text-muted">{blockLabel(s.block.type)}</span>
              </span>
              <span className="flex gap-1">
                <Button
                  size="sm"
                  onClick={() => {
                    append([s.block]);
                    onDone();
                    toast.success(`Added “${s.name}” to the bottom of the page`);
                  }}
                >
                  <Plus aria-hidden /> Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => {
                    const next = sections.filter((x) => x.id !== s.id);
                    setSections(next);
                    saveSections(next);
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Asks for a name when a block is saved from its toolbar. */
export function SaveSectionDialog() {
  const [block, setBlock] = useState<BlockItem | null>(null);

  useEffect(() => {
    const onSave = (e: Event) => setBlock((e as CustomEvent<BlockItem>).detail);
    window.addEventListener(SAVE_SECTION_EVENT, onSave);
    return () => window.removeEventListener(SAVE_SECTION_EVENT, onSave);
  }, []);

  return (
    <Dialog open={!!block} onOpenChange={(o) => !o && setBlock(null)}>
      <ModalContent title="Save as a reusable section" description="Give it a name so you can find it in “My sections”.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!block) return;
            const name = String(new FormData(e.currentTarget).get("name") ?? "").trim() || blockLabel(block.type);
            const saved = saveSections([...loadSections(), { id: crypto.randomUUID(), name, block: structuredClone(block), createdAt: Date.now() }]);
            if (saved) toast.success(`Saved “${name}”`);
            else toast.error("Your browser didn't let us save that section.");
            setBlock(null);
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Section name
            <input name="name" autoFocus maxLength={60} defaultValue={block ? blockLabel(block.type) : ""} className="min-h-11 rounded-md border border-line px-3 font-normal" />
          </label>
          <Button type="submit" className="self-start">Save section</Button>
        </form>
      </ModalContent>
    </Dialog>
  );
}
