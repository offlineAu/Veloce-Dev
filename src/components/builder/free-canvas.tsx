"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceAround, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceAround } from "lucide-react";
import { mapBlocks, type BlockItem } from "@/lib/builder/blocks";
import { deviceFor } from "@/lib/builder/class-groups";
import { align, distribute, fitGroup, flowGroupClasses, flowItemClasses, freeGroupClasses, freeItemClasses, placeItem, snap, type Align, type Edges, type Guides, type Rect } from "@/lib/builder/free-layout";
import type { BuilderData } from "./config";
import { usePuck } from "./editor-hooks";

/*
 * The free canvas: inside a group set to "Free" (free-layout.ts), the selected item gets a frame to drag and eight
 * handles to resize, with smart guides to its neighbours and the group's edges and centre. Shift-click selects more
 * items of the same group (dragged together; align and distribute appear above them). Arrow keys nudge 1px, Shift
 * 10px. Double-click a text to type in it. Rendered inside the canvas (the root block), above the page.
 *
 * While dragging, the elements move directly (inline styles) for smooth feedback; letting go writes their classes
 * in one undo step and the inline styles are dropped.
 */

/* Extra selected items (Shift-click), beside Puck's own single selection. */
let extra: string[] = [];
const listeners = new Set<() => void>();
const setExtra = (ids: string[]) => {
  extra = ids;
  listeners.forEach((l) => l());
};
const useExtra = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => extra, () => extra);

const pieceEl = (doc: Document, id: string) => doc.querySelector<HTMLElement>(`[data-puck-component="${CSS.escape(id)}"]`);

/** An element's box in its group's coordinates (inside the group's border). */
function rectIn(el: HTMLElement, group: HTMLElement): Rect {
  const a = el.getBoundingClientRect();
  const g = group.getBoundingClientRect();
  return { x: a.left - g.left - group.clientLeft, y: a.top - g.top - group.clientTop, w: a.width, h: a.height };
}

type Drag = {
  edges: Edges;
  startX: number;
  startY: number;
  group: HTMLElement;
  items: { id: string; el: HTMLElement; from: Rect }[];
  others: Rect[];
  last?: Rect[];
};

const HANDLES: [string, Edges, string][] = [
  ["nw", { left: true, top: true }, "nwse-resize"],
  ["n", { top: true }, "ns-resize"],
  ["ne", { right: true, top: true }, "nesw-resize"],
  ["e", { right: true }, "ew-resize"],
  ["se", { right: true, bottom: true }, "nwse-resize"],
  ["s", { bottom: true }, "ns-resize"],
  ["sw", { left: true, bottom: true }, "nesw-resize"],
  ["w", { left: true }, "ew-resize"],
];
const HANDLE_POS: Record<string, React.CSSProperties> = {
  nw: { left: -5, top: -5 },
  n: { left: "calc(50% - 5px)", top: -5 },
  ne: { right: -5, top: -5 },
  e: { right: -5, top: "calc(50% - 5px)" },
  se: { right: -5, bottom: -5 },
  s: { left: "calc(50% - 5px)", bottom: -5 },
  sw: { left: -5, bottom: -5 },
  w: { left: -5, top: "calc(50% - 5px)" },
};

