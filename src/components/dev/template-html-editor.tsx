"use client";

import { bakeHtml } from "./bake";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, FileCode2, ImagePlus, Info, LoaderCircle, LockKeyhole, X } from "lucide-react";
import { FileDropZone } from "./file-drop-zone";
import styles from "./dev-upload.module.css";
import { Button } from "@/components/ui/button";

interface Source {
  name: string;
  description: string;
  websiteType: string;
  designMd?: string;
  pages: { fileName: string; html: string }[];
}

export function TemplateImages({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  return <section className={styles.imageSection} aria-label="Template images">
    <div className={styles.editorSectionHeading}>
      <span className={styles.sectionIcon}><ImagePlus size={18} aria-hidden="true" /></span>
      <div><h3>Template images <span className={styles.optional}>Optional</span></h3><p>Add local images referenced in your HTML. Online and embedded images are included automatically.</p></div>
    </div>
    <div className={styles.imageChoices}>
      <FileDropZone kind="image" label="Image folder" accept=".png,.jpg,.jpeg,.webp,.gif,.avif,.svg" multiple directory compact
        title="Add an image folder" hint="Choose the folder used by your HTML" buttonText="Choose folder" files={[]} disabled={disabled} onFiles={onChange} />
      <FileDropZone kind="image" label="Or choose image files" accept=".png,.jpg,.jpeg,.webp,.gif,.avif,.svg" multiple compact
        title="Add individual images" hint="PNG, JPG, WebP, GIF, AVIF or SVG" buttonText="Browse files" files={[]} disabled={disabled} onFiles={onChange} />
    </div>
    {files.length > 0 && <div className={styles.imageSelection} role="status"><span>{files.length} {files.length === 1 ? "image" : "images"} selected</span><Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}><X size={13} aria-hidden="true" />Clear images</Button></div>}
  </section>;
}

export function TemplateHtmlEditor({ slug, version, onClose, onSaved, onSessionEnded }: { slug: string; version: number; onClose: () => void; onSaved: () => void; onSessionEnded: () => void }) {
  const [source, setSource] = useState<Source>();
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/dev/templates?slug=${encodeURIComponent(slug)}&version=${version}`, { cache: "no-store" }).then(async res => {
      const json = await res.json();
      if (!active) return;
      if (res.status === 401) onSessionEnded();
      if (json.ok) setSource(json); else setError(json.error);
    }).catch(() => { if (active) setError("Couldn't load the HTML. Try again."); });
    return () => { active = false; };
  }, [slug, version, onSessionEnded]);
  async function save() {
    if (!source) return;
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.set("slug", slug); body.set("baseVersion", String(version));
      body.set("name", source.name); body.set("description", source.description); body.set("websiteType", source.websiteType);
      if (source.designMd) body.set("designMd", new File([source.designMd], "DESIGN.md"));
      for (const p of source.pages) {
        body.append("files", new File([p.html], p.fileName, { type: "text/html" }));
        // Run once, sandboxed, so what the script builds comes along (bake.ts); the file as written stays the source.
        const rendered = await bakeHtml(p.html);
        body.append("rendered", rendered ? new File([rendered], p.fileName, { type: "text/html" }) : new Blob([]), rendered ? p.fileName : "none");
      }
      images.forEach(f => body.append("assets", f, f.webkitRelativePath || f.name));
      const res = await fetch("/api/dev/templates", { method: "POST", body });
      const json = await res.json();
      if (res.status === 401) onSessionEnded();
      if (!json.ok) setError(json.error); else onSaved();
    } catch { setError("Couldn't save the HTML. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  return <div className={styles.htmlEditor} aria-busy={busy}>
    <div className={styles.editorHeading}>
      <div><p className={styles.editorEyebrow}>TEMPLATE SOURCE</p><h2>Edit HTML <span>v{version}</span></h2><p className={styles.editorSlug}>{slug}</p></div>
      <span className={styles.draftBadge}><LockKeyhole size={12} aria-hidden="true" />Private draft</span>
    </div>
    <p className={styles.editorIntro}>Update your pages and images. Saving creates a new draft for you to review before publishing.</p>
    {!source && !error && <p role="status" className={styles.editorLoading}><LoaderCircle size={17} className="animate-spin" aria-hidden="true" />Loading HTML…</p>}
    {source?.pages.length === 0 && <div className={styles.sourceNotice}><Info size={18} aria-hidden="true" /><div><strong>Add your original HTML to get started</strong><p>This template was uploaded before source files were saved. Attach the original pages below to edit this design.</p></div></div>}
    {source && <>
      <section aria-label="HTML pages" className={styles.htmlSection}>
        <div className={styles.editorSectionHeading}>
          <span className={styles.sectionIcon}><FileCode2 size={18} aria-hidden="true" /></span>
          <div><h3>HTML pages</h3><p>{source.pages.length ? "Edit your source below, or replace it with updated files." : "Upload one or more pages from your original design."}</p></div>
          {source.pages.length > 0 && <span className={styles.pageCount}>{source.pages.length} {source.pages.length === 1 ? "page" : "pages"}</span>}
        </div>
        <FileDropZone kind="html" label="Replace HTML pages" accept=".html,.htm" multiple compact={source.pages.length > 0}
          title={source.pages.length ? "Replace HTML pages" : "Drop your HTML pages here"} hint=".html or .htm · Select all pages together" buttonText="Choose HTML files" files={[]} disabled={busy}
          onFiles={async files => {
            try {
              const pages = await Promise.all(files.map(async f => ({ fileName: f.name, html: await f.text() })));
              setSource(current => current ? { ...current, pages } : current);
              setError("");
            } catch { setError("Couldn't read those files. Try choosing them again."); }
          }} />
        {source.pages.length > 0 && <div className={styles.sourcePages}>{source.pages.map((page, i) => <details key={i} className={styles.sourcePage} open={source.pages.length === 1 ? true : undefined}>
          <summary><FileCode2 size={15} aria-hidden="true" /><span>{page.fileName}</span><span className={styles.sourceLanguage}>HTML</span><ChevronDown size={14} className={styles.sourceChevron} aria-hidden="true" /></summary>
          <textarea aria-label={`HTML for ${page.fileName}`} spellCheck={false} disabled={busy} value={page.html} onChange={e => setSource({ ...source, pages: source.pages.map((p, j) => j === i ? { ...p, html: e.target.value } : p) })} />
        </details>)}</div>}
      </section>
      <TemplateImages files={images} onChange={setImages} disabled={busy} />
      <p className={styles.reuseNote}>Previously imported images are reused. Scripts and unsafe markup are removed during import.</p>
    </>}
    {error && <p role="alert" className={styles.editorError}>{error}</p>}
    <div className={styles.editorFooter}>
      <Button type="button" variant="ghost" disabled={busy} onClick={onClose}><ArrowLeft size={15} aria-hidden="true" />Back to templates</Button>
      <Button type="button" disabled={busy || !source?.pages.length} onClick={save}>{busy ? <><LoaderCircle size={15} className="animate-spin" aria-hidden="true" />Saving draft…</> : <>Save as new draft<ArrowRight size={15} aria-hidden="true" /></>}</Button>
    </div>
  </div>;
}
