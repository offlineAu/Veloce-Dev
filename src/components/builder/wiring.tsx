"use client";

import { useContext, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import { behavioursOf } from "@/lib/builder/behaviours";
import { PAGE_LINK, slugify } from "@/lib/builder/site-doc";
import type { BuilderData } from "./config";
import { usePuck } from "./editor-hooks";
import { blockName } from "./layers";
import { PagesContext } from "./links";
import { TemplateContext } from "./template-registry";

/*
 * Wiring (Figma's prototype connections), drawn over the canvas while editing: a line from every link and button to
 * where it goes, a section of this page (blue) or another page (violet, to the page list pinned at the side), and
 * dashed lines from buttons to the part they open or the card stack they move. Drag a link's handle onto a section or
 * a page to point it there (the section gets an id if it has none), all in one undo step; click a line to select its
 * link. Turned on with "Wiring" in the toolbar. The Interactions panel does the same from the keyboard.
 */

let on = false;
const listeners = new Set<() => void>();
export const wiringStore = {
  get: () => on,
  set: (v: boolean) => {
    on = v;
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
};
export const useWiring = () => useSyncExternalStore(wiringStore.subscribe, wiringStore.get, () => false);

type Attrs = Record<string, string | number | boolean>;
type Wire = { from: string; kind: "section" | "page" | "part"; to: string; label: string };
type Box = { x: number; y: number; w: number; h: number };

const pieceEl = (doc: Document, id: string) => doc.querySelector<HTMLElement>(`[data-puck-component="${CSS.escape(id)}"]`);
const rectOf = (el: Element | null): Box | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width || r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
};
const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = Math.max(60, Math.abs(b.x - a.x) * 0.5);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x + (b.x > a.x ? -dx : dx)},${b.y} ${b.x},${b.y}`;
};

export function Wiring() {
  const enabled = useWiring();
  return enabled ? <WiringOverlay /> : null;
}

function WiringOverlay() {
  const host = useRef<HTMLDivElement>(null);
  const content = usePuck((s) => s.appState.data.content) as BlockItem[];
  const dispatch = usePuck((s) => s.dispatch);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  // Only the selected link has a handle; its wires stand out, the rest stay faint.
  const selectedId = usePuck((s) => (s.selectedItem?.type === "DLink" ? String(s.selectedItem.props.id) : undefined));
  const pages = useContext(PagesContext);
  const pkg = useContext(TemplateContext)?.pkg;
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [chips, setChips] = useState<Record<string, Box>>({});
  const [dragging, setDragging] = useState<{ from: string; x: number; y: number } | null>(null);

  // Every link and button of the page's own pieces, and where it goes.
  const wires: Wire[] = [];
  const links: BlockItem[] = [];
  mapBlocks(content, (b) => {
    if (b.type !== "DLink") return b;
    links.push(b);
    const href = typeof b.props.href === "string" ? b.props.href : "";
    const attrs = (b.props.attrs ?? {}) as Attrs;
    const behaviours = behavioursOf(attrs);
    const from = String(b.props.id);
    const label = blockName(b, "Link", pkg);
    if (href.startsWith(PAGE_LINK)) wires.push({ from, kind: "page", to: href.slice(PAGE_LINK.length).split("/")[0]!, label });
    else if (/^#[\w-]+$/.test(href)) wires.push({ from, kind: "section", to: href.slice(1), label });
    if (behaviours.toggle) wires.push({ from, kind: "part", to: behaviours.toggle.split(" ")[0]!, label });
    if (behaviours.step && typeof attrs["aria-controls"] === "string") wires.push({ from, kind: "part", to: attrs["aria-controls"], label });
    return b;
  });
  const key = links.map((l) => l.props.id).join(",") + JSON.stringify(wires);

  // Follow the parts as the page scrolls and changes.
  useEffect(() => {
    const doc = host.current?.ownerDocument;
    if (!doc) return;
    let raf = 0;
    const tick = () => {
      const next: Record<string, Box> = {};
      for (const l of links) {
        const r = rectOf(pieceEl(doc, String(l.props.id)));
        if (r) next[String(l.props.id)] = r;
      }
      for (const w of wires) if (w.kind !== "page") {
        const r = rectOf(doc.getElementById(w.to));
        if (r) next[`#${w.to}`] = r;
      }
      const nextChips: Record<string, Box> = {};
      for (const c of host.current?.querySelectorAll<HTMLElement>("[data-wiring-page]") ?? []) {
        const r = rectOf(c);
        if (r) nextChips[c.dataset.wiringPage!] = r;
      }
      setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      setChips((prev) => (JSON.stringify(prev) === JSON.stringify(nextChips) ? prev : nextChips));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
    // `key` stands for the links and wires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** Points a link at what's under the pointer: a page chip, or a section (Shift: the innermost part). */
  const drop = (from: string, x: number, y: number, inner: boolean) => {
    const doc = host.current!.ownerDocument;
    const under = doc.elementsFromPoint(x, y).filter((e) => !host.current!.contains(e));
    const chip = doc.elementsFromPoint(x, y).find((e) => e instanceof HTMLElement && e.dataset.wiringPage) as HTMLElement | undefined;
    if (chip) return setTarget(from, { href: `${PAGE_LINK}${chip.dataset.wiringPage}` });
    const parts = under.map((e) => e.closest("[data-puck-component]")).filter((e): e is HTMLElement => !!e && e.getAttribute("data-puck-component") !== from);
    if (!parts.length) return;
    // A page section is a part at the page's top level; Shift picks the part right under the pointer.
    const topLevel = new Set(content.map((b) => String(b.props.id)));
    const el = inner ? parts[0]! : (parts.find((p) => topLevel.has(p.getAttribute("data-puck-component")!)) ?? parts.at(-1)!);
    setTarget(from, { blockId: el.getAttribute("data-puck-component")! });
  };

  const setTarget = (from: string, to: { href: string } | { blockId: string }) => {
    const taken = new Set<string>();
    let anchor: string | undefined;
    let name = "section";
    mapBlocks(content, (b) => {
      const id = (b.props.attrs as Attrs | undefined)?.id;
      if (typeof id === "string") taken.add(id);
      if ("blockId" in to && b.props.id === to.blockId) {
        anchor = typeof id === "string" ? id : undefined;
        name = blockName(b, "section", pkg);
      }
      return b;
    });
    if ("blockId" in to && !anchor) {
      const base = slugify(name).replace(/^[^a-z]+/, "") || "section";
      anchor = base;
      for (let n = 2; taken.has(anchor); n++) anchor = `${base}-${n}`;
    }
    const href = "href" in to ? to.href : `#${anchor}`;
    dispatch({
      type: "setData",
      data: (prev) => ({
        ...prev,
        content: mapBlocks(prev.content as BlockItem[], (b) => {
          if (b.props.id === from) return { ...b, props: { ...b.props, href } };
          if ("blockId" in to && b.props.id === to.blockId && !(b.props.attrs as Attrs | undefined)?.id) return { ...b, props: { ...b.props, attrs: { ...((b.props.attrs as Attrs) ?? {}), id: anchor! } } };
          return b;
        }) as BuilderData["content"],
      }),
      recordHistory: true,
    });
  };

  const startDrag = (from: string) => (e: ReactPointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging({ from, x: e.clientX, y: e.clientY });
  };
  useEffect(() => {
    if (!dragging) return;
    const doc = host.current!.ownerDocument;
    const move = (e: PointerEvent) => setDragging((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const up = (e: PointerEvent) => {
      setDragging(null);
      drop(dragging.from, e.clientX, e.clientY, e.shiftKey);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDragging(null);
    doc.addEventListener("pointermove", move);
    doc.addEventListener("pointerup", up, { once: true });
    doc.addEventListener("keydown", key);
    return () => {
      doc.removeEventListener("pointermove", move);
      doc.removeEventListener("pointerup", up);
      doc.removeEventListener("keydown", key);
    };
    // Bound once per drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging?.from]);

  const select = (id: string) => {
    const where = getSelectorForId(id);
    if (where) dispatch({ type: "setUi", ui: { itemSelector: where } });
  };

  const colour = { section: "#2563eb", page: "#8b5cf6", part: "#0f766e" } as const;
  return (
    <div ref={host} data-wiring="" style={{ position: "fixed", inset: 0, zIndex: 2147483000, pointerEvents: "none", fontFamily: "system-ui, sans-serif" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          {Object.entries(colour).map(([k, c]) => (
            <marker key={k} id={`wire-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={c} />
            </marker>
          ))}
        </defs>
        {wires.map((w, i) => {
          const a = boxes[w.from];
          const b = w.kind === "page" ? chips[w.to] : boxes[`#${w.to}`];
          if (!a || !b) return null;
          const start = { x: a.x + a.w, y: a.y + a.h / 2 };
          const end = w.kind === "page" ? { x: b.x, y: b.y + b.h / 2 } : { x: b.x + Math.min(24, b.w / 2), y: b.y + Math.min(12, b.h / 2) };
          return (
            <g key={i} style={{ pointerEvents: "stroke", cursor: "pointer", opacity: !selectedId || w.from === selectedId ? 1 : 0.22 }} onClick={() => select(w.from)}>
              <title>{`${w.label} → ${w.kind === "page" ? (pages.find((p) => p.id === w.to)?.title ?? "page") : `#${w.to}`}`}</title>
              <path d={curve(start, end)} fill="none" stroke="transparent" strokeWidth={12} />
              <path d={curve(start, end)} fill="none" stroke={colour[w.kind]} strokeWidth={2} strokeDasharray={w.kind === "part" ? "6 5" : undefined} markerEnd={`url(#wire-${w.kind})`} />
            </g>
          );
        })}
        {dragging && boxes[dragging.from] ? (
          <path d={curve({ x: boxes[dragging.from]!.x + boxes[dragging.from]!.w, y: boxes[dragging.from]!.y + boxes[dragging.from]!.h / 2 }, dragging)} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 4" />
        ) : null}
        {links.filter((l) => String(l.props.id) === selectedId).map((l) => {
          const r = boxes[String(l.props.id)];
          if (!r) return null;
          return (
            <circle
              key={String(l.props.id)}
              cx={r.x + r.w}
              cy={r.y + r.h / 2}
              r={6}
              fill="#fff"
              stroke="#2563eb"
              strokeWidth={2}
              style={{ pointerEvents: "all", cursor: "crosshair" }}
              onPointerDown={startDrag(String(l.props.id))}
              aria-label={`Connect ${blockName(l, "link", pkg)}`}
            >
              <title>Drag onto a section or a page</title>
            </circle>
          );
        })}
      </svg>
      {selectedId ? null : (
        <span style={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", font: "500 12px system-ui", color: "#fff", background: "rgba(30,27,75,.9)", padding: "6px 12px", borderRadius: 999 }}>
          Select a link or button, then drag its handle onto a section or a page
        </span>
      )}
      {/* Pages, pinned at the side: links to them end here, and handles drop on them. */}
      <div style={{ position: "absolute", right: 12, top: 12, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
        <span style={{ font: "600 11px system-ui", textTransform: "uppercase", letterSpacing: ".06em", color: "#6d28d9", background: "#fff", padding: "2px 6px", borderRadius: 4 }}>Pages</span>
        {pages.map((p) => (
          <span key={p.id} data-wiring-page={p.id} style={{ pointerEvents: "all", font: "500 12px system-ui", color: "#4c1d95", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 999, padding: "4px 10px", boxShadow: "0 1px 3px rgba(0,0,0,.15)" }}>
            {p.title}
          </span>
        ))}
      </div>
    </div>
  );
}
