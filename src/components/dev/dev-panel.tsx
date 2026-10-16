"use client";

import { bakeHtml } from "./bake";
import { TemplateList } from "./template-list";
import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ExternalLink, FileCode2, FolderOpen, LayoutTemplate, LoaderCircle, Lock, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { contrast, type ThemeTokens } from "@/lib/builder/theme";
import { cn } from "@/lib/utils";
import { FileDropZone, fileSize } from "./file-drop-zone";
import styles from "./dev-upload.module.css";
import { TemplateImages } from "./template-html-editor";
import {
  devStatusAction, lockAction, unlockAction,
} from "@/server/actions/dev-templates";

/*
 * Developer panel (opened with the secret shortcut): unlock with the shared password, upload HTML designs as draft
 * templates, map their colours, review them in the builder and publish. Every action is checked on the server.
 */

type Status = { enabled: boolean; name: string | null } | null;
type Tab = "upload" | "templates";

const input = "min-h-11 w-full rounded-md border border-line bg-bg px-3 text-[15px]";
const labelCls = "flex flex-col gap-1.5 text-sm font-semibold";

export default function DevPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>(null);
  const [tab, setTab] = useState<Tab>("upload");
  const refresh = useCallback(() => devStatusAction().then(setStatus), []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <ModalContent title={<span className={styles.dialogTitle}><span><LayoutTemplate size={22} strokeWidth={1.5} aria-hidden="true" /></span>Developer: templates</span>} description="Bring a design into the builder. Upload it as a private draft, review it, then publish when it’s ready." className="max-w-[880px]">
        {!status ? (
          <p role="status" className="text-muted">Checking access…</p>
        ) : !status.enabled ? (
          <p className="rounded-md bg-accent-100 px-4 py-3 text-sm">
            Template uploads aren&apos;t set up here. Set <code>TEMPLATE_UPLOAD_PASSWORD_HASH</code> and <code>DEV_SESSION_SECRET</code> (see <code>npm run template:password</code>).
          </p>
        ) : !status.name ? (
          <UnlockForm onUnlocked={refresh} />
        ) : (
          <div className={styles.panel}>
            <div className={styles.toolbar}>
              <div role="tablist" aria-label="Developer tools" className={styles.tabs}>
                {(["upload", "templates"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    type="button"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={cn(styles.tab, tab === t && styles.activeTab)}
                  >
                    {t === "upload" ? <Upload size={15} aria-hidden="true" /> : <FolderOpen size={15} aria-hidden="true" />}{t === "upload" ? "Upload" : "Templates"}
                  </button>
                ))}
              </div>
              <span className={styles.session}><span className={styles.sessionDot} aria-hidden="true" />
                Signed in as <strong>{status.name}</strong>
                <Button variant="ghost" size="sm" onClick={() => lockAction().then(refresh)}>
                  <Lock size={14} aria-hidden /> Lock
                </Button>
              </span>
            </div>
            {tab === "upload" ? <UploadForm onSessionEnded={refresh} /> : <TemplateList onSessionEnded={refresh} />}
          </div>
        )}
      </ModalContent>
    </Dialog>
  );
}

function UnlockForm({ onUnlocked }: { onUnlocked: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const r = await unlockAction({ password: String(f.get("password") ?? ""), name: String(f.get("name") ?? "") });
      if (r.ok) onUnlocked();
      else setError(r.error);
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className={labelCls}>
        Your name
        <input name="name" required maxLength={40} autoComplete="name" className={input} />
      </label>
      <label className={labelCls}>
        Developer password
        <input name="password" type="password" required autoComplete="current-password" autoFocus className={input} />
      </label>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      <Button type="submit" className="self-start" disabled={pending}>{pending ? "Checking…" : "Unlock"}</Button>
    </form>
  );
}

interface UploadResult {
  slug: string;
  version: number;
  report: string;
  palette: { name: string; value: string }[];
  theme: ThemeTokens;
  pages: { title: string; sections: number }[];
}

