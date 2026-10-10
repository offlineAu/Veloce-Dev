"use client";

import "@puckeditor/core/no-external.css";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ActionBar, Puck, type Overrides } from "@puckeditor/core";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, Code2, Download, Eye, LayoutTemplate, Pencil, Send, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InquiryProvider, OpenInquiryButton, type SiteDraftPayload } from "@/components/forms/inquiry";
import {
  addPage, countBlocks, deletePage, duplicatePage, movePage, newDoc, pageRefs, renamePage, updatePage, withTheme,
  type PageData, type SiteDoc,
} from "@/lib/builder/site-doc";
import { normalizeTheme, type ThemeTokens } from "@/lib/builder/theme";
import { docFromTemplate, pageFromTemplate } from "@/lib/builder/template-doc";
import { builderConfig, type BuilderData } from "./config";
import { findTemplate } from "./templates";
import { loadDraft, saveDraft } from "./storage";
import { TemplatePicker } from "./template-picker";
import { SectionsDialog, SaveSectionDialog } from "./sections";
import { ImportHtmlDialog, SaveTemplateDialog } from "./dialogs";
import { SAVE_SECTION_EVENT, usePuck } from "./editor-hooks";
import { PagesContext, type BuilderMetadata } from "./links";
import { PageTabs, type PageAction, type PageSource } from "./page-tabs";
import { ReviewBanner, type ReviewInfo } from "./review-banner";
import { TemplateContext, loadTemplate, useTemplate } from "./template-registry";
import { findSection, type TemplateListing } from "@/lib/builder/template-package";

type Panel = "templates" | "sections" | "import" | "saveTemplate" | null;
type PreviewMode = "edit" | "interactive";

export interface BuilderAppProps {
  companyName: string;
  contactEmail: string;
  refToken?: string;
  /** Template requested by the link that opened the builder (e.g. /build?template=saas): a starter id or an imported slug. */
  requestedTemplate?: string;
  /** Designer templates this visitor may start from (repo and uploaded; drafts only for developers). */
  templates: TemplateListing[];
  /** Development only: reviewing an imported template before publishing it. */
  review?: ReviewInfo;
}

/** Everything the editor needs about the site, beyond the page currently on the canvas. */
interface Session {
  doc: SiteDoc;
  activeId: string;
  /** Starter id or imported slug the site came from, for labelling the inquiry. */
  templateId?: string;
}

/** Loads whatever `requested` names: a starter template now, an imported one after fetching its package. */
async function requestedDoc(requested: string | undefined, templates: TemplateListing[]): Promise<{ doc: SiteDoc; templateId: string } | null> {
  const starter = findTemplate(requested);
  if (starter) return { doc: starter.build(), templateId: starter.id };
  const imported = templates.find((t) => t.slug === requested);
  if (!imported) return null;
  const { pkg } = await loadTemplate({ slug: imported.slug, version: imported.version });
  return { doc: docFromTemplate(pkg), templateId: imported.slug };
}

