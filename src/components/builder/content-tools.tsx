"use client";

import { useContext, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Menu as MenuIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isSlot, mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import {
  blogCollection,
  emptyCollection,
  fieldValue,
  ITEM_PAGE,
  MAX_COLLECTIONS,
  MAX_FIELDS,
  MAX_ITEMS,
  MAX_MENU,
  shortId,
  slugify,
  syncContentBlocks,
  uniqueSlug,
  type Binding,
  type Collection,
  type CollectionField,
  type FieldType,
  type ListSettings,
  type MenuItem,
  type MenuName,
  type Menus,
  type PageSeo,
} from "@/lib/builder/content";
import { PAGE_LINK, type SiteDoc } from "@/lib/builder/site-doc";
import type { BuilderData } from "./config";
import { ExtrasContext } from "./editor-context";
import { usePuck } from "./editor-hooks";
import { PagesContext } from "./links";
import { ImageAddress } from "./media-tools";

/*
 * Content in the editor (lib/builder/content.ts has the rules):
 *   ContentSync        writes out every list and menu on the open page as content or designs change, and turns a
 *                      dropped "Collection list" into a list group with a ready-made card
 *   ContentPanel       the Content tab: collections (a ready-made Blog), their fields and items, and the menus
 *   PageSettings       the page panel: SEO, "shows one item of", and the item it previews with
 *   ListControls       Style panel, groups: repeat for a collection, or follow a site menu
 *   BindingControl     Style panel, pieces in a list card or on an item page: show a field of the item
 */

export const LIST_DROP = "CollectionListDrop";

const itemPagesOf = (doc: SiteDoc) => {
  const out: Record<string, string> = {};
  for (const p of doc.pages) {
    const of = p.data.root.props?.itemsOf;
    if (typeof of === "string" && !out[of]) out[of] = p.id;
  }
  return out;
};

/** The site with every list and menu written out on every page except `skip` (which the editor syncs itself). */
export function syncSiteContent(doc: SiteDoc, skip?: string): SiteDoc {
  const pages = itemPagesOf(doc);
  return {
    ...doc,
    pages: doc.pages.map((p) => {
      if (p.id === skip) return p;
      const content = syncContentBlocks(p.data.content, doc.collections, doc.menus, (c) => pages[c]);
      return content ? { ...p, data: { ...p.data, content } } : p;
    }),
  };
}

/** A list group with a card made from the collection's fields (bound, so every card shows its item). */
export function newList(c: Collection): BlockItem {
  const first = (t: FieldType) => c.fields.find((f) => f.type === t)?.key;
  const text = (tag: string, className: string, key: string | undefined, fallback: string): BlockItem[] =>
    key ? [{ type: "DText", props: { id: shortId("DText"), tag, className, text: fallback, runs: [], bind: { content: key } } }] : [];
  const image = first("image");
  const card: BlockItem = {
    type: "Box",
    props: {
      id: shortId("Box"),
      tag: "article",
      className: "vt:flex vt:flex-col vt:gap-3 vt:rounded-xl vt:border vt:border-current/15 vt:p-5",
      items: [
        ...(image ? [{ type: "DImage", props: { id: shortId("DImage"), className: "vt:aspect-[4/3] vt:w-full vt:rounded-lg vt:object-cover", src: "", alt: "", bind: { src: image } } }] : []),
        ...text("p", "vt:text-xs vt:uppercase vt:tracking-widest vt:opacity-70", first("date"), "Date"),
        ...text("h3", "vt:text-xl vt:font-semibold", first("text"), "Title"),
        ...text("p", "vt:text-sm vt:opacity-80", first("longtext"), "Summary"),
        { type: "DLink", props: { id: shortId("DLink"), tag: "a", className: "vt:mt-auto vt:text-sm vt:font-semibold vt:underline", href: "#", textOnly: true, text: `Read the ${c.itemName}`, items: [], bind: { href: ITEM_PAGE } } },
      ],
    },
  };
  return {
    type: "Box",
    props: { id: shortId("Box"), tag: "section", className: "vt:grid vt:gap-6 vt:px-6 vt:py-12 vt:md:grid-cols-3", name: c.name, list: { collection: c.id, sort: "newest", limit: 6 } satisfies ListSettings, items: [card] },
  };
}

/** Inside <Puck>: keeps the open page's lists and menus written out, and makes dropped lists. */
export function ContentSync() {
  const content = usePuck((s) => s.appState.data.content) as BlockItem[];
  const dispatch = usePuck((s) => s.dispatch);
  const extras = useContext(ExtrasContext);
  const tick = extras?.docTick;

  useEffect(() => {
    if (!extras) return;
    let doc = extras.getDoc();
    let next = content;
    let changed = false;
    // A "Collection list" dropped from the Blocks panel: the first collection, or a new Blog.
    if (JSON.stringify(content).includes(`"type":"${LIST_DROP}"`)) {
      let c = doc.collections?.[0];
      if (!c) {
        c = blogCollection();
        const made = c;
        extras.updateDoc((d) => ({ ...d, collections: [...(d.collections ?? []), made] }));
        doc = { ...doc, collections: [made] };
        toast.success("Made a Blog collection with three sample posts. Edit them in the Content tab.");
      }
      const list = newList(c);
      next = mapBlocks(next, (b) => (b.type === LIST_DROP ? (changed = true, list) : b));
    }
    const pages = itemPagesOf(doc);
    const synced = syncContentBlocks(next, doc.collections, doc.menus, (c) => pages[c]);
    if (synced) {
      next = synced;
      changed = true;
    }
    if (changed) dispatch({ type: "setData", data: (prev) => ({ ...prev, content: next as BuilderData["content"] }), recordHistory: false });
    // `tick` re-runs this when collections or menus change in the Content tab.
  }, [content, dispatch, extras, tick]);

  return null;
}

/* ------------------------------------------------------------------------------------------------------------------
 * The Content tab.
 * ---------------------------------------------------------------------------------------------------------------- */

const TYPE_LABEL: Record<FieldType, string> = { text: "Short text", longtext: "Long text", image: "Image", link: "Link", date: "Date" };

export function ContentPanel() {
  const extras = useContext(ExtrasContext);
  const [open, setOpen] = useState<string>();
  const [item, setItem] = useState<string>();
  if (!extras) return null;
  const doc = extras.getDoc();
  const collections = doc.collections ?? [];
  // Every change: stored, and lists and menus on the other pages rewritten (the open page syncs itself).
  const update = (fn: (d: SiteDoc) => SiteDoc) => extras.updateDoc((d) => syncSiteContent(fn(d), extras.activePageId));
  const putCollection = (c: Collection) => update((d) => ({ ...d, collections: (d.collections ?? []).map((x) => (x.id === c.id ? c : x)) }));

  return (
    <div className="flex flex-col gap-5 p-4 text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] opacity-70">
          <FileText size={16} aria-hidden /> Collections
        </h3>
        {collections.length ? null : <p className="text-xs opacity-70">Collections hold content you write once and show anywhere: blog posts, team members, projects. Show them with a Collection list (Blocks tab), and give each item a page of its own.</p>}
        {collections.map((c) => (
          <div key={c.id} className="rounded border">
            <button type="button" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? undefined : c.id)} className="flex w-full items-center justify-between px-2 py-2 font-semibold">
              <span>{c.name}</span>
              <span className="text-xs font-normal opacity-70">{c.items.length} {c.items.length === 1 ? c.itemName : `${c.itemName}s`}</span>
            </button>
            {open === c.id ? <CollectionEditor c={c} put={putCollection} remove={() => update((d) => ({ ...d, collections: (d.collections ?? []).filter((x) => x.id !== c.id) }))} openItem={item} setOpenItem={setItem} /> : null}
          </div>
        ))}
        <div className={collections.length >= MAX_COLLECTIONS ? "hidden" : "flex flex-wrap gap-1"}>
          {!collections.some((c) => c.name === "Blog") ? (
            <button type="button" onClick={() => { const b = blogCollection(collections.map((c) => c.id)); update((d) => ({ ...d, collections: [...(d.collections ?? []), b] })); setOpen(b.id); }} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
              <Plus size={14} aria-hidden /> Add a blog
            </button>
          ) : null}
          <button type="button" onClick={() => { const c = emptyCollection(`Collection ${collections.length + 1}`, collections.map((x) => x.id)); update((d) => ({ ...d, collections: [...(d.collections ?? []), c] })); setOpen(c.id); }} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
            <Plus size={14} aria-hidden /> New collection
          </button>
        </div>
      </section>

      <MenuEditor menus={doc.menus} update={(menus) => update((d) => ({ ...d, menus }))} />
    </div>
  );
}

