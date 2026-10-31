"use client";

import "@puckeditor/core/no-external.css";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ActionBar, Puck, type Overrides } from "@puckeditor/core";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, Cable, Code2, Download, Eye, FileText, Images, LayoutTemplate, Palette, Pencil, Send, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InquiryProvider, OpenInquiryButton, type SiteDraftPayload } from "@/components/forms/inquiry";
import {
  addPage, countBlocks, deletePage, duplicatePage, movePage, newDoc, pageRefs, renamePage, updatePage, withTheme,
  type PageData, type SiteDoc,
} from "@/lib/builder/site-doc";
import { normalizeTheme, type ThemeTokens } from "@/lib/builder/theme";
import { docFromTemplate, pageFromTemplate, type TemplateSections } from "@/lib/builder/template-doc";
import { builderConfig, type BuilderData } from "./config";
import { findTemplate } from "./templates";
import { loadDraft, saveDraft } from "./storage";
import { TemplatePicker } from "./template-picker";
import { SectionsDialog, SaveSectionDialog } from "./sections";
import { TemplateDropConverter, useTemplateConfig } from "./template-blocks";
import { normalizeStyles, styleClassList } from "@/lib/builder/site-styles";
import { DEVICE_WIDTH } from "./style-field";
import { ClipboardActions, EditorShortcuts } from "./shortcuts";
import { ExtrasContext, type EditorPanel, type Extras } from "./editor-context";
import { AssetsPanel, ComponentActions, ComponentSync } from "./component-tools";
import { ImageCropControls, UploadsContext } from "./media-tools";
import { upgradeFromTemplate } from "@/lib/builder/template-upgrade";
import { InteractionsPanel } from "./interactions";
import { SectionGallery } from "./section-gallery";
import { useWiring, wiringStore } from "./wiring";
import { BindingControl, ContentPanel, ContentSync, LIST_DROP, ListControls, PageSettings } from "./content-tools";
import { StylesPanel } from "./styles-panel";
import { blockName, OutlineWithNames } from "./layers";
import { ImportHtmlDialog, SaveTemplateDialog } from "./dialogs";
import { SAVE_SECTION_EVENT, usePuck } from "./editor-hooks";
import { PagesContext, type BuilderMetadata } from "./links";
import { PageTabs, type PageAction, type PageSource } from "./page-tabs";
import { ReviewBanner, type ReviewInfo } from "./review-banner";
import { EditLayoutAction } from "./edit-layout";
import { useExtraCss, type ExtraCssTarget } from "./extra-css";
import { pieceClasses } from "@/lib/builder/elements";
import type { BlockItem } from "@/lib/builder/blocks";
import { TemplateContext, loadTemplate, useTemplateStatus, type LoadedTemplate } from "./template-registry";
import { findSection, type TemplateListing } from "@/lib/builder/template-package";

type Panel = EditorPanel;
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
  /** Whether visitors can upload images (a Blob store is connected; server/builder/media.ts). */
  uploads?: boolean;
}

/** Everything the editor needs about the site, beyond the page currently on the canvas. */
interface Session {
  doc: SiteDoc;
  activeId: string;
  /** Starter id or imported slug the site came from, for labelling the inquiry. */
  templateId?: string;
}

/** Loads whatever `requested` names: a starter template now, an imported one after fetching its package. */
async function requestedDoc(requested: string | undefined, templates: TemplateListing[], sections: TemplateSections, review?: ReviewInfo): Promise<{ doc: SiteDoc; templateId: string } | null> {
  if (review) {
    const { pkg } = await loadTemplate({ slug: review.slug, version: review.version });
    return { doc: docFromTemplate(pkg, sections), templateId: review.slug };
  }
  const starter = findTemplate(requested);
  if (starter) return { doc: starter.build(), templateId: starter.id };
  const imported = templates.find((t) => t.slug === requested);
  if (!imported) return null;
  const { pkg } = await loadTemplate({ slug: imported.slug, version: imported.version });
  return { doc: docFromTemplate(pkg, sections), templateId: imported.slug };
}

// Stable across renders: Puck re-runs its viewport setup when this object changes, and on a fresh history that
// overwrites the starting point, so the first edit couldn't be undone.
const IFRAME = { enabled: true, waitForStyles: true };

