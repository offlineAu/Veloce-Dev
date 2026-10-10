"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Lock, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { contrast, type ThemeTokens } from "@/lib/builder/theme";
import { cn } from "@/lib/utils";
import {
  deleteDraftAction, devStatusAction, listDevTemplatesAction, lockAction, publishVersionAction, unlockAction, unpublishVersionAction,
  type DevTemplateRow,
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
      <ModalContent title="Developer: templates" description="Upload HTML designs as builder templates. Uploads start as drafts that only developers can see." className="max-w-[820px]">
        {!status ? (
          <p role="status" className="text-muted">Checking access…</p>
        ) : !status.enabled ? (
          <p className="rounded-md bg-accent-100 px-4 py-3 text-sm">
            Template uploads aren&apos;t set up here. Set <code>TEMPLATE_UPLOAD_PASSWORD_HASH</code> and <code>DEV_SESSION_SECRET</code> (see <code>npm run template:password</code>).
          </p>
        ) : !status.name ? (
          <UnlockForm onUnlocked={refresh} />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label="Developer tools" className="flex gap-1 rounded-full bg-ink/5 p-1">
                {(["upload", "templates"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    type="button"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={cn("min-h-9 rounded-full px-4 text-sm font-semibold", tab === t ? "bg-bg shadow-sm" : "text-muted")}
                  >
                    {t === "upload" ? "Upload" : "Templates"}
                  </button>
                ))}
              </div>
              <span className="flex items-center gap-2 text-sm text-muted">
                Signed in as <strong className="text-ink">{status.name}</strong>
                <Button variant="ghost" size="sm" onClick={() => lockAction().then(refresh)}>
                  <Lock aria-hidden /> Lock
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
  const [name, setName] = useState("");
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
    const design = f.get("designMd");
    if (design instanceof File && design.size) body.set("designMd", design);
    for (const p of files) {
      body.append("files", p.html);
      body.append("screens", p.screen ?? new Blob([]), p.screen?.name ?? "none");
    }
    setBusy(true);
    setError(null);
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

  if (result) return <UploadDone result={result} onAnother={() => { setResult(null); setFiles([]); setName(""); setSlug(""); setSlugTouched(false); }} />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={busy}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Template name
          <input required maxLength={60} value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugOf(e.target.value)); }} className={input} placeholder="Tattoo studio" />
        </label>
        <label className={labelCls}>
          Slug (stays the same across versions)
          <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={40} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} className={input} />
        </label>
        <label className={labelCls}>
          Website type
          <select name="websiteType" defaultValue="BUSINESS" className={input}>
            {TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          DESIGN.md (optional)
          <input name="designMd" type="file" accept=".md,text/markdown" className="text-sm font-normal" />
        </label>
      </div>
      <label className={labelCls}>
        Description shown in the picker (optional)
        <input name="description" maxLength={300} className={input} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Pages (HTML files; the first is the home page)</legend>
        <input
          type="file"
          accept=".html,.htm,text/html"
          multiple
          aria-label="Add HTML pages"
          onChange={(e) => {
            const added = [...(e.target.files ?? [])].map((html) => ({ html }));
            setFiles((list) => [...list, ...added].slice(0, 12));
            e.target.value = "";
          }}
          className="text-sm"
        />
        {files.length ? (
          <ol className="flex flex-col divide-y divide-line rounded-md border border-line">
            {files.map((p, i) => (
              <li key={`${p.html.name}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{i === 0 ? "Home: " : ""}{p.html.name}</span>
                <label className="text-xs text-muted">
                  Screenshot{" "}
                  <input type="file" accept="image/png,image/jpeg" aria-label={`Screenshot for ${p.html.name}`} className="w-40 text-xs"
                    onChange={(e) => { const screen = e.target.files?.[0]; setFiles((list) => list.map((x, k) => (k === i ? { ...x, screen } : x))); }} />
                </label>
                <Button type="button" size="icon" variant="ghost" aria-label={`Move ${p.html.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Move ${p.html.name} down`} disabled={i === files.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${p.html.name}`} onClick={() => setFiles((list) => list.filter((_, k) => k !== i))}><X aria-hidden /></Button>
              </li>
            ))}
          </ol>
        ) : null}
      </fieldset>

      {error ? <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p> : null}
      <Button type="submit" className="self-start" disabled={busy}>
        <Upload aria-hidden /> {busy ? "Importing… (fonts and images are downloaded, this can take a minute)" : "Upload as draft"}
      </Button>
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

function TemplateList({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [rows, setRows] = useState<DevTemplateRow[] | null>(null);
  const [pending, start] = useTransition();
  const load = useCallback(
    () =>
      listDevTemplatesAction().then((r) => {
        if (r.ok) setRows(r.templates);
        else {
          toast.error(r.error);
          onSessionEnded();
        }
      }),
    [onSessionEnded],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(done);
      else toast.error(r.error ?? "That didn't work.");
      await load();
    });

  if (!rows) return <p role="status" className="text-muted">Loading templates…</p>;
  if (!rows.length) return <p className="text-muted">No templates yet.</p>;
  return (
    <table className="w-full text-left text-sm" aria-busy={pending}>
      <thead className="text-xs uppercase tracking-[0.08em] text-muted">
        <tr><th className="py-2">Template</th><th>Version</th><th>Status</th><th>By</th><th><span className="sr-only">Actions</span></th></tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.flatMap((t) =>
          t.versions.map((v, i) => (
            <tr key={`${t.slug}-${v.version}`}>
              <td className="py-2 pr-2">{i === 0 ? <><strong>{t.name}</strong><br /><span className="text-muted">{t.slug}{t.source === "repo" ? " · in the code (use the CLI)" : ""}</span></> : null}</td>
              <td>v{v.version}</td>
              <td>{v.status === "PUBLISHED" ? "Published" : v.status === "DRAFT" ? "Draft" : "Unpublished"}</td>
              <td className="text-muted">{v.uploadedBy}</td>
              <td className="flex flex-wrap justify-end gap-1 py-2">
                <Button asChild size="sm" variant="ghost"><a href={`/build?template=${t.slug}&review=1`}>Review</a></Button>
                {t.source === "upload" && v.status !== "PUBLISHED" ? <Button size="sm" onClick={() => run(() => publishVersionAction(t.slug, v.version), `${t.slug} v${v.version} published`)}>Publish</Button> : null}
                {t.source === "upload" && v.status === "PUBLISHED" ? <Button size="sm" variant="outline" onClick={() => run(() => unpublishVersionAction(t.slug, v.version), `${t.slug} v${v.version} unpublished`)}>Unpublish</Button> : null}
                {t.source === "upload" && v.status === "DRAFT" ? (
                  <Button size="icon" variant="ghost" aria-label={`Delete draft ${t.slug} v${v.version}`} onClick={() => run(() => deleteDraftAction(t.slug, v.version), "Draft deleted")}><Trash2 aria-hidden /></Button>
                ) : null}
              </td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}