function CollectionEditor({ c, put, remove, openItem, setOpenItem }: { c: Collection; put: (c: Collection) => void; remove: () => void; openItem?: string; setOpenItem: (id?: string) => void }) {
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const setField = (i: number, f: Partial<CollectionField>) => put({ ...c, fields: c.fields.map((x, j) => (j === i ? { ...x, ...f } : x)) });
  return (
    <div className="flex flex-col gap-3 border-t px-2 py-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">Name<input value={c.name} maxLength={40} onChange={(e) => put({ ...c, name: e.target.value })} className="rounded border px-2 py-1 text-sm" /></label>
        <label className="flex flex-col gap-1 text-xs">One item is a…<input value={c.itemName} maxLength={30} onChange={(e) => put({ ...c, itemName: e.target.value })} className="rounded border px-2 py-1 text-sm" /></label>
      </div>

      <div className="flex flex-col gap-1">
        {c.items.map((it, n) => (
          <div key={it.id} className="rounded border">
            <div className="flex items-center gap-1 px-2 py-1">
              <button type="button" aria-expanded={openItem === it.id} onClick={() => setOpenItem(openItem === it.id ? undefined : it.id)} className="min-w-0 flex-1 truncate text-left">
                {it.values.title || it.slug}
              </button>
              <button type="button" aria-label="Move up" disabled={n === 0} onClick={() => put({ ...c, items: move(c.items, n, -1) })} className="rounded p-0.5 disabled:opacity-30"><ChevronUp size={14} aria-hidden /></button>
              <button type="button" aria-label="Move down" disabled={n === c.items.length - 1} onClick={() => put({ ...c, items: move(c.items, n, 1) })} className="rounded p-0.5 disabled:opacity-30"><ChevronDown size={14} aria-hidden /></button>
              <button type="button" aria-label={`Delete ${it.values.title || it.slug}`} onClick={() => put({ ...c, items: c.items.filter((x) => x.id !== it.id) })} className="rounded p-0.5"><Trash2 size={14} aria-hidden /></button>
            </div>
            {openItem === it.id ? (
              <div className="flex flex-col gap-2 border-t px-2 py-2">
                {c.fields.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-xs">
                    {f.label}
                    {f.type === "image" ? (
                      <ImageAddress
                        label={f.label}
                        value={it.values[f.key]}
                        onChange={(v) => put({ ...c, items: c.items.map((x) => (x.id === it.id ? { ...x, values: { ...x.values, [f.key]: v } } : x)) })}
                      />
                    ) : f.type === "longtext" ? (
                      <textarea rows={4} value={it.values[f.key] ?? ""} onChange={(e) => put({ ...c, items: c.items.map((x) => (x.id === it.id ? { ...x, values: { ...x.values, [f.key]: e.target.value } } : x)) })} className="rounded border px-2 py-1 text-sm" />
                    ) : (
                      <input
                        type={f.type === "date" ? "date" : "text"}
                        value={it.values[f.key] ?? ""}
                        placeholder={f.type === "link" ? "https://…" : ""}
                        onChange={(e) => put({ ...c, items: c.items.map((x) => (x.id === it.id ? { ...x, values: { ...x.values, [f.key]: f.type === "link" ? e.target.value.trim() : e.target.value } } : x)) })}
                        onBlur={(e) => {
                          // Unsafe addresses don't stay.
                          if (f.type === "link" && e.target.value && !fieldValue(f.type, e.target.value)) {
                            toast.error("That link isn't allowed. Use https://…");
                            put({ ...c, items: c.items.map((x) => (x.id === it.id ? { ...x, values: { ...x.values, [f.key]: "" } } : x)) });
                          }
                        }}
                        className="rounded border px-2 py-1 text-sm"
                      />
                    )}
                  </label>
                ))}
                <label className="flex flex-col gap-1 text-xs">
                  Address (after the item page&apos;s)
                  <input value={it.slug} onChange={(e) => put({ ...c, items: c.items.map((x) => (x.id === it.id ? { ...x, slug: uniqueSlug(e.target.value, c.items.filter((y) => y.id !== it.id).map((y) => y.slug)) } : x)) })} className="rounded border px-2 py-1 font-mono text-xs" />
                </label>
              </div>
            ) : null}
          </div>
        ))}
        {c.items.length < MAX_ITEMS ? (
          <button
            type="button"
            onClick={() => {
              const title = `New ${c.itemName}`;
              const it = { id: shortId("i"), slug: uniqueSlug(title, c.items.map((x) => x.slug)), values: { ...(c.fields.some((f) => f.key === "title") ? { title } : {}), ...(c.fields.some((f) => f.type === "date") ? { [c.fields.find((f) => f.type === "date")!.key]: new Date().toISOString().slice(0, 10) } : {}) } };
              put({ ...c, items: [it, ...c.items] });
              setOpenItem(it.id);
            }}
            className="inline-flex w-fit items-center gap-1 rounded border px-2 py-1 text-xs"
          >
            <Plus size={14} aria-hidden /> Add {c.itemName}
          </button>
        ) : null}
      </div>

      <button type="button" aria-expanded={fieldsOpen} onClick={() => setFieldsOpen(!fieldsOpen)} className="w-fit text-xs underline">
        {fieldsOpen ? "Hide fields" : `Fields (${c.fields.length})`}
      </button>
      {fieldsOpen ? (
        <div className="flex flex-col gap-1">
          {c.fields.map((f, i) => (
            <div key={f.key} className="flex items-center gap-1">
              <input aria-label="Field name" value={f.label} maxLength={40} onChange={(e) => setField(i, { label: e.target.value })} className="min-w-0 flex-1 rounded border px-2 py-1" />
              <span className="text-xs opacity-70">{TYPE_LABEL[f.type]}</span>
              <button type="button" aria-label={`Delete field ${f.label}`} onClick={() => put({ ...c, fields: c.fields.filter((_, j) => j !== i) })} className="rounded p-0.5"><Trash2 size={14} aria-hidden /></button>
            </div>
          ))}
          <form
            className={c.fields.length >= MAX_FIELDS ? "hidden" : "flex items-center gap-1"}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const label = String(form.get("label") ?? "").trim();
              if (!label) return;
              let key = slugify(label).replace(/-/g, "_").replace(/^[^a-z]+/, "") || "field";
              for (let n = 2; c.fields.some((f) => f.key === key); n++) key = `${key}_${n}`;
              put({ ...c, fields: [...c.fields, { key: key.slice(0, 32), label, type: String(form.get("type")) as FieldType }] });
              e.currentTarget.reset();
            }}
          >
            <input name="label" placeholder="New field" maxLength={40} className="min-w-0 flex-1 rounded border px-2 py-1" />
            <select name="type" defaultValue="text" className="rounded border px-1 py-1 text-xs">
              {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <button type="submit" className="rounded border px-2 py-1 text-xs">Add</button>
          </form>
        </div>
      ) : null}

      <button type="button" onClick={() => { if (confirm(`Delete the collection “${c.name}” and its ${c.items.length} items? Lists showing it stop updating.`)) remove(); }} className="w-fit text-xs text-red-700 underline">
        Delete collection
      </button>
    </div>
  );
}