/** Puck owns the iframe element; its iframe override gives us the document so we can name it for assistive technology. */
function EditorFrame({ children, document }: { children: ReactNode; document?: Document }) {
  useEffect(() => {
    const frame = document?.defaultView?.frameElement;
    frame?.setAttribute("title", "Website design preview");
  }, [document]);
  return <>{children}</>;
}
/** The left sidebar's extra tabs, after Blocks and Outline: the design system and the site's assets. */
const PLUGINS = [
  { name: "styles", label: "Styles", icon: <Palette aria-hidden size={20} />, render: () => <StylesPanel /> },
  { name: "assets", label: "Assets", icon: <Images aria-hidden size={20} />, render: () => <AssetsPanel /> },
  { name: "content", label: "Content", icon: <FileText aria-hidden size={20} />, render: () => <ContentPanel /> },
];

/**
 * The editor's blocks: the site's, plus a "Collection list" (ContentSync turns it into a list group) and the page
 * settings (search, collection page) in the page panel. Editor-only, so the preview doesn't load them.
 */
const EDITOR_CONFIG = {
  ...builderConfig,
  categories: { ...builderConfig.categories, collections: { title: "Collections", components: [LIST_DROP] } },
  root: {
    ...builderConfig.root,
    fields: { ...builderConfig.root?.fields, seo: { type: "custom", label: "Page settings", render: () => <PageSettings /> } },
  },
  components: {
    ...builderConfig.components,
    [LIST_DROP]: {
      label: "Collection list",
      fields: {},
      render: () => <div className="grid min-h-24 place-items-center rounded border border-dashed p-6 text-sm opacity-70">Collection list</div>,
    },
  },
} as unknown as typeof builderConfig;

/** The devices the Style panel edits for (class-groups.ts): desktop, tablet and phone, in that order. */
const VIEWPORTS = [
  { width: DEVICE_WIDTH.desktop, height: "auto" as const, label: "Desktop", icon: "Monitor" as const },
  { width: DEVICE_WIDTH.tablet, height: "auto" as const, label: "Tablet", icon: "Tablet" as const },
  { width: DEVICE_WIDTH.phone, height: "auto" as const, label: "Phone", icon: "Smartphone" as const },
];

