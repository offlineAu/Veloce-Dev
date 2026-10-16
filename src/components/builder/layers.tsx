"use client";

import { useContext, useEffect, useRef, type ReactNode } from "react";
import { isSlot, type BlockItem } from "@/lib/builder/blocks";
import { behavioursOf } from "@/lib/builder/behaviours";
import { ELEMENT_TYPES } from "@/lib/builder/elements";
import { displayName } from "@/lib/builder/section-labels";
import type { TemplatePackage } from "@/lib/builder/template-package";
import { usePuck } from "./editor-hooks";
import { TemplateContext } from "./template-registry";

/*
 * The Outline (layers) panel with readable names: Puck names every layer after its block type ("Text", "Group"), so
 * a template page reads as a wall of "Group". Each layer shows its own name instead: the name the visitor gave it,
 * the start of its text, an image's description, a link's words, a section's name from the template. Double-click a
 * layer to rename it (stored as the block's `name`). Puck's own outline (selecting, dragging, expanding) is untouched;
 * only the label text is replaced, by matching each layer's block id.
 */

const MAX_NAME = 60;
const clip = (s: string, n = 40) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const TAG_NAMES: Record<string, string> = { header: "Header", nav: "Navigation", footer: "Footer", section: "Section", main: "Main", aside: "Sidebar", form: "Form", ul: "List", ol: "List", li: "List item", article: "Card", figure: "Figure" };

/** The first words found inside a block, for naming groups after what they hold. */
function firstText(b: BlockItem, depth = 0): string | undefined {
  if (depth > 6) return undefined;
  const own = typeof b.props.text === "string" && b.props.text.trim() ? b.props.text : Array.isArray(b.props.runs) ? (b.props.runs as { text?: string }[]).map((r) => r.text ?? "").join("") : "";
  if (own.trim()) return own;
  for (const v of Object.values(b.props)) {
    if (!isSlot(v)) continue;
    for (const c of v) {
      const t = firstText(c, depth + 1);
      if (t) return t;
    }
  }
  return undefined;
}

/** Words in a design's class names that don't say what a part is. */
const GENERIC = new Set(["wrap", "wrapper", "inner", "outer", "container", "row", "box", "el", "set", "content", "holder", "block", "div", "vt"]);
const EXPAND: Record<string, string> = { col: "column", cols: "columns", btn: "button", img: "image", pic: "picture", nav: "navigation", cta: "call to action", faq: "FAQ", hgrid: "grid", vgrid: "grid", desc: "description", txt: "text", sec: "section", hdr: "header", ftr: "footer", ico: "icon", ic: "icon", qty: "quantity", est: "estimate", rev: "review", bg: "background" };