const move = <T,>(list: T[], i: number, by: -1 | 1) => {
  const out = [...list];
  const [x] = out.splice(i, 1);
  out.splice(i + by, 0, x!);
  return out;
};

function MenuEditor({ menus, update }: { menus: Menus | undefined; update: (m: Menus) => void }) {
  const pages = useContext(PagesContext);
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] opacity-70">
        <MenuIcon size={16} aria-hidden /> Menus
      </h3>
      <p className="text-xs opacity-70">Edit the menu once: navigation set to follow it (select it, then Style → Follow the site menu) updates on every page.</p>
      {(["main", "footer"] as MenuName[]).map((name) => {
        const list = menus?.[name] ?? [];
        const put = (next: MenuItem[]) => update({ ...menus, [name]: next });
        return (
          <div key={name} className="flex flex-col gap-1">
            <span className="font-semibold">{name === "main" ? "Main menu" : "Footer menu"}</span>
            {list.map((m, i) => (
              <div key={m.id} className="flex items-center gap-1">
                <input aria-label="Menu label" value={m.label} maxLength={60} onChange={(e) => put(list.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))} className="min-w-0 flex-1 rounded border px-2 py-1" />
                <select aria-label="Goes to" value={m.href.startsWith(PAGE_LINK) ? m.href : "url"} onChange={(e) => put(list.map((x) => (x.id === m.id ? { ...x, href: e.target.value === "url" ? "#" : e.target.value } : x)))} className="max-w-28 rounded border px-1 py-1 text-xs">
                  {pages.map((p) => <option key={p.id} value={`${PAGE_LINK}${p.id}`}>{p.title}</option>)}
                  <option value="url">Web address…</option>
                </select>
                {!m.href.startsWith(PAGE_LINK) ? <input aria-label="Web address" value={m.href} onChange={(e) => put(list.map((x) => (x.id === m.id ? { ...x, href: e.target.value } : x)))} className="w-24 rounded border px-1 py-1 text-xs" /> : null}
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => put(move(list, i, -1))} className="rounded p-0.5 disabled:opacity-30"><ChevronUp size={14} aria-hidden /></button>
                <button type="button" aria-label={`Remove ${m.label}`} onClick={() => put(list.filter((x) => x.id !== m.id))} className="rounded p-0.5"><Trash2 size={14} aria-hidden /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1">
              <button type="button" disabled={list.length >= MAX_MENU} onClick={() => put([...list, { id: shortId("m"), label: "Link", href: pages[0] ? `${PAGE_LINK}${pages[0].id}` : "#" }])} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs disabled:opacity-50">
                <Plus size={14} aria-hidden /> Add link
              </button>
              {!list.length ? (
                <button type="button" onClick={() => put(pages.slice(0, MAX_MENU).map((p) => ({ id: shortId("m"), label: p.title, href: `${PAGE_LINK}${p.id}` })))} className="rounded border px-2 py-1 text-xs">
                  Start with every page
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------------------------
 * Page settings (page panel): SEO, the collection this page shows one item of, and the item to preview it with.
 * ---------------------------------------------------------------------------------------------------------------- */

export function PageSettings() {
  const extras = useContext(ExtrasContext);
  const root = usePuck((s) => s.appState.data.root);
  const dispatch = usePuck((s) => s.dispatch);
  if (!extras) return null;
  const props = (root.props ?? {}) as { seo?: PageSeo; itemsOf?: string; previewItem?: string; title?: string };
  const doc = extras.getDoc();
  const collections = doc.collections ?? [];
  const page = doc.pages.find((p) => p.id === extras.activePageId);
  const set = (next: Record<string, unknown>) => dispatch({ type: "replaceRoot", root: { ...root, props: { ...root.props, ...next } } as never });
  const seo = props.seo ?? {};
  const of = collections.find((c) => c.id === props.itemsOf);
  const menu = doc.menus?.main ?? [];
  const inMenu = !!page && menu.some((m) => m.href === `${PAGE_LINK}${page.id}`);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Search and sharing</legend>
        <label className="flex flex-col gap-1 text-xs">Title in search results<input value={seo.title ?? ""} maxLength={70} placeholder={props.title} onChange={(e) => set({ seo: { ...seo, title: e.target.value || undefined } })} className="rounded border px-2 py-1 text-sm" /></label>
        <label className="flex flex-col gap-1 text-xs">Description<textarea rows={3} value={seo.description ?? ""} maxLength={300} placeholder="One or two sentences on what this page offers." onChange={(e) => set({ seo: { ...seo, description: e.target.value || undefined } })} className="rounded border px-2 py-1 text-sm" /></label>
        <div className="flex flex-col gap-1 text-xs">Sharing image<ImageAddress label="Sharing image" value={seo.image} onChange={(v) => set({ seo: { ...seo, image: v || undefined } })} /></div>
        <span className="text-xs opacity-70">{(seo.description ?? "").length}/300{seo.description && seo.description.length < 70 ? " · a little more helps search results" : ""}</span>
      </fieldset>

      {collections.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Collection page</legend>
          <label className="flex flex-col gap-1 text-xs">
            This page shows one item of
            <select value={props.itemsOf ?? ""} onChange={(e) => set({ itemsOf: e.target.value || undefined, previewItem: undefined })} className="min-h-9 rounded border px-2">
              <option value="">Nothing (an ordinary page)</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {of ? (
            <>
              <label className="flex flex-col gap-1 text-xs">
                Preview with
                <select value={props.previewItem ?? of.items[0]?.id ?? ""} onChange={(e) => set({ previewItem: e.target.value })} className="min-h-9 rounded border px-2">
                  {of.items.map((it) => <option key={it.id} value={it.id}>{it.values.title || it.slug}</option>)}
                </select>
              </label>
              <span className="text-xs opacity-70">
                Each {of.itemName} gets this page at {page?.path === "/" ? "" : page?.path}/<i>{of.itemName}-address</i>. Set texts and images to show the {of.itemName}&apos;s fields (Style → Content from).
              </span>
            </>
          ) : null}
        </fieldset>
      ) : null}

      {page && !props.itemsOf ? (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={inMenu}
            onChange={(e) =>
              extras.updateDoc((d) =>
                syncSiteContent(
                  { ...d, menus: { ...d.menus, main: e.target.checked ? [...menu, { id: shortId("m"), label: page.title, href: `${PAGE_LINK}${page.id}` }] : menu.filter((m) => m.href !== `${PAGE_LINK}${page.id}`) } },
                  extras.activePageId,
                ),
              )
            }
          />
          In the main menu
        </label>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------------
 * Style panel additions.
 * ---------------------------------------------------------------------------------------------------------------- */

/** For groups: repeat for a collection (a list), or follow a site menu (navigation). */
export function ListControls() {
  const extras = useContext(ExtrasContext);
  const selected = usePuck((s) => s.selectedItem) as BlockItem | null;
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const dispatch = usePuck((s) => s.dispatch);
  if (!extras || !selected || selected.type !== "Box" || selected.props.listCopy) return null;
  const doc = extras.getDoc();
  const collections = doc.collections ?? [];
  const list = selected.props.list as ListSettings | undefined;
  const menu = selected.props.menu as MenuName | undefined;
  const kids = isSlot(selected.props.items) ? (selected.props.items as BlockItem[]) : [];
  const hasLinks = kids.some((k) => k.type === "DLink");
  const replace = (props: Record<string, unknown>) => {
    const where = getSelectorForId(String(selected.props.id));
    if (!where) return;
    let block: BlockItem = { ...selected, props: { ...selected.props, ...props } };
    // Leaving a list: the copies go, the card design stays.
    if (props.list === undefined && list) block = { ...block, props: { ...block.props, items: kids.filter((k) => !k.props.listCopy) } };
    dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone, data: block as never });
  };

  return (
    <div className="flex flex-col gap-2 rounded bg-black/[0.03] p-2 text-sm">
      {collections.length && !menu ? (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Repeat for a collection</span>
          <select value={list?.collection ?? ""} onChange={(e) => replace({ list: e.target.value ? { collection: e.target.value, sort: list?.sort ?? "newest", limit: list?.limit ?? 6 } : undefined })} className="min-h-9 rounded border px-2">
            <option value="">No (ordinary group)</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.name}: one card per {c.itemName}</option>)}
          </select>
        </label>
      ) : null}
      {list ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs">
            Order
            <select value={list.sort ?? "newest"} onChange={(e) => replace({ list: { ...list, sort: e.target.value } })} className="rounded border px-1 py-1">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">A to Z</option>
              <option value="manual">As in the Content tab</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Show up to
            <input type="number" min={1} max={MAX_ITEMS} value={list.limit ?? 6} onChange={(e) => replace({ list: { ...list, limit: Math.max(1, Math.min(MAX_ITEMS, Number(e.target.value) || 1)) } })} className="rounded border px-1 py-1" />
          </label>
          <span className="col-span-2 text-xs opacity-70">The first card is the design: edit it, and every card follows. Choose what each part shows with Style → Content from.</span>
        </div>
      ) : null}
      {hasLinks && !list ? (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Follow the site menu</span>
          <select value={menu ?? ""} onChange={(e) => replace({ menu: e.target.value || undefined })} className="min-h-9 rounded border px-2">
            <option value="">No (its own links)</option>
            <option value="main">Main menu</option>
            <option value="footer">Footer menu</option>
          </select>
          {menu && !(doc.menus?.[menu]?.length) ? <span className="text-xs opacity-70">The {menu} menu is empty: add links in the Content tab.</span> : null}
        </label>
      ) : null}
    </div>
  );
}

/** For pieces in a list's card or on an item page: show one of the item's fields here. */
export function BindingControl() {
  const extras = useContext(ExtrasContext);
  const selected = usePuck((s) => s.selectedItem) as BlockItem | null;
  const getParentById = usePuck((s) => s.getParentById);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const itemsOf = usePuck((s) => (s.appState.data.root.props as { itemsOf?: string } | undefined)?.itemsOf);
  const dispatch = usePuck((s) => s.dispatch);
  if (!extras || !selected || selected.props.listCopy) return null;
  // Which collection's fields apply: the list it's in, else the page's.
  let collectionId: string | undefined;
  for (let p = getParentById(String(selected.props.id)) as BlockItem | undefined; p; p = getParentById(String(p.props.id)) as BlockItem | undefined) {
    const l = p.props.list as ListSettings | undefined;
    if (l) {
      collectionId = l.collection;
      break;
    }
  }
  collectionId ??= itemsOf;
  const c = extras.getDoc().collections?.find((x) => x.id === collectionId);
  if (!c) return null;
  const prop = selected.type === "DImage" ? "src" : selected.type === "DLink" ? "href" : selected.type === "Box" ? "bg" : selected.type === "DText" ? "content" : selected.type === "DRich" ? "rich" : undefined;
  if (!prop) return null;
  const bind = (selected.props.bind ?? {}) as Binding;
  const fits = (t: FieldType) => (prop === "src" || prop === "bg" ? t === "image" : prop === "href" ? t === "link" : t === "text" || t === "longtext" || t === "date");
  const set = (key: string) => {
    const where = getSelectorForId(String(selected.props.id));
    if (!where) return;
    const next = { ...bind, [prop]: key || undefined };
    dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone, data: { ...selected, props: { ...selected.props, bind: Object.values(next).some(Boolean) ? next : undefined } } as never });
  };
  return (
    <label className="flex flex-col gap-1 rounded bg-black/[0.03] p-2 text-sm">
      <span className="font-semibold">Content from</span>
      <select value={bind[prop] ?? ""} onChange={(e) => set(e.target.value)} className="min-h-9 rounded border px-2">
        <option value="">Its own {prop === "content" || prop === "rich" ? "text" : prop === "href" ? "link" : "image"}</option>
        {prop === "href" ? <option value={ITEM_PAGE}>The {c.itemName}&apos;s own page</option> : null}
        {c.fields.filter((f) => fits(f.type)).map((f) => <option key={f.key} value={f.key}>{c.name}: {f.label}</option>)}
      </select>
    </label>
  );
}