export default function BuilderApp({ companyName, contactEmail, refToken, requestedTemplate, templates, review, uploads = false }: BuilderAppProps) {
  // The editor only ever renders in the browser, so a saved draft can be read while setting up state.
  // Ordinary template links preserve saved work; review opens its exact version in a separate session.
  const [boot] = useState(() => {
    const saved = review ? null : loadDraft();
    const restored = saved && countBlocks(saved.doc) > 0 ? saved : null;
    const asked = !!restored && !!requestedTemplate && !!(findTemplate(requestedTemplate) || templates.some((t) => t.slug === requestedTemplate));
    return { restored, asked };
  });
  const initial = boot.restored ? { doc: boot.restored.doc, activeId: boot.restored.doc.pages[0]!.id, templateId: boot.restored.templateId } : null;
  // The site's content (collections, menus, item pages), for blocks to render with; kept in step as the site changes.
  const [site, setSite] = useState(() => siteContentOf(initial?.doc));

  // The page on the canvas is owned by the editor; `latest` mirrors the whole site without re-rendering on every edit.
  // `session` changes only when pages are added, switched, renamed… which remounts the editor for that page.
  const [session, setSession] = useState<Session | null>(initial);
  const [mount, setMount] = useState(0);
  const [panel, setPanel] = useState<Panel>(boot.asked ? "templates" : null);
  const [pendingTemplate, setPendingTemplate] = useState<string | undefined>(boot.asked ? requestedTemplate : undefined);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("edit");
  const latest = useRef<Session | null>(initial);
  const saveTimer = useRef<number | undefined>(undefined);
  const { template, settled: templateSettled } = useTemplateStatus(session?.doc.templateRef);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  // Piece classes on the open page (and the site theme, for sites without a template), for compiling added classes.
  // Bumped when the site changes from inside the editor (components), so panels showing it refresh.
  const [docTick, setDocTick] = useState(0);
  const [edited, setEdited] = useState<{ on: Session; classes: string[]; theme: ThemeTokens } | null>(null);

  const save = useCallback(() => {
    if (review) return; // Reviewing a version must not overwrite a saved design.
    const s = latest.current;
    if (s && !saveDraft({ doc: s.doc, templateId: s.templateId })) toast.error("Your browser didn't let us save this draft. Export it to keep a copy.");
  }, [review]);

  /** Replaces the site or changes its pages: saved at once and shown with a fresh editor. */
  const commit = useCallback(
    (next: Session) => {
      latest.current = next;
      setSession(next);
      setSite(siteContentOf(next.doc));
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
      setSite(siteContentOf(s.doc));
    };
    // Reviewing a template checks its sections one by one, so they stay whole there.
    requestedDoc(requestedTemplate, templates, review ? "locked" : "pieces", review).then(
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
      // Styles (Styles panel) are site-wide too: every page gets the change.
      const styles = normalizeStyles(data.root.props?.styles);
      if (JSON.stringify(styles ?? null) !== JSON.stringify(doc.styles ?? null)) doc = withTheme(doc, doc.theme, styles);
      // A page that became (or stopped being) a collection's item page changes where its items link to.
      if (data.root.props?.itemsOf !== s.doc.pages.find((p) => p.id === s.activeId)?.data.root.props?.itemsOf) setSite(siteContentOf(doc));
      latest.current = { ...s, doc };
      const classes = [...pieceClasses(data.content as BlockItem[]), ...styleClassList(styles)];
      const on = sessionRef.current;
      setEdited((e) => (e && e.on === on && e.classes.join(" ") === classes.join(" ") && e.theme === doc.theme ? e : on ? { on, classes, theme: doc.theme } : null));
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
          const fromTemplate = a.from.startsWith("tpl:") && template ? pageFromTemplate(template.pkg, a.from.slice(4), doc, review ? "locked" : "pieces") : undefined;
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
    [commit, template, review],
  );

  const replaceSite = useCallback((doc: SiteDoc, templateId?: string) => commit({ doc, activeId: doc.pages[0]!.id, templateId }), [commit]);

  // A site made from its template before the template gained interactions gets them now (template-upgrade.ts), once
  // per template loaded; the visitor's own changes stay.
  const upgradedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    const s = latest.current;
    if (!template || !s) return;
    const key = `${template.pkg.slug}@${template.pkg.version}`;
    if (upgradedFor.current === key) return;
    upgradedFor.current = key;
    const doc = upgradeFromTemplate(s.doc, template.pkg);
    if (!doc) return;
    commit({ ...s, doc });
    toast("Your design now has the template's latest animations and interactions.");
  }, [template, commit]);

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

  // A fresh editor (another page, a new site) starts from the page it opens; edits on it then update `edited`.
  const added = edited && edited.on === session ? edited : null;
  const openClasses = useMemo(() => {
    const page = session?.doc.pages.find((p) => p.id === session.activeId);
    return page ? [...pieceClasses(((page.data as PageData).content ?? []) as BlockItem[]), ...styleClassList(session?.doc.styles)] : [];
  }, [session]);
  const cssTarget = useMemo<ExtraCssTarget | null>(
    () => (template ? { slug: template.pkg.slug, version: template.pkg.version } : session ? { theme: added?.theme ?? session.doc.theme } : null),
    [template, session, added?.theme],
  );
  const extraCss = useExtraCss(cssTarget, added?.classes ?? openClasses);

  const metadata = useMemo<BuilderMetadata & { template?: typeof template; extraCss?: string }>(
    () => ({ pages, template, extraCss, navigate: (id) => onPageAction({ type: "select", id }), ...site }),
    [pages, template, extraCss, onPageAction, site],
  );

  // The template's own sections join the Blocks panel (not while reviewing, which checks the sections as they are).
  const config = useTemplateConfig(EDITOR_CONFIG, review ? undefined : template?.pkg);

  const overrides = useMemo<Partial<Overrides>>(
    () => ({
      iframe: ({ children, document }) => <EditorFrame document={document}>{children}</EditorFrame>,
      headerActions: () => <HeaderActions onOpen={setPanel} onPreview={setPreviewMode} getDoc={() => latest.current!.doc} />,
      actionBar: ({ children, label, parentAction }) => <BlockActionBar label={label} parentAction={parentAction}>{children}</BlockActionBar>,
      outline: ({ children }) => <OutlineWithNames>{children}</OutlineWithNames>,
      // The Blocks tab: the template's sections as pictures, then the builder's own blocks.
      drawer: ({ children }) => (
        <>
          <SectionGallery />
          {children}
        </>
      ),
      // A selected group can repeat for a collection or follow a menu; its parts can show an item's fields.
      fields: ({ children }) => (
        <>
          <div className="flex flex-col gap-2 px-4 pt-3 empty:hidden">
            <ListControls />
            <BindingControl />
            <ImageCropControls />
            <InteractionsPanel />
          </div>
          {children}
        </>
      ),
      // Puck's whole editor, with the dialogs and helpers that need its state beside it. (Not as children of
      // <Puck> plus <Puck.Layout />: that nests two layouts, and each listens for shortcuts, so ⌘Z undid twice.)
      puck: ({ children }) => (
        <>
          {children}
          <EditorExtras />
          <MobileActions onOpen={setPanel} onPreview={setPreviewMode} getDoc={() => latest.current!.doc} />
        </>
      ),
    }),
    [],
  );

  // The editor mounts once, with the template's sections in its block list: remounting it as the template arrived
  // left Puck's shortcuts listening twice (one ⌘Z undid two steps).
  const extras: Extras = {
    panel,
    setPanel,
    template,
    getDoc: () => latest.current!.doc,
    // Site-wide changes made from inside the editor (components): kept and saved without reopening the editor.
    updateDoc: (fn) => {
      const s = latest.current;
      if (!s) return;
      const doc = fn(s.doc);
      latest.current = { ...s, doc };
      setDocTick((n) => n + 1);
      setSite(siteContentOf(doc));
      save();
    },
    activePageId: session?.activeId,
    navigate: (id) => onPageAction({ type: "select", id }),
    docTick,
  };

  if (!session || !templateSettled) return <div className="grid h-dvh place-items-center text-muted">Opening the builder…</div>;
  // `session` is refreshed from `latest` on every commit, so it holds the current data whenever the editor remounts.
  const active = session.doc.pages.find((p) => p.id === session.activeId) ?? session.doc.pages[0]!;

  return (
    <InquiryProvider companyName={companyName} contactEmail={contactEmail} refToken={refToken} getSiteDraft={getSiteDraft}>
      <UploadsContext.Provider value={uploads}>
      <TemplateContext.Provider value={template}>
        <PagesContext.Provider value={pages}>
          <div className="builder-workspace flex h-dvh flex-col">
            <p className="border-b border-line bg-neutral-100 px-4 py-2 text-center text-xs text-muted lg:hidden">Use the menu to open editing tools and the bottom bar to preview or send your design.</p>
            {review ? <ReviewBanner review={review} pkg={template?.pkg} /> : null}
            <PageTabs pages={pages} activeId={active.id} sources={sources} onAction={onPageAction} />
            <div className="min-h-0 flex-1 pb-[68px] lg:pb-0">
              <ExtrasContext.Provider value={extras}>
              <Puck
                key={`${mount}:${active.id}`}
                config={config}
                data={active.data as Partial<BuilderData>}
                onChange={onChange}
                overrides={overrides}
                metadata={metadata}
                ui={{ previewMode }}
                headerTitle={active.title}
                headerPath={active.path}
                height="100%"
                iframe={IFRAME}
                viewports={VIEWPORTS}
                plugins={PLUGINS}
              />
              </ExtrasContext.Provider>
            </div>
          </div>
        </PagesContext.Provider>
      </TemplateContext.Provider>
      </UploadsContext.Provider>
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

function MobileActions({ onOpen, onPreview, getDoc }: { onOpen: (p: Panel) => void; onPreview: (m: PreviewMode) => void; getDoc: () => SiteDoc }) {
  const previewMode = usePuck((s) => s.appState.ui.previewMode);
  const dispatch = usePuck((s) => s.dispatch);
  const editing = previewMode !== "interactive";
  const wiring = useWiring();
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getDoc(), null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "my-website-design.json" });
    a.click(); URL.revokeObjectURL(a.href);
  };
  return <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-line bg-surface p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] lg:hidden">
    <Button variant="outline" size="sm" className="flex-1" aria-pressed={!editing} onClick={() => { const next = editing ? "interactive" : "edit"; onPreview(next); dispatch({ type: "setUi", ui: { previewMode: next } }); }}>{editing ? "Preview" : "Edit"}</Button>
    <OpenInquiryButton size="sm" className="flex-1">Send design</OpenInquiryButton>
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-line px-3 text-sm font-semibold">Tools</summary>
      <div className="absolute bottom-full right-0 mb-2 grid w-56 gap-1 rounded-xl border border-line bg-surface p-2 shadow-lg">
        <Link href="/#offer" className="rounded-lg px-3 py-2 text-sm hover:bg-neutral-200">Back to the site</Link>
        {([["sections", "Add a section"], ["templates", "Templates"], ["import", "Import HTML"], ["saveTemplate", "Save as template"]] as const).map(([panel, label]) => <button key={panel} type="button" className="rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-200" onClick={(event) => { onOpen(panel); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{label}</button>)}
        <button type="button" className="rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-200" onClick={exportJson}>Export design</button>
        <button type="button" aria-pressed={wiring} disabled={!editing} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-200 disabled:opacity-50" onClick={() => wiringStore.set(!wiring)}>Wiring</button>
      </div>
    </details>
  </div>;
}

function HeaderActions({ onOpen, onPreview, getDoc }: { onOpen: (p: Panel) => void; onPreview: (m: PreviewMode) => void; getDoc: () => SiteDoc }) {
  const previewMode = usePuck((s) => s.appState.ui.previewMode);
  const dispatch = usePuck((s) => s.dispatch);
  const editing = previewMode !== "interactive";
  const wiring = useWiring();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getDoc(), null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "my-website-design.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="hidden items-center gap-1 lg:flex">
      {/* Less-used actions are icon-only (named for screen readers and on hover) so the toolbar fits on one row. */}
      <Button asChild variant="ghost" size="icon" title="Back to the site">
        <Link href="/#offer" aria-label="Back to the site"><ArrowLeft aria-hidden /></Link>
      </Button>
      <Button variant="ghost" size="icon" title="Add a section" aria-label="Add a section" onClick={() => onOpen("sections")}><Shapes aria-hidden /></Button>
      <details className="relative">
        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg px-4 text-sm font-semibold hover:bg-neutral-200">More</summary>
        <div className="absolute right-0 top-full z-50 grid w-52 gap-1 rounded-xl border border-line bg-surface p-2 shadow-lg" onClick={event => { if (event.target instanceof Element && event.target.closest("button")) event.currentTarget.closest("details")?.removeAttribute("open"); }}>
          <Button variant="ghost" size="sm" className="justify-start" onClick={() => onOpen("import")}><Code2 aria-hidden /> Import HTML</Button>
          <Button variant="ghost" size="sm" className="justify-start" onClick={() => onOpen("saveTemplate")}><Bookmark aria-hidden /> Save as template</Button>
          <Button variant="ghost" size="sm" className="justify-start" onClick={exportJson}><Download aria-hidden /> Export design</Button>
        </div>
      </details>
      <Button variant="ghost" size="sm" onClick={() => onOpen("templates")}><LayoutTemplate aria-hidden /> Templates</Button>
      {/* Figma-style connections: where each link and button goes, dragged to change. */}
      <Button variant={wiring ? "secondary" : "ghost"} size="sm" aria-pressed={wiring} disabled={!editing} title="Show where links and buttons go" onClick={() => wiringStore.set(!wiring)}>
        <Cable aria-hidden /> Wiring
      </Button>
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
  const name = selected?.type === "DesignSection" ? (findSection(template?.pkg, String(selected.props.sectionId))?.label ?? label) : selected ? blockName(selected as BlockItem, label ?? selected.type, template?.pkg) : label;
  return (
    <ActionBar label={name}>
      <ActionBar.Group>{parentAction}</ActionBar.Group>
      <ActionBar.Group>
        <EditLayoutAction />
        <SaveSectionAction />
        <ClipboardActions />
        <ComponentActions />
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



/** Dialogs and helpers that edit the open page, so they live inside <Puck> (see the `puck` override). */
function EditorExtras() {
  const x = useContext(ExtrasContext);
  if (!x) return null;
  const { panel, setPanel, template, getDoc } = x;
  return (
    <>
      <SectionsDialog open={panel === "sections"} onOpenChange={(o) => setPanel(o ? "sections" : null)} template={template?.pkg} />
      <ImportHtmlDialog open={panel === "import"} onOpenChange={(o) => setPanel(o ? "import" : null)} />
      <SaveTemplateDialog open={panel === "saveTemplate"} onOpenChange={(o) => setPanel(o ? "saveTemplate" : null)} getDoc={getDoc} />
      <SaveSectionDialog />
      <TemplateDropConverter pkg={template?.pkg} />
      <ComponentSync />
      <ContentSync />
      <EditorShortcuts />
    </>
  );
}

/** What blocks need to know about the site's content: its collections and menus, and each collection's item page. */
function siteContentOf(doc: SiteDoc | undefined) {
  const itemPages: Record<string, string> = {};
  for (const p of doc?.pages ?? []) {
    const of = p.data.root.props?.itemsOf;
    if (typeof of === "string" && !itemPages[of]) itemPages[of] = p.id;
  }
  return { collections: doc?.collections, menus: doc?.menus, itemPages };
}