/** "vt-hero-copy" → "Hero copy", "vt-wall-col" → "Wall column"; undefined for utilities and meaningless names. */
export function humanizeClass(c: string): string | undefined {
  if (!c.startsWith("vt-") || c.startsWith("vt-material") || /^vt-(enter|hover)-/.test(c)) return undefined;
  const parts = c.slice(3).split(/[-_]+/).filter((w) => w.length > 1 && !GENERIC.has(w)).map((w) => EXPAND[w] ?? w);
  if (!parts.length) return undefined;
  const t = parts.join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** A name from the design itself: what it says it is (aria-label), its id, or its first class of its own. */
function designName(p: Record<string, unknown>): string | undefined {
  const attrs = (p.attrs ?? {}) as Record<string, unknown>;
  if (typeof attrs["aria-label"] === "string" && attrs["aria-label"].trim()) return attrs["aria-label"];
  if (typeof attrs.id === "string" && /^[a-z][\w-]*$/i.test(attrs.id)) {
    const fromId = humanizeClass(`vt-${attrs.id}`);
    if (fromId) return fromId;
  }
  for (const c of String(p.className ?? "").split(/\s+/)) {
    const name = humanizeClass(c);
    if (name) return name;
  }
  return undefined;
}

/** Whether a block does something: an interaction (behaviours.ts), a link, or a scroll or hover effect. */
export const hasInteraction = (b: BlockItem) => {
  const p = b.props as Record<string, unknown>;
  return Object.keys(behavioursOf(p.attrs as Record<string, unknown>)).length > 0 || /(^|\s)vt-(enter|hover)-/.test(String(p.className ?? ""));
};

/** A readable name for a block: its own name, or one made from the design and what it shows. */
export function blockName(b: BlockItem, fallback: string, pkg?: TemplatePackage): string {
  const p = b.props as Record<string, unknown>;
  if (typeof p.name === "string" && p.name.trim()) return clip(displayName(p.name, pkg), MAX_NAME);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  switch (b.type) {
    case "DText":
    case "DRich":
    case "Heading":
    case "Text":
      return clip(str(p.text) ?? firstText(b) ?? designName(p) ?? fallback);
    case "DLink": {
      const words = str(p.text) ?? firstText(b) ?? str((p.attrs as Record<string, unknown> | undefined)?.["aria-label"]);
      // A link styled as a button reads as one ("Book a job button").
      const button = (p.attrs as Record<string, unknown> | undefined)?.type !== undefined || p.tag === "button" || /(^|\s)vt-[\w-]*(btn|button|cta|ihb)/.test(String(p.className ?? ""));
      return words ? clip(`${words.replace(/\s+/g, " ").trim()} ${button ? "button" : "link"}`) : button ? "Button" : clip(`Link${str(p.href) ? `: ${p.href}` : ""}`);
    }
    case "ButtonLink":
      return clip(`${str(p.label) ?? "Button"} button`);
    case "DImage":
    case "Image":
      return clip(str(p.alt) ?? designName(p) ?? "Image");
    case "DIcon":
      return `${str(p.name)?.replace(/_/g, " ") ?? ""} icon`.trim();
    case "Box": {
      const own = designName(p);
      const kind = TAG_NAMES[String(p.tag)];
      if (p.decor) return `${own ?? kind ?? "Shape"} (decoration)`;
      if (own) return clip(own);
      if (kind) return kind;
      const t = firstText(b);
      return t ? clip(`Group · ${t}`) : "Group";
    }
    default:
      return clip(str(p.title) ?? str(p.label) ?? str(p.heading) ?? fallback);
  }
}

/** Type icons for the layers panel (lucide shapes). */
const TYPE_ICONS: Record<string, string> = {
  frame: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
  text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  button: '<rect width="20" height="12" x="2" y="6" rx="6"/><path d="M8 12h8"/>',
  icon: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  field: '<rect width="20" height="12" x="2" y="6" rx="2"/><path d="M6 10v4"/>',
  shape: '<circle cx="12" cy="12" r="9"/>',
  nav: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  section: '<rect width="20" height="7" x="2" y="3" rx="1"/><rect width="20" height="7" x="2" y="14" rx="1"/>',
  bolt: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
};

function typeIcon(b: BlockItem): string {
  const p = b.props as Record<string, unknown>;
  switch (b.type) {
    case "DText":
    case "DRich":
    case "Heading":
    case "Text":
      return "text";
    case "DImage":
    case "Image":
      return "image";
    case "DLink":
      return /btn|button|cta|ihb/.test(String(p.className ?? "")) || p.tag === "button" ? "button" : "link";
    case "ButtonLink":
      return "button";
    case "DIcon":
      return "icon";
    case "DField":
      return "field";
    case "DRaw":
      return "shape";
    case "Box":
      return p.decor ? "shape" : p.tag === "nav" || p.tag === "header" ? "nav" : p.tag === "ul" || p.tag === "ol" ? "list" : p.tag === "section" ? "section" : "frame";
    default:
      return "section";
  }
}

const PIECES = new Set<string>(ELEMENT_TYPES);
const ICONS = {
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
};
const svg = (paths: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** The eye (hide) and lock buttons of a layer row, kept in step with the block's flags. */
function flags(li: HTMLElement, nameEl: HTMLElement, item: BlockItem) {
  const row = nameEl.parentElement;
  if (!row) return;
  let box = [...row.children].find((c): c is HTMLElement => c instanceof HTMLElement && c.dataset.layerFlags !== undefined);
  if (!box) {
    box = li.ownerDocument.createElement("span");
    box.dataset.layerFlags = "";
    box.style.cssText = "margin-left:auto;display:inline-flex;gap:2px;padding-left:4px";
    for (const flag of ["hidden", "locked"] as const) {
      const b = li.ownerDocument.createElement("button");
      b.type = "button";
      b.dataset.layerFlag = flag;
      b.style.cssText = "display:grid;place-items:center;width:20px;height:20px;border-radius:4px;border:0;background:transparent;cursor:pointer;color:inherit";
      box.append(b);
    }
    row.append(box);
  }
  const on = { hidden: !!item.props.hidden, locked: !!item.props.locked };
  for (const b of box.querySelectorAll<HTMLButtonElement>("button[data-layer-flag]")) {
    const flag = b.dataset.layerFlag as "hidden" | "locked";
    const state = on[flag] ? "on" : "off";
    if (b.dataset.state === state) continue;
    b.dataset.state = state;
    b.setAttribute("aria-pressed", String(on[flag]));
    b.setAttribute("aria-label", flag === "hidden" ? (on.hidden ? "Show this layer" : "Hide this layer") : on.locked ? "Unlock this layer" : "Lock this layer");
    b.title = b.getAttribute("aria-label")!;
    b.innerHTML = svg(flag === "hidden" ? (on.hidden ? ICONS.eyeOff : ICONS.eye) : on.locked ? ICONS.lock : ICONS.unlock);
    // Set flags always show; the others only while the row is hovered.
    b.style.opacity = on[flag] ? "1" : "";
    b.classList.toggle("veloce-layer-flag-off", !on[flag]);
  }
}

/** A layer row's type icon (instead of Puck's generic one) and a ⚡ badge on parts that do something. */
function decorate(li: HTMLElement, nameEl: HTMLElement, item: BlockItem) {
  const row = nameEl.parentElement;
  const icon = row && [...row.querySelectorAll<HTMLElement>('[class*="Layer-icon"]')].find((n) => n.closest("li") === li);
  const kind = typeIcon(item);
  if (icon && icon.dataset.typeIcon !== kind) {
    icon.dataset.typeIcon = kind;
    icon.innerHTML = svg(TYPE_ICONS[kind]!);
  }
  if (!row) return;
  let badge = [...row.children].find((c): c is HTMLElement => c instanceof HTMLElement && c.dataset.layerBadge !== undefined);
  const on = hasInteraction(item);
  if (on && !badge) {
    badge = li.ownerDocument.createElement("span");
    badge.dataset.layerBadge = "";
    badge.title = "Has an interaction (see Interactions)";
    badge.style.cssText = "display:inline-grid;place-items:center;color:#8b5cf6;margin-left:4px";
    badge.innerHTML = svg(TYPE_ICONS.bolt!);
    nameEl.after(badge);
  } else if (!on && badge) badge.remove();
}

/** Puck's `outline` override: the default outline, with each layer's label replaced by the block's name. */
export function OutlineWithNames({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const getItemById = usePuck((s) => s.getItemById);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const dispatch = usePuck((s) => s.dispatch);
  // Re-label whenever the page changes (names come from the content).
  const content = usePuck((s) => s.appState.data.content);
  const pkg = useContext(TemplateContext)?.pkg;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const label = () => {
      for (const li of root.querySelectorAll<HTMLElement>("li[data-puck-layer-tree-id]")) {
        const nameEl = [...li.querySelectorAll<HTMLElement>('[class*="Layer-name"]')].find((n) => n.closest("li") === li);
        if (!nameEl || nameEl.isContentEditable) continue;
        const item = getItemById(li.dataset.puckLayerTreeId!) as BlockItem | undefined;
        if (!item) continue;
        const name = blockName(item, nameEl.dataset.typeLabel ?? nameEl.textContent ?? item.type, pkg);
        nameEl.dataset.typeLabel ??= nameEl.textContent ?? "";
        if (nameEl.textContent !== name) nameEl.textContent = name;
        nameEl.title = `${name} (double-click to rename)`;
        if (PIECES.has(item.type)) flags(li, nameEl, item);
        decorate(li, nameEl, item);
      }
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [content, getItemById, pkg]);

  // The eye and lock buttons: toggle the flag, without selecting the row.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-layer-flag]");
      const li = b?.closest<HTMLElement>("li[data-puck-layer-tree-id]");
      if (!b || !li) return;
      e.preventDefault();
      e.stopPropagation();
      const id = li.dataset.puckLayerTreeId!;
      const item = getItemById(id) as BlockItem | undefined;
      const where = getSelectorForId(id);
      if (!item || !where) return;
      const flag = b.dataset.layerFlag as "hidden" | "locked";
      dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone, data: { ...item, props: { ...item.props, [flag]: item.props[flag] ? undefined : true } } as never });
    };
    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [getItemById, getSelectorForId, dispatch]);

  // Double-click a layer's name to rename it.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onDbl = (e: MouseEvent) => {
      const nameEl = (e.target as HTMLElement).closest<HTMLElement>('[class*="Layer-name"]');
      const li = nameEl?.closest<HTMLElement>("li[data-puck-layer-tree-id]");
      if (!nameEl || !li) return;
      e.preventDefault();
      e.stopPropagation();
      const id = li.dataset.puckLayerTreeId!;
      nameEl.contentEditable = "plaintext-only";
      nameEl.focus();
      document.getSelection()?.selectAllChildren(nameEl);
      const finish = (save: boolean) => {
        nameEl.removeEventListener("keydown", onKey);
        nameEl.removeEventListener("blur", onBlur);
        nameEl.contentEditable = "false";
        const item = getItemById(id) as BlockItem | undefined;
        const where = getSelectorForId(id);
        const name = (nameEl.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
        if (save && item && where) {
          // An empty name goes back to the one made from the block's contents.
          const props = { ...item.props, name: name || undefined };
          dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone, data: { ...item, props } as never });
        } else if (item) nameEl.textContent = blockName(item, item.type, pkg);
      };
      const onKey = (k: KeyboardEvent) => {
        k.stopPropagation();
        if (k.key === "Enter") {
          k.preventDefault();
          nameEl.blur();
        } else if (k.key === "Escape") {
          k.preventDefault();
          finish(false);
        }
      };
      const onBlur = () => finish(true);
      nameEl.addEventListener("keydown", onKey);
      nameEl.addEventListener("blur", onBlur);
    };
    root.addEventListener("dblclick", onDbl, true);
    return () => root.removeEventListener("dblclick", onDbl, true);
  }, [getItemById, getSelectorForId, dispatch, pkg]);

  return (
    <div ref={ref} className="[&_.veloce-layer-flag-off]:opacity-0 [&_li:hover>*_.veloce-layer-flag-off]:opacity-60 [&_.veloce-layer-flag-off:focus-visible]:opacity-100">
      {children}
    </div>
  );
}
