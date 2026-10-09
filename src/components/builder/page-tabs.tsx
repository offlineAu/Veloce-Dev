"use client";

import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, Plus } from "lucide-react";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_PAGES, type PageRef } from "@/lib/builder/site-doc";

export type PageAction =
  | { type: "select"; id: string }
  | { type: "add"; title: string; from: string }
  | { type: "rename"; id: string; title: string }
  | { type: "duplicate"; id: string }
  | { type: "move"; id: string; delta: -1 | 1 }
  | { type: "delete"; id: string };

/** Pages a new page can start from: blank, or one of the template's own pages. */
export interface PageSource {
  value: string;
  label: string;
}

const menuItem = "flex min-h-9 cursor-pointer items-center rounded px-3 text-sm outline-none data-[disabled]:cursor-default data-[disabled]:opacity-40 data-[highlighted]:bg-ink/5";

/** The site's pages above the canvas. The page's own menu holds the rarer actions. */
export function PageTabs({ pages, activeId, sources, onAction }: { pages: PageRef[]; activeId: string; sources: PageSource[]; onAction: (a: PageAction) => void }) {
  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "rename" | "delete"; page: PageRef } | null>(null);
  const full = pages.length >= MAX_PAGES;

  return (
    <nav aria-label="Pages" className="flex items-center gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-1.5">
      <ul className="flex items-center gap-1">
        {pages.map((p, i) => {
          const active = p.id === activeId;
          return (
            <li key={p.id} className="flex items-center">
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onAction({ type: "select", id: p.id })}
                className={cn("min-h-9 whitespace-nowrap rounded-l-md px-3 text-sm", active ? "bg-ink font-semibold text-bg" : "rounded-r-md hover:bg-ink/5")}
              >
                {p.title}
                <span className={cn("ml-1.5 text-xs", active ? "text-bg/70" : "text-muted")}>{p.path}</span>
              </button>
              {active ? (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button type="button" aria-label={`${p.title} page options`} className="grid min-h-9 place-items-center rounded-r-md border-l border-bg/20 bg-ink px-1.5 text-bg">
                      <ChevronDown aria-hidden className="size-4" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="start" sideOffset={4} className="z-50 min-w-44 rounded-md border border-line bg-bg p-1 shadow-md">
                      <DropdownMenu.Item className={menuItem} onSelect={() => setDialog({ kind: "rename", page: p })}>Rename…</DropdownMenu.Item>
                      <DropdownMenu.Item className={menuItem} disabled={full} onSelect={() => onAction({ type: "duplicate", id: p.id })}>Duplicate</DropdownMenu.Item>
                      <DropdownMenu.Item className={menuItem} disabled={i === 0} onSelect={() => onAction({ type: "move", id: p.id, delta: -1 })}>Move left</DropdownMenu.Item>
                      <DropdownMenu.Item className={menuItem} disabled={i === pages.length - 1} onSelect={() => onAction({ type: "move", id: p.id, delta: 1 })}>Move right</DropdownMenu.Item>
                      <DropdownMenu.Separator className="my-1 h-px bg-line" />
                      <DropdownMenu.Item className={menuItem} disabled={p.path === "/"} onSelect={() => setDialog({ kind: "delete", page: p })}>
                        {p.path === "/" ? "Home page can't be deleted" : "Delete…"}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button variant="ghost" size="sm" disabled={full} title={full ? `Up to ${MAX_PAGES} pages` : undefined} onClick={() => setDialog({ kind: "add" })} className="min-h-9 shrink-0 px-3">
        <Plus aria-hidden /> Add page
      </Button>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog?.kind === "delete" ? (
          <ModalContent title={`Delete “${dialog.page.title}”?`} description="The page and everything on it will be removed. Links to it will stop working.">
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={() => { onAction({ type: "delete", id: dialog.page.id }); setDialog(null); }}>Delete page</Button>
              <Button variant="outline" onClick={() => setDialog(null)}>Keep it</Button>
            </div>
          </ModalContent>
        ) : dialog ? (
          <ModalContent title={dialog.kind === "add" ? "Add a page" : "Rename page"}>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const title = String(form.get("title") ?? "").trim().slice(0, 60);
                if (!title) return;
                if (dialog.kind === "add") onAction({ type: "add", title, from: String(form.get("from") ?? "blank") });
                else onAction({ type: "rename", id: dialog.page.id, title });
                setDialog(null);
              }}
            >
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Page name
                <input name="title" required autoFocus maxLength={60} defaultValue={dialog.kind === "rename" ? dialog.page.title : ""} placeholder="About us" className="min-h-11 rounded-md border border-line px-3 font-normal" />
              </label>
              {dialog.kind === "add" && sources.length > 1 ? (
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  Start from
                  <select name="from" className="min-h-11 rounded-md border border-line px-3 font-normal">
                    {sources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              ) : null}
              <Button type="submit" className="self-start">{dialog.kind === "add" ? "Add page" : "Rename"}</Button>
            </form>
          </ModalContent>
        ) : null}
      </Dialog>
    </nav>
  );
}