export default function BuilderApp({ companyName, contactEmail, refToken, requestedTemplate, templates, review }: BuilderAppProps) {
  // The editor only ever renders in the browser, so a saved draft can be read while setting up state.
  // A saved draft wins over a template link, so the link never wipes someone's work: the picker opens instead.
  const [boot] = useState(() => {
    const saved = loadDraft();
    const restored = saved && countBlocks(saved.doc) > 0 ? saved : null;
    const asked = !!restored && !!requestedTemplate && !!(findTemplate(requestedTemplate) || templates.some((t) => t.slug === requestedTemplate));
    return { restored, asked };
  });
  const initial = boot.restored ? { doc: boot.restored.doc, activeId: boot.restored.doc.pages[0]!.id, templateId: boot.restored.templateId } : null;

  // The page on the canvas is owned by the editor; `latest` mirrors the whole site without re-rendering on every edit.
  // `session` changes only when pages are added, switched, renamed… which remounts the editor for that page.
  const [session, setSession] = useState<Session | null>(initial);
  const [mount, setMount] = useState(0);
  const [panel, setPanel] = useState<Panel>(boot.asked ? "templates" : null);
  const [pendingTemplate, setPendingTemplate] = useState<string | undefined>(boot.asked ? requestedTemplate : undefined);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("edit");
  const latest = useRef<Session | null>(initial);
  const saveTimer = useRef<number | undefined>(undefined);
  const template = useTemplate(session?.doc.templateRef);

  const save = useCallback(() => {
    const s = latest.current;
    if (s && !saveDraft({ doc: s.doc, templateId: s.templateId })) toast.error("Your browser didn't let us save this draft. Export it to keep a copy.");
  }, []);

  /** Replaces the site or changes its pages: saved at once and shown with a fresh editor. */
  const commit = useCallback(
    (next: Session) => {
      latest.current = next;
      setSession(next);
      setMount((m) => m + 1);
      save();
    },
    [save],
  );

  // Without a saved draft: open the requested template (imported ones are fetched first), or the picker.
  useEffect(() => {
    if (boot.restored) {
      if (!boot.asked) toast("Welcome back. Your last design was restored.");
      return;
    }
    let live = true;
    const start = (doc: SiteDoc, templateId?: string) => {
      if (!live) return;
      const s = { doc, activeId: doc.pages[0]!.id, templateId };
      latest.current = s;
      setSession(s);
    };
    requestedDoc(requestedTemplate, templates).then(
      (r) => {
        if (r) return start(r.doc, r.templateId);
        start(newDoc());
        if (live) setPanel("templates");
      },
      () => {
        toast.error("That template couldn't be loaded.");
        start(newDoc());
      },
    );
    return () => {
      live = false;
    };
    // Only on first open: later changes to the list must not reload the site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot, requestedTemplate]);

  /** Edits on the canvas: kept in `latest` and saved shortly after typing stops. A theme change applies site-wide. */
  const onChange = useCallback(
    (data: BuilderData) => {
      const s = latest.current;
      if (!s) return;
      let doc = updatePage(s.doc, s.activeId, data as PageData);
      const theme = data.root.props?.theme as ThemeTokens | undefined;
      if (theme && JSON.stringify(theme) !== JSON.stringify(s.doc.theme)) doc = withTheme(doc, normalizeTheme(theme));
      latest.current = { ...s, doc };
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(save, 800);
    },
    [save],
  );

  const onPageAction = useCallback(
    (a: PageAction) => {
      const s = latest.current;
      if (!s) return;
      const { doc } = s;
      switch (a.type) {
        case "select":
          if (a.id !== s.activeId) commit({ ...s, activeId: a.id });
          return;
        case "add": {
          const fromTemplate = a.from.startsWith("tpl:") && template ? pageFromTemplate(template.pkg, a.from.slice(4), doc) : undefined;
          const r = addPage(doc, a.title, fromTemplate?.data);
          commit({ ...s, doc: r.doc, activeId: r.id });
          return;
        }
        case "rename":
          commit({ ...s, doc: renamePage(doc, a.id, a.title) });
          return;
        case "duplicate": {
          const r = duplicatePage(doc, a.id);
          commit({ ...s, doc: r.doc, activeId: r.id });
          return;
        }
        case "move":
          commit({ ...s, doc: movePage(doc, a.id, a.delta) });
          return;
        case "delete": {
          const next = deletePage(doc, a.id);
          commit({ ...s, doc: next, activeId: next.pages.some((p) => p.id === s.activeId) ? s.activeId : next.pages[0]!.id });
        }
      }
    },
    [commit, template],
  );

  const replaceSite = useCallback((doc: SiteDoc, templateId?: string) => commit({ doc, activeId: doc.pages[0]!.id, templateId }), [commit]);

  const getSiteDraft = useCallback((): SiteDraftPayload => {
    const s = latest.current!;
    const websiteType = findTemplate(s.templateId)?.websiteType ?? templates.find((t) => t.slug === s.templateId)?.websiteType;
    return { templateId: s.templateId, websiteType, data: s.doc };
  }, [templates]);

  const pages = useMemo(() => (session ? pageRefs(session.doc) : []), [session]);
  const sources = useMemo<PageSource[]>(
    () => [{ value: "blank", label: "Blank page" }, ...(template?.pkg.pages.map((p) => ({ value: `tpl:${p.key}`, label: `${template.pkg.name}: ${p.title}` })) ?? [])],
    [template],
  );

  const metadata = useMemo<BuilderMetadata & { template?: typeof template }>(
    () => ({ pages, template, navigate: (id) => onPageAction({ type: "select", id }) }),
    [pages, template, onPageAction],
  );

  const overrides = useMemo<Partial<Overrides>>(
    () => ({
      headerActions: () => <HeaderActions onOpen={setPanel} onPreview={setPreviewMode} getDoc={() => latest.current!.doc} />,
      actionBar: ({ children, label, parentAction }) => <BlockActionBar label={label} parentAction={parentAction}>{children}</BlockActionBar>,
    }),
    [],
  );

  if (!session) return <div className="grid h-dvh place-items-center text-muted">Opening the builder…</div>;
  // `session` is refreshed from `latest` on every commit, so it holds the current data whenever the editor remounts.
  const active = session.doc.pages.find((p) => p.id === session.activeId) ?? session.doc.pages[0]!;

  return (
    <InquiryProvider companyName={companyName} contactEmail={contactEmail} refToken={refToken} getSiteDraft={getSiteDraft}>
      <TemplateContext.Provider value={template}>
        <PagesContext.Provider value={pages}>
          <div className="flex h-dvh flex-col">
            <p className="bg-ink px-4 py-2 text-center text-sm text-bg lg:hidden">The builder works best on a laptop or desktop. You can still edit here.</p>
            {review ? <ReviewBanner review={review} pkg={template?.pkg} /> : null}
            <PageTabs pages={pages} activeId={active.id} sources={sources} onAction={onPageAction} />
            <div className="min-h-0 flex-1">
              <Puck
                key={`${mount}:${active.id}`}
                config={builderConfig}
                data={active.data as Partial<BuilderData>}
                onChange={onChange}
                overrides={overrides}
                metadata={metadata}
                ui={{ previewMode }}
                headerTitle={active.title}
                headerPath={active.path}
                height="100%"
                iframe={{ enabled: true, waitForStyles: true }}
              >
                {/* Dialogs that edit the open page need the editor's state, so they live inside <Puck>. */}
                <SectionsDialog open={panel === "sections"} onOpenChange={(o) => setPanel(o ? "sections" : null)} template={template?.pkg} />
                <ImportHtmlDialog open={panel === "import"} onOpenChange={(o) => setPanel(o ? "import" : null)} />
                <SaveTemplateDialog open={panel === "saveTemplate"} onOpenChange={(o) => setPanel(o ? "saveTemplate" : null)} getDoc={() => latest.current!.doc} />
                <SaveSectionDialog />
                <Puck.Layout />
              </Puck>
            </div>
          </div>
        </PagesContext.Provider>
      </TemplateContext.Provider>
      <TemplatePicker
        templates={templates}
        open={panel === "templates"}
        onOpenChange={(o) => {
          setPanel(o ? "templates" : null);
          if (!o) setPendingTemplate(undefined);
        }}
        highlight={pendingTemplate}
        hasContent={() => countBlocks(latest.current!.doc) > 0}
        onChoose={(doc, templateId) => {
          replaceSite(doc, templateId);
          setPanel(null);
          setPendingTemplate(undefined);
        }}
      />
    </InquiryProvider>
  );
}

function HeaderActions({ onOpen, onPreview, getDoc }: { onOpen: (p: Panel) => void; onPreview: (m: PreviewMode) => void; getDoc: () => SiteDoc }) {
  const previewMode = usePuck((s) => s.appState.ui.previewMode);
  const dispatch = usePuck((s) => s.dispatch);
  const editing = previewMode !== "interactive";

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getDoc(), null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "my-website-design.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Less-used actions are icon-only (named for screen readers and on hover) so the toolbar fits on one row. */}
      <Button asChild variant="ghost" size="icon" title="Back to the site">
        <Link href="/#offer" aria-label="Back to the site"><ArrowLeft aria-hidden /></Link>
      </Button>
      <Button variant="ghost" size="icon" title="Add a section" aria-label="Add a section" onClick={() => onOpen("sections")}><Shapes aria-hidden /></Button>
      <Button variant="ghost" size="icon" title="Import HTML" aria-label="Import HTML" onClick={() => onOpen("import")}><Code2 aria-hidden /></Button>
      <Button variant="ghost" size="icon" title="Save as template" aria-label="Save as template" onClick={() => onOpen("saveTemplate")}><Bookmark aria-hidden /></Button>
      <Button variant="ghost" size="icon" title="Export design (JSON)" aria-label="Export design" onClick={exportJson}><Download aria-hidden /></Button>
      <Button variant="ghost" size="sm" onClick={() => onOpen("templates")}><LayoutTemplate aria-hidden /> Templates</Button>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={!editing}
        onClick={() => {
          const next = editing ? "interactive" : "edit";
          onPreview(next); // remembered, so switching pages keeps the same mode
          dispatch({ type: "setUi", ui: { previewMode: next } });
        }}
      >
        {editing ? <><Eye aria-hidden /> Preview</> : <><Pencil aria-hidden /> Edit</>}
      </Button>
      <OpenInquiryButton size="sm"><Send aria-hidden /> Send design</OpenInquiryButton>
    </div>
  );
}

/** The selected block's toolbar. Imported sections are named after the design ("Immersive Editorial Hero"). */
function BlockActionBar({ label, parentAction, children }: { label?: string; parentAction: ReactNode; children: ReactNode }) {
  const selected = usePuck((s) => s.selectedItem);
  const template = useContext(TemplateContext);
  const name = selected?.type === "DesignSection" ? (findSection(template?.pkg, String(selected.props.sectionId))?.label ?? label) : label;
  return (
    <ActionBar label={name}>
      <ActionBar.Group>{parentAction}</ActionBar.Group>
      <ActionBar.Group>
        <SaveSectionAction />
        {children}
      </ActionBar.Group>
    </ActionBar>
  );
}

/** Lets a visitor keep any block (with everything inside it) to reuse later from "My sections". */
function SaveSectionAction() {
  const selected = usePuck((s) => s.selectedItem);
  if (!selected) return null;
  return (
    <ActionBar.Action
      label="Save as reusable section"
      onClick={() => window.dispatchEvent(new CustomEvent(SAVE_SECTION_EVENT, { detail: selected }))}
    >
      <Bookmark aria-hidden size={16} />
    </ActionBar.Action>
  );
}