const TYPES = [["BUSINESS", "Business"], ["CORPORATE", "Corporate"], ["ECOMMERCE_STORE", "Online store"], ["WEB_APP", "Web app"], ["LANDING_PAGE", "Landing page"], ["OTHER", "Other"]] as const;
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function UploadForm({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [files, setFiles] = useState<{ html: File; screen?: File }[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [designMd, setDesignMd] = useState<File>();
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const move = (i: number, d: -1 | 1) =>
    setFiles((list) => {
      const next = [...list];
      [next[i], next[i + d]] = [next[i + d]!, next[i]!];
      return next;
    });

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!files.length) return setError("Add at least one HTML file.");
    const f = new FormData(e.currentTarget);
    const body = new FormData();
    body.set("name", name);
    body.set("slug", slug || slugOf(name));
    body.set("websiteType", String(f.get("websiteType")));
    body.set("description", String(f.get("description") ?? ""));
    for (const image of images) body.append("assets", image, image.webkitRelativePath || image.name);
    if (designMd?.size) body.set("designMd", designMd);
    setBusy(true);
    setError(null);
    // Each page runs once here, sandboxed, so what its script builds (product cards, lists) is uploaded too (bake.ts).
    for (const p of files) {
      body.append("files", p.html);
      body.append("screens", p.screen ?? new Blob([]), p.screen?.name ?? "none");
      const rendered = await bakeHtml(await p.html.text());
      body.append("rendered", rendered ? new File([rendered], p.html.name, { type: "text/html" }) : new Blob([]), rendered ? p.html.name : "none");
    }
    try {
      const res = await fetch("/api/dev/templates", { method: "POST", body });
      const json = (await res.json().catch(() => ({ ok: false, error: "The server didn't answer properly." }))) as ({ ok: true } & UploadResult) | { ok: false; error: string };
      if (res.status === 401) onSessionEnded();
      if (!json.ok) setError(json.error);
      else setResult(json);
    } catch {
      setError("The upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (result) return <UploadDone result={result} onAnother={() => { setResult(null); setFiles([]); setImages([]); setDesignMd(undefined); setName(""); setSlug(""); setSlugTouched(false); }} />;

  return (
    <form onSubmit={submit} className={styles.uploadForm} aria-busy={busy}>
      <fieldset disabled={busy} className={styles.details}>
        <legend className={styles.sectionLabel}><span>01</span>Template details</legend>
        <div className={styles.fields}>
          <label className={styles.field}>
            Template name
            <input required maxLength={60} value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugOf(e.target.value)); }} className={input} placeholder="e.g. Tattoo studio" />
          </label>
          <label className={styles.field}>
            Slug <span className={styles.optional}>Stable across versions</span>
            <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={40} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} className={cn(input, styles.slug)} placeholder="tattoo-studio" />
          </label>
          <label className={styles.field}>
            Website type
            <select name="websiteType" defaultValue="BUSINESS" className={input}>
              {TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            Picker description <span className={styles.optional}>Optional</span>
            <input name="description" maxLength={300} className={input} placeholder="A short description of the design" />
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.uploadSection} disabled={busy}>
        <legend className={styles.sectionLabel}><span>02</span>Design files<span className={styles.fileCount}>{files.length} / 12 pages</span></legend>
        <div className={styles.uploadGrid}>
          <div>
            <p className={styles.uploadLabel}>HTML pages<span>Required</span></p>
            <FileDropZone label="Add HTML pages" kind="html" accept=".html,.htm,text/html" multiple files={files.map(page => page.html)} disabled={busy} maxSize={1_000_000}
              title={files.length ? "Add more HTML pages" : "Drop your HTML pages here"} hint=".html or .htm · Up to 12 pages · 1 MB each" buttonText="Choose HTML files"
              onFiles={added => {
                if (files.length + added.length > 12) { setError("Up to 12 pages per template. Remove a page before adding more."); return; }
                setFiles(list => [...list, ...added.map(html => ({ html }))]); setError(null);
              }} />
          </div>
          <div>
            <p className={styles.uploadLabel}>DESIGN.md<span>Optional</span></p>
            <FileDropZone label="DESIGN.md (optional)" kind="markdown" accept=".md,text/markdown" files={designMd ? [designMd] : []} disabled={busy} maxSize={200_000}
              title="Add your design notes" hint="Markdown notes to guide the import · 200 KB max" buttonText="Choose Markdown" onFiles={added => setDesignMd(added[0])} onRemove={() => setDesignMd(undefined)} />
          </div>
        </div>
        <TemplateImages files={images} onChange={setImages} disabled={busy} />
        <p className={styles.orderHint}>The first page becomes the home page. Reorder pages below and add an optional screenshot for each.</p>
        <p role="status" className="sr-only">{files.length ? `${files.length} HTML ${files.length === 1 ? "page" : "pages"} selected.` : ""}</p>
        {files.length ? (
          <ol className={styles.pageList}>
            {files.map((page, index) => (
              <li key={`${page.html.name}-${index}`} className={styles.pageItem}>
                <div className={styles.pageHeader}>
                  <span className={styles.pageFileIcon}><FileCode2 size={21} strokeWidth={1.5} aria-hidden="true" /></span>
                  <div className={styles.pageName}><strong title={page.html.name}>{page.html.name}</strong><span>{fileSize(page.html.size)}{index === 0 ? <span className={styles.homeBadge}>Home page</span> : `Page ${index + 1}`}</span></div>
                  <div className={styles.pageActions}>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Move ${page.html.name} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} aria-hidden /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Move ${page.html.name} down`} disabled={busy || index === files.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} aria-hidden /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${page.html.name}`} disabled={busy} onClick={() => setFiles(list => list.filter((_, k) => k !== index))}><X size={15} aria-hidden /></Button>
                  </div>
                </div>
                <FileDropZone label={`Screenshot for ${page.html.name}`} kind="image" accept=".png,.jpg,.jpeg,image/png,image/jpeg" compact files={page.screen ? [page.screen] : []} disabled={busy}
                  title="Attach a screenshot" hint="PNG or JPG · Optional visual reference" buttonText="Choose image"
                  onFiles={added => setFiles(list => list.map((item, k) => k === index ? { ...item, screen: added[0] } : item))}
                  onRemove={() => setFiles(list => list.map((item, k) => k === index ? { ...item, screen: undefined } : item))} />
              </li>
            ))}
          </ol>
        ) : null}
      </fieldset>

      {error ? <p role="alert" className="whitespace-pre-wrap break-words rounded-md bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p> : null}
      <div className={styles.uploadFooter}>
        <p><ShieldCheck size={17} strokeWidth={1.5} aria-hidden="true" /><span><strong>Private until you publish.</strong><br />Review the draft in the builder first.</span></p>
        <Button type="submit" disabled={busy || !files.length}>
          {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Upload size={17} aria-hidden />} {busy ? "Importing design…" : "Upload as draft"}
        </Button>
      </div>
      {busy ? <p role="status" className={styles.busyNote}>Importing pages and downloading their fonts and images. This can take a minute.</p> : null}
    </form>
  );
}

