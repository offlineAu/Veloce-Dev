"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SiteDoc } from "@/lib/builder/site-doc";
import { docFromTemplate } from "@/lib/builder/template-doc";
import type { TemplateListing } from "@/lib/builder/template-package";
import { STARTER_TEMPLATES } from "./templates";
import { loadTemplates, saveTemplates, type SavedTemplate } from "./storage";
import { loadTemplate } from "./template-registry";

const STRIPE: Record<string, string> = {
  Hero: "h-10 bg-(--thumb-accent)/35",
  Features: "h-6 bg-neutral-200",
  Pricing: "h-7 bg-(--thumb-accent)/20",
  Testimonials: "h-5 bg-neutral-100",
  Faq: "h-4 bg-neutral-100",
  CtaBand: "h-5 bg-(--thumb-accent)/60",
  Contact: "h-6 bg-(--thumb-accent)/15",
  Section: "h-8 bg-neutral-100",
};

/** A sketch of the home page: one stripe per top-level block, in the site's colours. */
function Thumb({ doc }: { doc: SiteDoc }) {
  const data = doc.pages[0]!.data;
  return (
    <div
      aria-hidden
      className="flex aspect-[4/3] flex-col gap-1 overflow-hidden rounded-lg border border-line p-2"
      style={{ ["--thumb-accent" as string]: doc.theme.accent, background: doc.theme.bg }}
    >
      {data.content.length === 0 ? <div className="grid flex-1 place-items-center rounded border-2 border-dashed border-neutral-300 text-xs text-muted">Empty</div> : null}
      {data.content.slice(0, 7).map((b, i) => <div key={i} className={cn("shrink-0 rounded", STRIPE[b.type] ?? "h-4 bg-neutral-100")} />)}
    </div>
  );
}

type PickerProps = {
  templates: TemplateListing[];
  highlight?: string;
  hasContent: () => boolean;
  onChoose: (doc: SiteDoc, templateId?: string) => void;
};

export function TemplatePicker({ open, onOpenChange, ...props }: PickerProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Choose a starting point" description="Pick a template, then make it yours. You can switch later, and your own templates are saved in this browser." className="max-w-[960px]">
        {/* Mounted only while open, so saved templates are read fresh each time. */}
        <PickerBody {...props} />
      </ModalContent>
    </Dialog>
  );
}

function PickerBody({ templates, highlight, hasContent, onChoose }: PickerProps) {
  const [mine, setMine] = useState<SavedTemplate[]>(loadTemplates);
  const [confirm, setConfirm] = useState<{ name: string; doc: SiteDoc; templateId?: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const updateMine = (next: SavedTemplate[]) => {
    setMine(next);
    saveTemplates(next);
  };

  const choose = (name: string, doc: SiteDoc, templateId?: string) => {
    if (hasContent()) setConfirm({ name, doc, templateId });
    else onChoose(doc, templateId);
  };

  const chooseImported = async (t: TemplateListing) => {
    const version = t.version;
    if (loading) return;
    setLoading(t.slug);
    try {
      const { pkg } = await loadTemplate({ slug: t.slug, version });
      choose(t.name, docFromTemplate(pkg), t.slug);
    } catch {
      toast.error("That template couldn't be loaded. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const imported = templates;

  return (
    <>
      {confirm ? (
        <div role="alertdialog" aria-labelledby="tp-confirm" className="flex flex-col gap-4 rounded-xl bg-accent-100 p-5">
          <p id="tp-confirm" className="font-semibold">Replace your current site with “{confirm.name}”?</p>
          <p className="text-sm text-muted">All your pages will be replaced. Save your design as a template first if you want to keep it.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onChoose(confirm.doc, confirm.templateId)}>Replace site</Button>
            <Button variant="outline" onClick={() => setConfirm(null)}>Keep my page</Button>
          </div>
        </div>
      ) : null}

      {imported.length ? (
        <>
          <h3 className="mt-2 text-sm font-bold uppercase tracking-[0.08em] text-muted">Designer templates</h3>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2">
            {imported.map((t) => {
              const draft = t.draft;
              return (
                <li key={t.slug}>
                  <button
                    type="button"
                    data-template={t.slug}
                    aria-busy={loading === t.slug}
                    onClick={() => void chooseImported(t)}
                    className={cn(
                      "flex w-full flex-col gap-2 rounded-xl border-2 border-line p-3 text-left transition-colors hover:border-accent-600 focus-visible:outline-2 focus-visible:outline-accent-700",
                      highlight === t.slug && "border-accent-600 bg-accent-100",
                    )}
                  >
                    {t.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- static package asset
                      <img src={t.thumbnail} alt="" className="aspect-[4/3] w-full rounded-lg border border-line object-cover object-top" />
                    ) : null}
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {t.name}
                      <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-bg">{t.pages.length} {t.pages.length === 1 ? "page" : "pages"}</span>
                      {t.scheme === "dark" ? <span className="rounded-full border border-line px-2 py-0.5 text-xs">Dark</span> : null}
                      {draft ? <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs text-ink">Draft · review</span> : null}
                    </span>
                    <span className="text-sm leading-snug text-muted">{loading === t.slug ? "Loading…" : t.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <h3 className={cn("text-sm font-bold uppercase tracking-[0.08em] text-muted", imported.length ? "mt-8" : "mt-2")}>Starter templates</h3>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STARTER_TEMPLATES.map((t) => {
          const doc = t.build();
          return (
            <li key={t.id}>
              <button
                type="button"
                data-template={t.id}
                onClick={() => choose(t.name, t.build(), t.id)}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-xl border-2 border-line p-3 text-left transition-colors hover:border-accent-600 focus-visible:outline-2 focus-visible:outline-accent-700",
                  highlight === t.id && "border-accent-600 bg-accent-100",
                )}
              >
                <Thumb doc={doc} />
                <span className="font-semibold">{t.name}</span>
                <span className="text-sm leading-snug text-muted">{t.description}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-8 text-sm font-bold uppercase tracking-[0.08em] text-muted">My templates</h3>
      {mine.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing saved yet. Use “Save as template” in the toolbar to reuse a design you like.</p>
      ) : (
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 rounded-xl border-2 border-line p-3">
              <button type="button" onClick={() => choose(t.name, t.doc)} className="flex flex-col gap-2 text-left">
                <Thumb doc={t.doc} />
              </button>
              {renaming === t.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
                    if (name) updateMine(mine.map((m) => (m.id === t.id ? { ...m, name } : m)));
                    setRenaming(null);
                  }}
                  className="flex gap-2"
                >
                  <input name="name" defaultValue={t.name} autoFocus aria-label="Template name" maxLength={60} className="min-h-9 flex-1 rounded-md border border-line px-2" />
                  <Button size="sm" type="submit">Save</Button>
                </form>
              ) : (
                <span className="font-semibold">{t.name}</span>
              )}
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setRenaming(t.id)} aria-label={`Rename ${t.name}`}><Pencil aria-hidden /></Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Duplicate ${t.name}`}
                  onClick={() => updateMine([...mine, { ...t, id: crypto.randomUUID(), name: `${t.name} (copy)`, createdAt: Date.now() }])}
                >
                  <Copy aria-hidden />
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Delete ${t.name}`} onClick={() => updateMine(mine.filter((m) => m.id !== t.id))}><Trash2 aria-hidden /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
