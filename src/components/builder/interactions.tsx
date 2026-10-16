"use client";

import { useContext } from "react";
import { MousePointerClick, Play, Sparkles, X } from "lucide-react";
import { mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import { behavioursOf, parseBehaviour, type BehaviourName } from "@/lib/builder/behaviours";
import { ELEMENT_TYPES } from "@/lib/builder/elements";
import { ENTRANCES, HOVERS, readMotion, writeMotion } from "@/lib/builder/motion";
import { PAGE_LINK, slugify } from "@/lib/builder/site-doc";
import type { BuilderData } from "./config";
import { usePuck } from "./editor-hooks";
import { blockName } from "./layers";
import { PagesContext } from "./links";
import { TemplateContext } from "./template-registry";

/*
 * Interactions (Figma's prototype tab) for the selected part, in the Style panel:
 *   On click        go to a page, scroll to a section of this page, open a web address, open/close another part,
 *                   show the next or previous card of a stack
 *   On hover        a hover effect (motion.ts), a light that follows the pointer
 *   While scrolling an entrance, counting up, an endless scroll
 * Everything is stored on the part itself (its link, `data-vt-*` behaviours, motion classes) and played by the
 * runtime in Preview and in the sent design (behaviours.tsx). The page's other interactions show as chips.
 */

const PIECES = new Set<string>(ELEMENT_TYPES);
type Attrs = Record<string, string | number | boolean>;

const LABELS: Partial<Record<BehaviourName, string>> = {
  reveal: "Shows as it scrolls in", split: "Words slide in", roll: "Letters roll on hover", flip: "Letters flip in", count: "Counts up",
  marquee: "Endless scroll", toggle: "Opens and closes a part", accordion: "Opens one item at a time", alt: "Changes text when open",
  tabs: "Switches panels", stack: "Card stack", carousel: "Carousel", step: "Moves a card stack", spy: "Marks the section in view", spotlight: "Glow follows the pointer",
  pointer: "Light follows the pointer", seq: "Plays in order", transient: "Shows for a moment", filter: "Highlights matches", form: "Checks and thanks",
};

/** A readable id for a part ("Recent jobs" → "recent-jobs"), unique on the page. */
function newId(name: string, taken: Set<string>): string {
  const base = slugify(name).replace(/^[^a-z]+/, "") || "part";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

const idsOn = (content: BlockItem[]) => {
  const out = new Set<string>();
  mapBlocks(content, (b) => {
    const id = (b.props.attrs as Attrs | undefined)?.id;
    if (typeof id === "string") out.add(id);
    return b;
  });
  return out;
};

export function InteractionsPanel() {
  const selected = usePuck((s) => s.selectedItem) as BlockItem | null;
  const content = usePuck((s) => s.appState.data.content) as BlockItem[];
  const dispatch = usePuck((s) => s.dispatch);
  const pages = useContext(PagesContext);
  const pkg = useContext(TemplateContext)?.pkg;
  if (!selected) return null;
  if (selected.type === "DesignSection") return <p className="rounded bg-black/[0.03] p-2 text-xs">Choose Edit layout (in the toolbar) to add interactions to this section&apos;s parts.</p>;
  if (!PIECES.has(selected.type) || selected.props.listCopy) return null;

  const id = String(selected.props.id);
  const attrs = (selected.props.attrs ?? {}) as Attrs;
  const className = String(selected.props.className ?? "");
  const motion = readMotion(className);
  const behaviours = behavioursOf(attrs);

  /** Changes this part (and maybe another, in the same undo step). */
  const update = (fn: (b: BlockItem) => BlockItem) =>
    dispatch({ type: "setData", data: (prev) => ({ ...prev, content: mapBlocks(prev.content as BlockItem[], fn) as BuilderData["content"] }), recordHistory: true });
  const setOwn = (next: { attrs?: Attrs; className?: string; href?: string }) =>
    update((b) => (b.props.id === id ? { ...b, props: { ...b.props, ...next } } : b));
  const withAttrs = (changes: Record<string, string | boolean | undefined>) => {
    const out: Attrs = { ...attrs };
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined) delete out[k];
      else out[k] = v;
    }
    return out;
  };

  // Parts that can be targets: page sections (top level) and any part with an id.
  const sections = content.filter((b) => PIECES.has(b.type)).map((b) => ({ id: String(b.props.id), anchor: (b.props.attrs as Attrs | undefined)?.id as string | undefined, name: blockName(b, b.type, pkg) }));
  const named: { id: string; anchor: string; name: string }[] = [];
  mapBlocks(content, (b) => {
    const anchor = (b.props.attrs as Attrs | undefined)?.id;
    if (typeof anchor === "string" && b.props.id !== id) named.push({ id: String(b.props.id), anchor, name: blockName(b, b.type, pkg) });
    return b;
  });

  /** Points this part at another (giving the other an id if it has none): `link` sets the href, else an attribute. */
  const target = (targetBlockId: string, set: (anchor: string) => { attrs?: Attrs; href?: string }) => {
    const taken = idsOn(content);
    let anchor: string | undefined;
    mapBlocks(content, (b) => {
      if (b.props.id === targetBlockId) anchor = (b.props.attrs as Attrs | undefined)?.id as string | undefined;
      return b;
    });
    const finalAnchor = anchor ?? newId(sections.find((s) => s.id === targetBlockId)?.name ?? named.find((s) => s.id === targetBlockId)?.name ?? "part", taken);
    const own = set(finalAnchor);
    update((b) => {
      if (b.props.id === targetBlockId && !anchor) return { ...b, props: { ...b.props, attrs: { ...((b.props.attrs as Attrs) ?? {}), id: finalAnchor } } };
      if (b.props.id === id) return { ...b, props: { ...b.props, ...own } };
      return b;
    });
  };

  // What a click does now.
  const href = typeof selected.props.href === "string" ? selected.props.href : undefined;
  const isLink = selected.type === "DLink";
  const click = behaviours.toggle !== undefined ? "toggle" : behaviours.step !== undefined ? "step" : href?.startsWith(PAGE_LINK) ? "page" : href?.startsWith("#") && href.length > 1 ? "section" : href && href !== "#" ? "url" : "none";
  const clickTarget = click === "toggle" ? behaviours.toggle!.split(" ")[0] : click === "step" ? String(attrs["aria-controls"] ?? "") : click === "section" ? href!.slice(1) : undefined;
  // Card stacks on the page (for next/previous buttons).
  const stackIds = new Set<string>();
  mapBlocks(content, (b) => {
    if (behavioursOf(b.props.attrs as Attrs).stack !== undefined || behavioursOf(b.props.attrs as Attrs).carousel !== undefined) stackIds.add(String(b.props.id));
    return b;
  });
  const stacks = named.filter((n) => stackIds.has(n.id));

  const setClick = (kind: string) => {
    const clean = withAttrs({ "data-vt-toggle": undefined, "data-vt-step": undefined, ...(click === "toggle" || click === "step" ? { "aria-controls": undefined, "aria-expanded": undefined } : {}) });
    if (kind === "none") setOwn({ attrs: clean, href: isLink ? "#" : undefined });
    else if (kind === "page") setOwn({ attrs: clean, href: pages[0] ? `${PAGE_LINK}${pages[0].id}` : "#" });
    else if (kind === "url") setOwn({ attrs: clean, href: "https://" });
    else if (kind === "section" && sections[0]) target(sections[0].id, (a) => ({ attrs: clean, href: `#${a}` }));
    // The runtime keeps aria-expanded up to date (a stored value would be put back on every redraw).
    else if (kind === "toggle" && named[0]) setOwn({ attrs: { ...clean, "data-vt-toggle": named[0].anchor, "aria-controls": named[0].anchor } });
    else if (kind === "step" && stacks[0]) setOwn({ attrs: { ...clean, "data-vt-step": "next", "aria-controls": stacks[0].anchor } });
  };

  const marquee = behaviours.marquee?.split(" ");
  const others = (Object.keys(behaviours) as BehaviourName[]).filter((n) => !["toggle", "step", "marquee", "count", "pointer", "spotlight"].includes(n));
  const select = "min-h-9 w-full rounded border px-1 text-sm";

  return (
    <div className="flex flex-col gap-3 rounded bg-black/[0.03] p-2 text-sm">
      <h3 className="flex items-center gap-1.5 font-semibold"><Sparkles size={14} aria-hidden /> Interactions</h3>

      {isLink ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.06em] opacity-70"><MousePointerClick size={12} aria-hidden /> On click</legend>
          <select aria-label="On click" value={click} onChange={(e) => setClick(e.target.value)} className={select}>
            <option value="none">Nothing</option>
            <option value="page">Go to a page</option>
            <option value="section" disabled={!sections.length}>Scroll to a section</option>
            <option value="url">Open a web address</option>
            <option value="toggle" disabled={!named.length}>Open or close a part</option>
            <option value="step" disabled={!stacks.length}>Next or previous card</option>
          </select>
          {click === "page" ? (
            <select aria-label="Page" value={href} onChange={(e) => setOwn({ href: e.target.value })} className={select}>
              {pages.map((p) => <option key={p.id} value={`${PAGE_LINK}${p.id}`}>{p.title}</option>)}
            </select>
          ) : null}
          {click === "section" ? (
            <select aria-label="Section" value={sections.find((s) => s.anchor === clickTarget)?.id ?? ""} onChange={(e) => target(e.target.value, (a) => ({ href: `#${a}` }))} className={select}>
              {sections.find((s) => s.anchor === clickTarget) ? null : <option value="">Choose a section</option>}
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : null}
          {click === "url" ? <input aria-label="Web address" value={href} onChange={(e) => setOwn({ href: e.target.value.trim() })} className="min-h-9 rounded border px-2" /> : null}
          {click === "toggle" ? (
            <select aria-label="Part to open or close" value={clickTarget} onChange={(e) => setOwn({ attrs: withAttrs({ "data-vt-toggle": e.target.value, "aria-controls": e.target.value }) })} className={select}>
              {named.map((n) => <option key={n.id} value={n.anchor}>{n.name}</option>)}
            </select>
          ) : null}
          {click === "step" ? (
            <div className="grid grid-cols-2 gap-1">
              <select aria-label="Card stack" value={clickTarget} onChange={(e) => setOwn({ attrs: withAttrs({ "aria-controls": e.target.value }) })} className={select}>
                {stacks.map((n) => <option key={n.id} value={n.anchor}>{n.name}</option>)}
              </select>
              <select aria-label="Direction" value={behaviours.step} onChange={(e) => setOwn({ attrs: withAttrs({ "data-vt-step": e.target.value }) })} className={select}>
                <option value="next">Next</option>
                <option value="prev">Previous</option>
              </select>
            </div>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] opacity-70">On hover</legend>
        <select aria-label="On hover" value={motion.hover} onChange={(e) => setOwn({ className: writeMotion(className, "hover", e.target.value) })} className={select}>
          {HOVERS.map((o) => <option key={o.value} value={o.value}>{o.value ? o.label : "No effect"}</option>)}
        </select>
        {selected.type === "Box" ? (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={behaviours.pointer !== undefined} onChange={(e) => setOwn({ attrs: withAttrs({ "data-vt-pointer": e.target.checked ? "" : undefined }) })} />
            Light follows the pointer over its items
          </label>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] opacity-70">While scrolling</legend>
        <select aria-label="As it scrolls into view" value={motion.enter} onChange={(e) => setOwn({ className: writeMotion(className, "enter", e.target.value) })} className={select}>
          {ENTRANCES.map((o) => <option key={o.value} value={o.value}>{o.value ? o.label : "No entrance"}</option>)}
        </select>
        {selected.type === "DText" ? (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={behaviours.count !== undefined} onChange={(e) => setOwn({ attrs: withAttrs({ "data-vt-count": e.target.checked ? "" : undefined }) })} />
            Numbers count up
          </label>
        ) : null}
        {selected.type === "Box" ? (
          <>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!marquee} onChange={(e) => setOwn({ attrs: withAttrs({ "data-vt-marquee": e.target.checked ? "x left 40 pause" : undefined }) })} />
              Endless scroll (its first item repeats)
            </label>
            {marquee ? (
              <div className="grid grid-cols-3 gap-1">
                <select aria-label="Direction" value={`${marquee[0]} ${marquee[1]}`} onChange={(e) => setOwn({ attrs: withAttrs({ "data-vt-marquee": parseBehaviour("data-vt-marquee", `${e.target.value} ${marquee[2]} ${marquee.includes("pause") ? "pause" : ""}`) ?? undefined }) })} className={select}>
                  <option value="x left">Left</option>
                  <option value="x right">Right</option>
                  <option value="y up">Up</option>
                  <option value="y down">Down</option>
                </select>
                <input aria-label="Speed (pixels a second)" type="number" min={4} max={400} value={marquee[2]} onChange={(e) => setOwn({ attrs: withAttrs({ "data-vt-marquee": parseBehaviour("data-vt-marquee", `${marquee[0]} ${marquee[1]} ${e.target.value || 40} ${marquee.includes("pause") ? "pause" : ""}`) ?? undefined }) })} className="min-h-9 rounded border px-1" />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={marquee.includes("pause")} onChange={(e) => setOwn({ attrs: withAttrs({ "data-vt-marquee": `${marquee.slice(0, 3).join(" ")}${e.target.checked ? " pause" : ""}` }) })} />
                  Pause on hover
                </label>
              </div>
            ) : null}
          </>
        ) : null}
      </fieldset>

      {others.length ? (
        <div className="flex flex-wrap gap-1">
          {others.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-900">
              {LABELS[n] ?? n}
              <button type="button" aria-label={`Remove: ${LABELS[n] ?? n}`} onClick={() => setOwn({ attrs: withAttrs({ [`data-vt-${n}`]: undefined }) })} className="rounded-full p-0.5 hover:bg-violet-200">
                <X size={10} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <PreviewButton />
    </div>
  );
}

/** Try the interactions on the canvas. */
function PreviewButton() {
  const dispatch = usePuck((s) => s.dispatch);
  return (
    <button type="button" onClick={() => dispatch({ type: "setUi", ui: { previewMode: "interactive" } })} className="inline-flex w-fit items-center gap-1 rounded border px-2 py-1 text-xs">
      <Play size={12} aria-hidden /> Try it out
    </button>
  );
}