const ROLES = [["accent", "Accent (buttons, highlights)"], ["bg", "Page background"], ["fg", "Text"], ["muted", "Muted text"]] as const;

function UploadDone({ result, onAnother }: { result: UploadResult; onAnother: () => void }) {
  const [theme, setTheme] = useState(result.theme);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const warnings = (result.report.split("## Needs review")[1]?.split("## ")[0] ?? "").split("\n").filter((l) => l.startsWith("- ") && !/Nothing flagged/.test(l));
  const preview = { ...theme, ...choice } as ThemeTokens;

  const apply = async () => {
    setSaving(true);
    const res = await fetch("/api/dev/templates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: result.slug, version: result.version, colors: choice }) });
    const json = (await res.json().catch(() => null)) as { ok: boolean; theme?: ThemeTokens; error?: string } | null;
    setSaving(false);
    if (json?.ok && json.theme) {
      setTheme(json.theme);
      setChoice({});
      toast.success("Theme colours saved.");
    } else toast.error(json?.error ?? "Couldn't save the colours.");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-md bg-sage-100 px-4 py-3 text-sm text-sage-800">
        <strong>{result.slug} v{result.version}</strong> was saved as a draft: {result.pages.map((p) => `${p.title} (${p.sections} sections)`).join(", ")}.
      </div>
      {warnings.length ? (
        <details className="rounded-md border border-line px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold">{warnings.length} things to check</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">{warnings.map((w) => <li key={w}>{w.slice(2)}</li>)}</ul>
        </details>
      ) : null}

      <section aria-labelledby="dev-theme" className="flex flex-col gap-3">
        <h3 id="dev-theme" className="font-semibold">Theme colours for added blocks</h3>
        <p className="text-sm text-muted">Native blocks a visitor adds (pricing, FAQ…) use these. Pick from the design&apos;s own colours.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map(([role, label]) => (
            <label key={role} className={labelCls}>
              {label}
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-9 shrink-0 rounded border border-line" style={{ background: preview[role] }} />
                <select value={choice[role] ?? ""} onChange={(e) => setChoice((c) => ({ ...c, [role]: e.target.value }))} className={input}>
                  <option value="">Keep {theme[role]}</option>
                  {result.palette.map((p) => <option key={p.name} value={p.value}>{p.name} ({p.value})</option>)}
                </select>
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm">
          Text on background {contrast(preview.fg, preview.bg).toFixed(1)}:1 · Muted on background {contrast(preview.muted, preview.bg).toFixed(1)}:1
          {contrast(preview.fg, preview.bg) < 4.5 || contrast(preview.muted, preview.bg) < 4.5 ? <strong className="text-danger"> (below 4.5:1)</strong> : null}
        </p>
        <Button variant="outline" className="self-start" disabled={!Object.keys(choice).length || saving} onClick={apply}>{saving ? "Saving…" : "Save colours"}</Button>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={`/build?template=${result.slug}&review=1`}><ExternalLink aria-hidden /> Open review (publish from there)</a>
        </Button>
        <Button variant="ghost" onClick={onAnother}>Upload another</Button>
      </div>
    </div>
  );
}
