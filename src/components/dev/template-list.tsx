"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, FolderOpen, MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deleteDraftAction, listDevTemplatesAction, publishVersionAction, unpublishVersionAction,
  type DevTemplateRow, type UploadedVersion,
} from "@/server/actions/dev-templates";
import { TemplateHtmlEditor } from "./template-html-editor";
import styles from "./template-list.module.css";

type VersionRef = { slug: string; version: number };
type Operation = { key: string; label: string };
const versionKey = (v: VersionRef) => `${v.slug}@${v.version}`;
const statusLabel = { DRAFT: "Draft", PUBLISHED: "Published", UNPUBLISHED: "Unpublished" };

function uploadedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function TemplateList({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [editing, setEditing] = useState<VersionRef | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<DevTemplateRow[] | null>(null);
  const [error, setError] = useState(false);
  const [operation, setOperation] = useState<Operation | null>(null);
  const busy = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const returnTo = useRef<VersionRef | null>(null);
  const scrollTop = useRef(0);

  const load = useCallback(
    () => listDevTemplatesAction().then((r) => {
      if (r.ok) { setRows(r.templates); setError(false); }
      else { toast.error(r.error); onSessionEnded(); }
    }).catch(() => setError(true)),
    [onSessionEnded],
  );

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!editing && restoreFocus.current && !operation) {
      restoreFocus.current = false;
      const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-edit-version]");
      const target = Array.from(buttons ?? []).find((b) => b.dataset.editVersion === (returnTo.current && versionKey(returnTo.current)));
      (target ?? list.current)?.focus({ preventScroll: true });
      const dialog = list.current?.closest('[role="dialog"]');
      if (dialog) dialog.scrollTop = scrollTop.current;
    }
  }, [editing, rows, operation]);

  const run = async (ref: VersionRef, label: string, fn: () => Promise<{ ok: boolean; error?: string }>, done: string, deleting = false) => {
    if (busy.current) return;
    busy.current = true;
    scrollTop.current = list.current?.closest('[role="dialog"]')?.scrollTop ?? 0;
    setOperation({ key: versionKey(ref), label });
    try {
      const r = await fn();
      if (r.ok) {
        toast.success(done);
        if (deleting) { returnTo.current = null; restoreFocus.current = true; }
      } else toast.error(r.error ?? "That didn't work.");
      await load();
    } catch {
      toast.error("That didn't work. Please try again.");
    } finally {
      busy.current = false;
      setOperation(null);
    }
  };

  const closeEditor = () => { restoreFocus.current = true; setEditing(null); };
  if (editing) return <TemplateHtmlEditor {...editing} onSessionEnded={onSessionEnded} onClose={closeEditor} onSaved={() => {
    closeEditor(); toast.success("HTML saved as a new draft. Review it before publishing."); void load();
  }} />;

  const versionRow = (t: DevTemplateRow, v: UploadedVersion, latest = false) => {
    const ref = { slug: t.slug, version: v.version };
    const key = versionKey(ref);
    const current = operation?.key === key;
    const date = uploadedDate(v.createdAt);
    return (
      <div className={styles.versionRow} key={v.version} role="group" aria-label={`${t.name} v${v.version}`}>
        <div className={styles.versionInfo}>
          <div className={styles.versionHeading}>
            <strong>v{v.version}</strong>
            <span className={cn(styles.badge, v.status === "PUBLISHED" && styles.published)}>{statusLabel[v.status]}</span>
            {latest ? <span className={styles.latest}>Latest version</span> : null}
          </div>
          <p className={styles.metadata}>{t.source === "repo" ? "Imported" : "Uploaded"} by {v.uploadedBy}{date ? <> · <time dateTime={v.createdAt}>{date}</time></> : null}</p>
        </div>
        <div className={styles.actions}>
          <Button asChild size="sm" variant="ghost" className={styles.action}><a href={`/build?template=${encodeURIComponent(t.slug)}&review=1&version=${v.version}`}>Review<span className="sr-only"> {t.name} v{v.version}</span></a></Button>
          {t.source === "upload" ? <>
            <Button size="sm" variant="outline" className={styles.action} disabled={!!operation} data-edit-version={key} onClick={() => {
              returnTo.current = ref; scrollTop.current = list.current?.closest('[role="dialog"]')?.scrollTop ?? 0; setEditing(ref);
            }}>Edit HTML<span className="sr-only"> {t.name} v{v.version}</span></Button>
            <Button size="sm" variant={v.status === "PUBLISHED" ? "outline" : "default"} className={cn(styles.action, styles.publish)} disabled={!!operation} onClick={() => void run(ref, v.status === "PUBLISHED" ? "Unpublishing…" : "Publishing…", () => v.status === "PUBLISHED" ? unpublishVersionAction(t.slug, v.version) : publishVersionAction(t.slug, v.version), `${t.name} v${v.version} ${v.status === "PUBLISHED" ? "unpublished" : "published"}`)}>
              {current ? operation.label : v.status === "PUBLISHED" ? "Unpublish" : "Publish"}<span className="sr-only"> {t.name} v{v.version}</span>
            </Button>
            {v.status === "DRAFT" ? <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild><Button size="icon" variant="ghost" className={styles.more} disabled={!!operation} aria-label={`More actions for ${t.name} v${v.version}`}><MoreHorizontal size={18} aria-hidden /></Button></DropdownMenu.Trigger>
              <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} collisionPadding={12} className={styles.menu}>
                <DropdownMenu.Item className={styles.deleteItem} onSelect={() => void run(ref, "Deleting…", () => deleteDraftAction(t.slug, v.version), "Draft deleted", true)}><Trash2 size={16} aria-hidden />Delete draft<span className="sr-only"> {t.name} v{v.version}</span></DropdownMenu.Item>
              </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root> : null}
          </> : null}
        </div>
      </div>
    );
  };

  return <div ref={list} role="region" tabIndex={-1} className={styles.list} aria-label="Templates" aria-busy={!!operation}>
    {error ? <div role="alert" className={styles.empty}>Templates couldn’t be refreshed. <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button></div> : null}
    {!rows && !error ? <p role="status" className={styles.empty}>Loading templates…</p> : null}
    {rows?.length === 0 ? <div className={styles.empty}><FolderOpen size={24} aria-hidden /><strong>No templates yet</strong><p>Upload a design to add your first template.</p></div> : null}
    <p className="sr-only" role="status">{operation ? operation.label : ""}</p>
    {rows?.map((t) => {
      const [latest, ...history] = [...t.versions].sort((a, b) => b.version - a.version);
      const published = t.versions.filter((v) => v.status === "PUBLISHED").map((v) => `v${v.version}`).join(", ");
      return <article key={t.slug} className={styles.card} aria-label={t.name}>
        <header className={styles.cardHeader}>
          <div><h2>{t.name}</h2><p className={styles.slug}>{t.slug}</p></div>
          <span className={styles.source}>{t.source === "repo" ? "Repository" : "Uploaded"}</span>
        </header>
        {t.source === "repo" ? <p className={styles.note}>Managed in the code. Use the CLI to update or publish.</p> : null}
        {published ? <p className={styles.note}>Published versions: {published}</p> : null}
        {latest ? versionRow(t, latest, true) : <p className={styles.note}>No versions yet.</p>}
        {history.length ? <details className={styles.history} open={expanded[t.slug] ?? false} onToggle={(e) => {
          const open = e.currentTarget.open;
          setExpanded((current) => current[t.slug] === open ? current : { ...current, [t.slug]: open });
        }}>
          <summary>Version history <span>({history.length})</span><ChevronDown size={16} aria-hidden /></summary>
          <div>{history.map((v) => versionRow(t, v))}</div>
        </details> : null}
      </article>;
    })}
  </div>;
}