export function FreeCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const selected = usePuck((s) => s.selectedItem);
  const getParentById = usePuck((s) => s.getParentById);
  const getItemById = usePuck((s) => s.getItemById);
  const dispatch = usePuck((s) => s.dispatch);
  const width = usePuck((s) => s.appState.ui.viewports.current.width);
  const content = usePuck((s) => s.appState.data.content);
  const device = deviceFor(width);
  const ids = useExtra();

  const selectedId = selected ? String(selected.props.id) : undefined;
  const parent = selectedId ? (getParentById(selectedId) as BlockItem | undefined) : undefined;
  const free = device !== "phone" && parent?.type === "Box" && !!parent.props.free;
  const groupId = free ? String(parent!.props.id) : undefined;
  // The selection: Puck's item plus the Shift-clicked ones in the same group.
  const chosen = free && selectedId ? [selectedId, ...ids.filter((i) => i !== selectedId)] : [];
  const locked = chosen.some((id) => !!(getItemById(id)?.props as { locked?: boolean } | undefined)?.locked);
  const chosenKey = chosen.join(",");
  // Callbacks read the selection from here, so they don't change with every render.
  const chosenRef = useRef(chosen);
  useLayoutEffect(() => {
    chosenRef.current = chosen;
  });

  // Shift-clicks only add to a selection inside the same free group; anything else starts over.
  useEffect(() => {
    if (!free && extra.length) setExtra([]);
  }, [free, selectedId]);

  const [boxes, setBoxes] = useState<{ id: string; r: DOMRect }[]>([]);
  const [guides, setGuides] = useState<Guides & { g?: DOMRect }>({ x: [], y: [] });
  // Double-clicking a text lets clicks through to it, until something else is selected.
  const [typingIn, setTypingIn] = useState<string>();
  const typing = !!selectedId && typingIn === selectedId;
  const drag = useRef<Drag | null>(null);

  // Follow the selected elements (they move with scrolling, editing and the drag itself).
  useLayoutEffect(() => {
    const doc = host.current?.ownerDocument;
    const chosen = chosenRef.current;
    if (!doc || !chosen.length) return;
    let raf = 0;
    const tick = () => {
      const next = chosen.flatMap((id) => {
        const el = pieceEl(doc, id);
        return el ? [{ id, r: el.getBoundingClientRect() }] : [];
      });
      setBoxes((prev) => (prev.length === next.length && prev.every((p, i) => p.id === next[i]!.id && p.r.x === next[i]!.r.x && p.r.y === next[i]!.r.y && p.r.width === next[i]!.r.width && p.r.height === next[i]!.r.height) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [chosenKey, content]);

  /** Writes the items' new places (and grows the group to fit) as one undo step. */
  const commit = useCallback(
    (moves: { id: string; r: Partial<Rect> }[], groupEl: HTMLElement) => {
      if (!groupId || device === "phone") return;
      const doc = groupEl.ownerDocument;
      const byId = new Map(moves.map((m) => [m.id, m.r]));
      // The group's height has to hold every item where it now is.
      let bottom = 0;
      for (const child of groupEl.querySelectorAll<HTMLElement>(":scope > [data-puck-component]")) {
        const id = child.getAttribute("data-puck-component")!;
        const r = rectIn(child, groupEl);
        const m = byId.get(id);
        bottom = Math.max(bottom, (m?.y ?? r.y) + (m?.h ?? r.h));
      }
      dispatch({
        type: "setData",
        data: (prev) => ({
          ...prev,
          content: mapBlocks(prev.content as BlockItem[], (b) => {
            const id = String(b.props.id);
            const m = byId.get(id);
            if (m) return { ...b, props: { ...b.props, className: placeItem(String(b.props.className ?? ""), m, device) } };
            if (id === groupId) return { ...b, props: { ...b.props, className: fitGroup(String(b.props.className ?? ""), Math.ceil(bottom), device) } };
            return b;
          }) as BuilderData["content"],
        }),
        recordHistory: true,
      });
      // The classes take over on the next paint; then the drag's inline styles go.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          for (const id of byId.keys()) {
            const el = pieceEl(doc, id);
            if (el) for (const p of ["left", "top", "width", "height"] as const) el.style.removeProperty(p);
          }
        }),
      );
    },
    [groupId, device, dispatch],
  );

  const start = (e: ReactPointerEvent, edges: Edges) => {
    const doc = host.current?.ownerDocument;
    if (!doc || !groupId || locked || e.button !== 0) return;
    const group = pieceEl(doc, groupId);
    if (!group) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const items = chosen.flatMap((id) => {
      const el = pieceEl(doc, id);
      return el ? [{ id, el, from: rectIn(el, group) }] : [];
    });
    const others = [...group.querySelectorAll<HTMLElement>(":scope > [data-puck-component]")].filter((el) => !chosen.includes(el.getAttribute("data-puck-component")!)).map((el) => rectIn(el, group));
    drag.current = { edges, startX: e.clientX, startY: e.clientY, group, items, others };
  };

  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const { edges } = d;
    const lead = d.items[0]!;
    const g = { w: d.group.clientWidth, h: d.group.clientHeight };
    let next: Rect[];
    let found: Guides;
    if (edges.move) {
      const moved = { ...lead.from, x: lead.from.x + dx, y: lead.from.y + dy };
      const s = e.altKey ? { rect: moved, guides: { x: [], y: [] } } : snap(moved, d.others, g, edges);
      const ox = s.rect.x - lead.from.x;
      const oy = s.rect.y - lead.from.y;
      next = d.items.map((it) => ({ ...it.from, x: it.from.x + ox, y: it.from.y + oy }));
      found = s.guides;
    } else {
      const f = lead.from;
      let r: Rect = { ...f };
      if (edges.left) r = { ...r, x: Math.min(f.x + dx, f.x + f.w - 8), w: Math.max(8, f.w - dx) };
      if (edges.right) r = { ...r, w: Math.max(8, f.w + dx) };
      if (edges.top) r = { ...r, y: Math.min(f.y + dy, f.y + f.h - 8), h: Math.max(8, f.h - dy) };
      if (edges.bottom) r = { ...r, h: Math.max(8, f.h + dy) };
      // Shift keeps the proportions (images, mostly) when pulling a corner.
      if (e.shiftKey && (edges.left || edges.right) && (edges.top || edges.bottom)) {
        const ratio = f.w / f.h;
        r.h = r.w / ratio;
        if (edges.top) r.y = f.y + f.h - r.h;
      }
      const s = e.altKey ? { rect: r, guides: { x: [], y: [] } } : snap(r, d.others, g, edges);
      next = [s.rect];
      found = s.guides;
    }
    d.last = next;
    next.forEach((r, i) => {
      const el = d.items[i]!.el;
      el.style.left = `${Math.round(r.x)}px`;
      el.style.top = `${Math.round(r.y)}px`;
      el.style.width = `${Math.round(r.w)}px`;
      if (!edges.move && (edges.top || edges.bottom)) el.style.height = `${Math.round(r.h)}px`;
    });
    setGuides({ ...found, g: d.group.getBoundingClientRect() });
  };

  const end = () => {
    const d = drag.current;
    drag.current = null;
    setGuides({ x: [], y: [] });
    if (!d?.last) return;
    const resizedHeight = !d.edges.move && (d.edges.top || d.edges.bottom);
    commit(
      d.last.map((r, i) => ({ id: d.items[i]!.id, r: { x: r.x, y: r.y, ...(d.edges.move ? {} : { w: r.w }), ...(resizedHeight ? { h: r.h } : {}) } })),
      d.group,
    );
  };

  /** Nudges, aligns and distributes: new places for the selection, written at once. */
  const applyRects = useCallback(
    (make: (rs: Rect[]) => Rect[]) => {
      const doc = host.current?.ownerDocument;
      if (!doc || !groupId || locked) return;
      const group = pieceEl(doc, groupId);
      if (!group) return;
      const items = chosenRef.current.flatMap((id) => {
        const el = pieceEl(doc, id);
        return el ? [{ id, r: rectIn(el, group) }] : [];
      });
      const next = make(items.map((i) => i.r));
      commit(items.map((it, i) => ({ id: it.id, r: { x: next[i]!.x, y: next[i]!.y } })), group);
    },
    [groupId, locked, commit],
  );

  // Shift-click adds to (or takes from) the selection; arrow keys nudge.
  useEffect(() => {
    const doc = host.current?.ownerDocument;
    if (!doc) return;
    const onClick = (e: MouseEvent) => {
      if (!e.shiftKey || !groupId || !selectedId) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-puck-component]");
      const id = el?.getAttribute("data-puck-component");
      if (!id || !el?.parentElement || el.parentElement !== pieceEl(doc, groupId)) return;
      e.preventDefault();
      e.stopPropagation();
      if (id === selectedId) return;
      setExtra(extra.includes(id) ? extra.filter((x) => x !== id) : [...extra, id]);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!groupId || e.metaKey || e.ctrlKey || e.altKey || !e.key.startsWith("Arrow")) return;
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? "")) return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      applyRects((rs) => rs.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy })));
    };
    const top = doc.defaultView?.parent?.document;
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("keydown", onKey, true);
    if (top && top !== doc) top.addEventListener("keydown", onKey, true);
    return () => {
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("keydown", onKey, true);
      if (top && top !== doc) top.removeEventListener("keydown", onKey, true);
    };
  }, [groupId, selectedId, applyRects]);

  const editText = (id: string) => {
    const doc = host.current?.ownerDocument;
    const field = doc && pieceEl(doc, id)?.querySelector<HTMLElement>("[contenteditable=true], [contenteditable=plaintext-only]");
    setTypingIn(selectedId);
    field?.focus();
  };

  // Frames only while something free is selected (the last measurements may still be around for a moment).
  const shown = chosen.length ? boxes.filter((b) => chosen.includes(b.id)) : [];
  const multi = shown.length > 1;
  const bounds = shown.length
    ? { left: Math.min(...shown.map((b) => b.r.left)), bottom: Math.max(...shown.map((b) => b.r.bottom)) }
    : undefined;

  return (
    <div
      ref={host}
      aria-hidden={!shown.length}
      data-free-canvas=""
      // Clicks on the frames, handles and toolbar are ours: Puck would read them as a click on the page and deselect.
      onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2147483000 }}
    >
      {shown.map((b, i) => (
        <div
          key={b.id}
          title={locked ? "Locked" : "Drag to move · double-click to edit text"}
          onPointerDown={(e) => start(e, { move: true })}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onDoubleClick={() => editText(b.id)}
          style={{
            position: "fixed",
            left: b.r.left,
            top: b.r.top,
            width: b.r.width,
            height: b.r.height,
            outline: `2px solid ${locked ? "#9ca3af" : "#2563eb"}`,
            outlineOffset: 0,
            cursor: locked ? "not-allowed" : "move",
            pointerEvents: typing ? "none" : "auto",
            touchAction: "none",
          }}
        >
          {!multi && i === 0 && !locked
            ? HANDLES.map(([k, edges, cursor]) => (
                <div
                  key={k}
                  data-handle={k}
                  onPointerDown={(e) => start(e, edges)}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                  style={{ position: "absolute", width: 10, height: 10, background: "#fff", border: "2px solid #2563eb", borderRadius: 2, cursor, pointerEvents: "auto", ...HANDLE_POS[k] }}
                />
              ))
            : null}
        </div>
      ))}
      {/* Below the selection: Puck's block toolbar sits above it. */}
      {multi && bounds && !locked ? (
        <div role="toolbar" aria-label="Align and distribute" style={{ position: "fixed", left: bounds.left, top: bounds.bottom + 8, display: "flex", gap: 2, padding: 3, borderRadius: 8, background: "#111", pointerEvents: "auto" }}>
          {(
            [
              ["left", AlignStartVertical, "Align left"],
              ["center", AlignCenterVertical, "Align centres"],
              ["right", AlignEndVertical, "Align right"],
              ["top", AlignStartHorizontal, "Align top"],
              ["middle", AlignCenterHorizontal, "Align middles"],
              ["bottom", AlignEndHorizontal, "Align bottom"],
            ] as [Align, typeof AlignStartVertical, string][]
          ).map(([how, IconC, label]) => (
            <button key={how} type="button" title={label} aria-label={label} onClick={() => applyRects((rs) => align(rs, how))} style={btn}>
              <IconC size={16} aria-hidden />
            </button>
          ))}
          {shown.length > 2 ? (
            <>
              <button type="button" title="Space evenly across" aria-label="Space evenly across" onClick={() => applyRects((rs) => distribute(rs, "x"))} style={btn}>
                <AlignHorizontalSpaceAround size={16} aria-hidden />
              </button>
              <button type="button" title="Space evenly down" aria-label="Space evenly down" onClick={() => applyRects((rs) => distribute(rs, "y"))} style={btn}>
                <AlignVerticalSpaceAround size={16} aria-hidden />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {guides.g
        ? [
            ...guides.x.map((x) => <div key={`x${x}`} style={{ position: "fixed", left: guides.g!.left + x, top: guides.g!.top, width: 1, height: guides.g!.height, background: "#ec4899" }} />),
            ...guides.y.map((y) => <div key={`y${y}`} style={{ position: "fixed", top: guides.g!.top + y, left: guides.g!.left, height: 1, width: guides.g!.width, background: "#ec4899" }} />),
          ]
        : null}
    </div>
  );
}

const btn: React.CSSProperties = { display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 6, color: "#fff", background: "transparent", border: 0, cursor: "pointer" };

/**
 * Turns a group's free layout on (each item pinned where it is now, measured on the canvas) or off (items back in
 * the flow). `groupClasses` lets the caller change the group's own classes in the same undo step.
 */
export function useFreeMode() {
  const dispatch = usePuck((s) => s.dispatch);
  const getItemById = usePuck((s) => s.getItemById);
  return useCallback(
    (groupId: string, on: boolean, groupClasses: (c: string) => string = (c) => c) => {
      const doc = document.querySelector<HTMLIFrameElement>("iframe")?.contentDocument;
      const group = doc && pieceEl(doc, groupId);
      if (!group) return false;
      const rects = new Map<string, Rect>();
      for (const child of group.querySelectorAll<HTMLElement>(":scope > [data-puck-component]")) rects.set(child.getAttribute("data-puck-component")!, rectIn(child, group));
      const height = Math.ceil(group.clientHeight);
      dispatch({
        type: "setData",
        data: (prev) => ({
          ...prev,
          content: mapBlocks(prev.content as BlockItem[], (b) => {
            const id = String(b.props.id);
            const cls = String(b.props.className ?? "");
            if (id === groupId) return { ...b, props: { ...b.props, free: on || undefined, className: groupClasses(on ? freeGroupClasses(cls, height) : flowGroupClasses(cls)) } };
            const r = rects.get(id);
            if (!r || getItemById(groupId) === undefined) return b;
            // Images and drawings keep their height; text and groups grow with what's in them.
            const keepHeight = b.type === "DImage" || b.type === "DRaw";
            return { ...b, props: { ...b.props, className: on ? freeItemClasses(cls, r, keepHeight) : flowItemClasses(cls) } };
          }) as BuilderData["content"],
        }),
        recordHistory: true,
      });
      return true;
    },
    [dispatch, getItemById],
  );
}
