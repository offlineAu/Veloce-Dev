"use client";

import { useEffect, useRef } from "react";
import {
  CLONE_ATTR, STATE_ATTR, behaviourAttr, columnsOf, countParts, easeOut, formatCount, marqueeLayout, marqueeStart, parseBehaviour,
  stackOffset, visibleRange, type BehaviourName, type StateToken,
} from "@/lib/builder/behaviours";

/*
 * The interactions runtime (lib/builder/behaviours.ts has the attributes and their rules). Mounted once per page, inside
 * the design's root: in the editor (where the page is drawn inside Puck's iframe), in the editor's preview and on the
 * team's preview of a sent design. It finds elements with `data-vt-*` behaviours, keeps them working as the page
 * changes, and only ever writes `data-vt-state`, ARIA states, `--vt-*` properties, text it formats itself, and cleaned
 * copies of a marquee's first child. It never runs a design's own code, uses innerHTML or touches the network.
 *
 * While editing, motion plays but clicks belong to the editor (selecting), so click behaviours wait for Preview.
 */

type Stop = () => void;
type Win = Window & typeof globalThis;
type Ctx = { root: HTMLElement; doc: Document; win: Win; editing: boolean; motion: boolean; watch: (el: Element, amount: number, fn: () => void) => Stop };

const tokens = (el: Element) => (el.getAttribute(STATE_ATTR) ?? "").split(/\s+/).filter(Boolean);
export const hasState = (el: Element, t: StateToken) => tokens(el).includes(t);
export function setState(el: Element, t: StateToken, on: boolean) {
  const list = tokens(el).filter((x) => x !== t);
  if (on) list.push(t);
  if (list.length) el.setAttribute(STATE_ATTR, list.join(" "));
  else el.removeAttribute(STATE_ATTR);
}
const kids = (el: Element) => [...el.children].filter((c) => !c.hasAttribute(CLONE_ATTR) && c.tagName !== "TEMPLATE");
/** The text nodes inside an element, in order. */
function textNodes(ctx: Ctx, el: Element): Text[] {
  const out: Text[] = [];
  const walker = ctx.doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}
const byId = (ctx: Ctx, id: string | null | undefined) => (id ? (ctx.root.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null) : null);

/* ------------------------------------------------------------------------------------------------------------------
 * Behaviours. Each takes its element and normalised value and returns how to stop.
 * ---------------------------------------------------------------------------------------------------------------- */

const BEHAVIOURS: Partial<Record<BehaviourName, (el: HTMLElement, value: string, ctx: Ctx) => Stop | void>> = {
  reveal(el, value, ctx) {
    const parts = value.split(" ").filter(Boolean);
    const delay = parts.find((p) => /^\d+$/.test(p));
    const stagger = Number(/stagger:(\d+)/.exec(value)?.[1] ?? 0);
    if (delay && !el.style.getPropertyValue("--vt-d")) el.style.setProperty("--vt-d", delay);
    if (stagger) {
      const children = kids(el) as HTMLElement[];
      const cols = value.includes("from:center") ? columnsOf(children.map((c) => c.offsetLeft)) : children.map((_, i) => i);
      const mid = value.includes("from:center") ? Math.max(...cols, 0) / 2 : 0;
      children.forEach((c, i) => c.style.setProperty("--vt-d", String(Math.round(Math.abs(cols[i]! - mid) * stagger + (value.includes("from:center") ? (i % 3) * 20 : 0)))));
    }
    if (!ctx.motion) return setState(el, "in", true);
    return ctx.watch(el, 0.15, () => setState(el, "in", true));
  },

  split(el, _v, ctx) {
    if (!ctx.motion) return setState(el, "in", true);
    return ctx.watch(el, 0.3, () => setState(el, "in", true));
  },

  flip(el, _v, ctx) {
    if (!ctx.motion) return;
    return ctx.watch(el, 0.6, () => setState(el, "in", true));
  },

  count(el, _v, ctx) {
    // Every number in the element's own text ("from $1,600", "4.9 from 327 reviews") counts up together.
    const walker = ctx.doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const found: { node: Text; text: string; parts: NonNullable<ReturnType<typeof countParts>> }[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue ?? "";
      const parts = /\d/.test(text) ? countParts(text) : null;
      if (parts && parts.value > 0) found.push({ node: n as Text, text, parts });
    }
    if (!found.length || !ctx.motion || el.isContentEditable) return;
    let raf = 0;
    const restore = () => found.forEach((f) => f.node.isConnected && (f.node.nodeValue = f.text));
    const show = (t: number) => found.forEach((f) => (f.node.nodeValue = formatCount(f.parts, f.parts.value * easeOut(t))));
    show(0);
    const stop = ctx.watch(el, 0.6, () => {
      const start = ctx.win.performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1400);
        if (t < 1) {
          show(t);
          raf = ctx.win.requestAnimationFrame(tick);
        } else restore();
      };
      raf = ctx.win.requestAnimationFrame(tick);
    });
    return () => {
      stop();
      ctx.win.cancelAnimationFrame(raf);
      restore();
    };
  },

  marquee(el, value, ctx) {
    const [axis, , speed] = value.split(" ");
    const y = axis === "y";
    let frame = 0;
    const clear = () => el.querySelectorAll(`:scope > [${CLONE_ATTR}]`).forEach((c) => c.remove());
    const build = () => {
      frame = 0;
      clear();
      const set = kids(el)[0] as HTMLElement | undefined;
      const box = el.parentElement;
      if (!set || !box || !ctx.motion) {
        el.style.removeProperty("--vt-shift");
        return;
      }
      const style = ctx.win.getComputedStyle(el);
      const gap = Number.parseFloat(y ? style.rowGap : style.columnGap) || 0;
      const size = y ? set.offsetHeight : set.offsetWidth;
      if (!size) return;
      const { shift, copies, seconds } = marqueeLayout(size, gap, y ? box.clientHeight : box.clientWidth, Number(speed));
      for (let i = 0; i < copies; i++) {
        const copy = set.cloneNode(true) as HTMLElement;
        // A copy is decoration: no ids, nothing the editor would treat as a block, nothing to tab to. It shows the
        // original as it ends up: whatever reveals as it scrolls in (a tile, a heading) is shown already, since
        // interactions don't run inside copies (and a copied reveal would otherwise stay invisible).
        for (const node of [copy, ...copy.querySelectorAll("*")]) {
          let shown = false;
          for (const a of [...node.attributes]) {
            if (a.name === "id" || a.name.startsWith("data-puck") || a.name === "draggable") node.removeAttribute(a.name);
            else if (/^data-vt-(reveal|split|flip|seq|count|transient)$/.test(a.name)) {
              if (a.name !== "data-vt-transient") shown = true;
              node.removeAttribute(a.name);
            }
          }
          if (shown) setState(node, "in", true);
          // Marked throughout, so the editor's rule hiding anything in a block that isn't a block skips copies too.
          node.setAttribute(CLONE_ATTR, "");
        }
        copy.setAttribute(CLONE_ATTR, "");
        copy.setAttribute("aria-hidden", "true");
        copy.setAttribute("inert", "");
        el.appendChild(copy);
      }
      el.style.setProperty("--vt-shift", `${shift}px`);
      el.style.setProperty("--vt-dur", `${seconds.toFixed(2)}s`);
      // Already mid-stream: this one's place among marquees side by side picks how far into its loop it starts.
      const siblings = el.parentElement ? kids(el.parentElement).filter((s) => s.hasAttribute(behaviourAttr("marquee"))) : [el];
      el.style.setProperty("--vt-start", `${(-marqueeStart(Math.max(0, siblings.indexOf(el))) * seconds).toFixed(2)}s`);
    };
    const later = () => {
      if (!frame) frame = ctx.win.requestAnimationFrame(build);
    };
    build();
    const ro = new ctx.win.ResizeObserver(() => {
      const set = kids(el)[0];
      // Only when the original changed size (copies are the same size).
      if (set) later();
    });
    if (el.parentElement) ro.observe(el.parentElement);
    const first = kids(el)[0];
    if (first) ro.observe(first);
    void ctx.doc.fonts?.ready.then(later);
    return () => {
      ro.disconnect();
      ctx.win.cancelAnimationFrame(frame);
      clear();
      el.style.removeProperty("--vt-shift");
      el.style.removeProperty("--vt-dur");
      el.style.removeProperty("--vt-start");
    };
  },

  toggle(el, value, ctx) {
    const [id, ...opts] = value.split(" ");
    const state = opts.includes("on") ? "on" : "open";
    if (!el.hasAttribute("aria-expanded")) el.setAttribute("aria-expanded", "false");
    if (ctx.editing) return;
    const set = (open: boolean) => {
      const target = byId(ctx, id);
      if (!target) return;
      setState(target, state, open);
      el.setAttribute("aria-expanded", String(open));
    };
    const onClick = (e: Event) => {
      e.preventDefault();
      const target = byId(ctx, id);
      if (target) set(!hasState(target, state));
    };
    const onLink = (e: Event) => {
      const target = byId(ctx, id);
      if (opts.includes("close-links") && target && (e.target as Element).closest("a") && target.contains(e.target as Node)) set(false);
    };
    el.addEventListener("click", onClick);
    ctx.root.addEventListener("click", onLink);
    return () => {
      el.removeEventListener("click", onClick);
      ctx.root.removeEventListener("click", onLink);
    };
  },

  accordion(el, value, ctx) {
    const triggerOf = (item: Element) => item.querySelector("button");
    for (const item of kids(el)) triggerOf(item)?.setAttribute("aria-expanded", String(hasState(item, "open")));
    if (ctx.editing) return;
    const onClick = (e: Event) => {
      const button = (e.target as Element).closest("button");
      const item = kids(el).find((i) => triggerOf(i) === button);
      if (!button || !item) return;
      const open = !hasState(item, "open");
      if (value === "single") for (const other of kids(el)) if (other !== item && hasState(other, "open")) {
        setState(other, "open", false);
        triggerOf(other)?.setAttribute("aria-expanded", "false");
        syncAlt(other);
      }
      setState(item, "open", open);
      button.setAttribute("aria-expanded", String(open));
      syncAlt(item);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  },

  tabs(el, value, ctx) {
    const [panelsId, ...opts] = value.split(" ");
    const triggers = () => kids(el);
    const control = (t: Element) => (t.matches("button,a") ? t : (t.querySelector("button,a") ?? t));
    const caption = { node: null as Text | null, title: null as Element | null, before: "", beforeTitle: "" };
    const activate = (i: number) => {
      triggers().forEach((t, j) => control(t).setAttribute("aria-current", String(i === j)));
      const panels = byId(ctx, panelsId);
      if (!panels) return;
      kids(panels).filter((p) => p.tagName !== "FIGCAPTION").forEach((p, j) => setState(p, "on", i === j));
      // A caption over the panels ("<b>Title</b> where, when") follows the item: its words, minus a leading number.
      const cap = panels.querySelector(":scope > figcaption");
      const texts = textsOf(triggers()[i]).filter((s) => !/^\d+$/.test(s));
      const title = cap?.firstElementChild;
      const rest = cap ? [...cap.childNodes].find((n): n is Text => n.nodeType === 3 && !!n.nodeValue?.trim()) : undefined;
      if (cap && title && rest && texts.length >= 2) {
        if (!caption.node) Object.assign(caption, { node: rest, title, before: rest.nodeValue ?? "", beforeTitle: title.textContent ?? "" });
        title.textContent = texts[0]!;
        rest.nodeValue = texts.slice(1).join(", ");
      }
    };
    activate(0);
    const pick = (e: Event) => {
      const i = triggers().findIndex((t) => t.contains(e.target as Node));
      if (i >= 0) activate(i);
    };
    const events = [...(opts.includes("hover") ? ["pointerover"] : []), "focusin", ...(ctx.editing ? [] : ["click"])];
    events.forEach((ev) => el.addEventListener(ev, pick));
    return () => {
      events.forEach((ev) => el.removeEventListener(ev, pick));
      if (caption.node?.isConnected) caption.node.nodeValue = caption.before;
      if (caption.title?.isConnected) caption.title.textContent = caption.beforeTitle;
    };
  },

  stack(el, value, ctx) {
    const turn = [0, -3, 2.5, -1.5, 3];
    let top = 0;
    const status = byId(ctx, /status:([\w-]+)/.exec(value)?.[1]);
    const statusText = status ? [...status.childNodes].find((n): n is Text => n.nodeType === 3) : undefined;
    const before = statusText?.nodeValue ?? "";
    const layout = () => {
      const cards = kids(el) as HTMLElement[];
      cards.forEach((c, i) => {
        const k = stackOffset(i, top, cards.length);
        c.style.setProperty("--vt-k", String(k));
        c.style.setProperty("--vt-r", `${k ? turn[i % turn.length] : 0}deg`);
        c.setAttribute("aria-hidden", String(k !== 0));
      });
      setState(el, "on", true);
      if (statusText) statusText.nodeValue = `${top + 1} of ${cards.length}`;
    };
    const move = (by: number) => {
      const n = kids(el).length;
      if (!n) return;
      top = (((top + by) % n) + n) % n;
      layout();
    };
    stackMoves.set(el, move);
    layout();
    let startX: number | null = null;
    const down = (e: PointerEvent) => (startX = e.clientX);
    const up = (e: PointerEvent) => {
      if (startX !== null && Math.abs(e.clientX - startX) > 40 && !ctx.editing) move(e.clientX < startX ? 1 : -1);
      startX = null;
    };
    if (value.includes("swipe")) {
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
    }
    return () => {
      stackMoves.delete(el);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      setState(el, "on", false);
      if (statusText?.isConnected) statusText.nodeValue = before;
    };
  },

  carousel(el, value, ctx) {
    const opt = (k: string) => new RegExp(`(?:^|\\s)${k}:([\\w,-]+)`).exec(value)?.[1];
    const linked = (opt("linked") ?? "").split(",").filter(Boolean);
    const auto = ctx.motion && !ctx.editing ? Number(opt("auto") ?? 0) : 0;
    const dots = () => byId(ctx, opt("dots"));
    const status = byId(ctx, opt("status"));
    const numbers = status ? textNodes(ctx, status).filter((t) => /\d/.test(t.nodeValue ?? "")) : [];
    const before = numbers.map((t) => t.nodeValue ?? "");
    const area = (el.closest("section") ?? el.parentElement ?? el) as HTMLElement;
    let active = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = 0;
    let left = auto;
    let paused = false;
    const layout = () => {
      const slides = kids(el) as HTMLElement[];
      const n = slides.length;
      if (!n) return;
      slides.forEach((s, k) => {
        const d = (k - active + n) % n;
        const back = n > 2 && d === n - 1;
        s.style.setProperty("--vt-pos", String(back ? -1 : d));
        setState(s, "on", d === 0);
        setState(s, "dim", back);
        s.setAttribute("aria-hidden", String(d !== 0));
      });
      for (const id of linked) kids(byId(ctx, id) ?? el.ownerDocument.createElement("i")).forEach((c, k) => (setState(c, "on", k === active), c.setAttribute("aria-hidden", String(k !== active))));
      const d = dots();
      if (d) {
        const all = kids(d) as HTMLElement[];
        all.forEach((b, k) => {
          setState(b, "on", false);
          setState(b, "hit", k < active);
          (b.matches("button,a") ? b : (b.querySelector("button,a") ?? b)).setAttribute("aria-current", String(k === active));
        });
        // Off, then on again after a reflow, so a progress fill on the current dot starts over.
        void all[active]?.offsetWidth;
        if (all[active]) setState(all[active]!, "on", true);
      }
      let i = 0;
      for (const t of numbers) t.nodeValue = (t.nodeValue ?? "").replace(/\d+/g, (m) => String(i++ === 0 ? active + 1 : n).padStart(m.length, "0"));
    };
    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (!auto || paused) return;
      started = ctx.win.performance.now();
      left = ms;
      timer = setTimeout(() => go(active + 1), ms);
    };
    const go = (i: number) => {
      const n = kids(el).length;
      if (!n) return;
      active = ((i % n) + n) % n;
      layout();
      schedule(auto);
    };
    const move = (by: number) => go(active + by);
    stackMoves.set(el, move);
    layout();
    if (ctx.editing) return () => stackMoves.delete(el);
    const pause = (on: boolean) => {
      if (!auto || on === paused) return;
      paused = on;
      const d = dots();
      if (d) setState(d, "dim", on);
      if (on) {
        clearTimeout(timer);
        left = Math.max(0, left - (ctx.win.performance.now() - started));
      } else schedule(left);
    };
    const onSlide = (e: Event) => {
      const i = kids(el).findIndex((s) => s.contains(e.target as Node));
      if (i >= 0 && i !== active) {
        e.preventDefault();
        go(i);
      }
    };
    const onDot = (e: Event) => {
      const d = dots();
      const i = d ? kids(d).findIndex((s) => s.contains(e.target as Node)) : -1;
      if (i >= 0) go(i);
    };
    let startX: number | null = null;
    const down = (e: PointerEvent) => (startX = e.clientX);
    const up = (e: PointerEvent) => {
      if (startX !== null && Math.abs(e.clientX - startX) > 40) move(e.clientX < startX ? 1 : -1);
      startX = null;
    };
    const key = (e: KeyboardEvent) => {
      if (!area.contains(ctx.doc.activeElement)) return;
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    const enter = () => pause(true);
    const leave = () => pause(false);
    const hidden = () => pause(ctx.doc.hidden);
    el.addEventListener("click", onSlide);
    ctx.root.addEventListener("click", onDot);
    if (value.includes("swipe")) {
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
    }
    ctx.doc.addEventListener("keydown", key);
    area.addEventListener("pointerenter", enter);
    area.addEventListener("pointerleave", leave);
    area.addEventListener("focusin", enter);
    area.addEventListener("focusout", leave);
    ctx.doc.addEventListener("visibilitychange", hidden);
    schedule(auto);
    return () => {
      clearTimeout(timer);
      stackMoves.delete(el);
      el.removeEventListener("click", onSlide);
      ctx.root.removeEventListener("click", onDot);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      ctx.doc.removeEventListener("keydown", key);
      area.removeEventListener("pointerenter", enter);
      area.removeEventListener("pointerleave", leave);
      area.removeEventListener("focusin", enter);
      area.removeEventListener("focusout", leave);
      ctx.doc.removeEventListener("visibilitychange", hidden);
      numbers.forEach((t, k) => t.isConnected && (t.nodeValue = before[k]!));
    };
  },

  step(el, value, ctx) {
    if (ctx.editing) return;
    const onClick = () => {
      const target = byId(ctx, el.getAttribute("aria-controls"));
      if (target) stackMoves.get(target)?.(value === "prev" ? -1 : 1);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  },

  spy(el, _v, ctx) {
    const links = [...el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    let active: HTMLElement | null = null;
    const update = () => {
      const { top, bottom } = range(ctx);
      const line = top + (bottom - top) * 0.45;
      let best: HTMLAnchorElement | null = null;
      for (const a of links) {
        const target = byId(ctx, a.getAttribute("href")!.slice(1));
        if (target && target.getBoundingClientRect().top <= line && target.getBoundingClientRect().bottom > top) best = a;
      }
      links.forEach((a) => setState(a, "on", a === best));
      active = best;
      if (best) {
        el.style.setProperty("--vt-ax", `${best.offsetLeft + best.offsetWidth / 2}px`);
        el.style.setProperty("--vt-ao", "1");
      } else el.style.setProperty("--vt-ao", "0");
      spyActive.set(el, active);
    };
    update();
    return onScroll(ctx, update);
  },

  spotlight(el, _v) {
    const move = (e: PointerEvent) => {
      el.style.setProperty("--vt-sx", `${e.clientX - el.getBoundingClientRect().left}px`);
      el.style.setProperty("--vt-so", "1");
    };
    const leave = () => {
      const active = spyActive.get(el);
      if (active) el.style.setProperty("--vt-sx", `${active.offsetLeft + active.offsetWidth / 2}px`);
      else el.style.setProperty("--vt-so", "0");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  },

  pointer(el) {
    const move = (e: PointerEvent) => {
      const child = kids(el).find((c) => c.contains(e.target as Node)) as HTMLElement | undefined;
      if (!child) return;
      const r = child.getBoundingClientRect();
      child.style.setProperty("--vt-x", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      child.style.setProperty("--vt-y", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  },

  seq(el, value, ctx) {
    const [start, step] = value.split(" ").map(Number) as [number, number];
    const parts = kids(el);
    if (!ctx.motion) {
      parts.forEach((p) => !p.hasAttribute(behaviourAttr("transient")) && setState(p, "in", true));
      return;
    }
    // Sequences side by side start a little after one another.
    const siblings = el.parentElement ? kids(el.parentElement).filter((s) => s.hasAttribute(behaviourAttr("seq"))) : [el];
    const offset = Math.max(0, siblings.indexOf(el)) * Math.round(step * 0.55);
    const timers: number[] = [];
    const stop = ctx.watch(el, 0.3, () => {
      let t = start + offset;
      let shown: Element | null = null;
      for (const p of parts) {
        const transient = p.hasAttribute(behaviourAttr("transient"));
        const prev = shown;
        timers.push(ctx.win.setTimeout(() => {
          if (prev?.hasAttribute(behaviourAttr("transient"))) setState(prev, "in", false);
          setState(p, "in", true);
        }, t));
        shown = p;
        t += transient ? step * 1.2 : step;
      }
    });
    return () => {
      stop();
      timers.forEach((t) => ctx.win.clearTimeout(t));
    };
  },

  filter(el, value, ctx) {
    if (ctx.editing) return;
    const onInput = () => {
      const list = byId(ctx, value);
      if (!list) return;
      const q = ((el as HTMLInputElement).value ?? "").trim().toLowerCase();
      for (const item of kids(list)) setState(item, "hit", !!q && (item.textContent ?? "").toLowerCase().includes(q));
      setState(list, "dim", !!q);
    };
    el.addEventListener("input", onInput);
    return () => el.removeEventListener("input", onInput);
  },

  form(el, value, ctx) {
    if (ctx.editing) return;
    const form = el as HTMLFormElement;
    // It checks the required fields itself, and marks them for the design to show (the browser's checks would stop
    // the submit before it gets here).
    form.noValidate = true;
    const success = () => byId(ctx, value);
    const wrapperOf = (f: Element) => (f.matches("[type=radio],[type=checkbox]") ? (f.closest("fieldset") ?? f.parentElement) : f.parentElement) ?? f;
    const fields = () => [...form.querySelectorAll<HTMLInputElement>("[required]")];
    const check = () => {
      let first: HTMLInputElement | null = null;
      for (const f of fields()) {
        const ok = f.checkValidity();
        setState(wrapperOf(f), "invalid", !ok);
        if (!ok) first ??= f;
      }
      return first;
    };
    const onSubmit = (e: Event) => {
      e.preventDefault();
      const bad = check();
      if (bad) return bad.focus();
      form.hidden = true;
      const s = success();
      if (s) {
        s.hidden = false;
        s.style.display = "block";
      }
    };
    const onInput = (e: Event) => {
      const wrap = wrapperOf(e.target as Element);
      if (hasState(wrap, "invalid")) check();
    };
    const onAgain = (e: Event) => {
      const s = success();
      if (!s || !(e.target as Element).closest("button") || !s.contains(e.target as Node)) return;
      form.reset();
      form.hidden = false;
      s.style.removeProperty("display");
      fields().forEach((f) => setState(wrapperOf(f), "invalid", false));
    };
    form.addEventListener("submit", onSubmit);
    form.addEventListener("input", onInput);
    ctx.root.addEventListener("click", onAgain);
    return () => {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("input", onInput);
      ctx.root.removeEventListener("click", onAgain);
    };
  },
};

/** Stacks by element, so next/previous buttons can move them. */
const stackMoves = new WeakMap<Element, (by: number) => void>();
/** The link a spied navigation marks, so its spotlight can rest there. */
const spyActive = new WeakMap<Element, HTMLElement | null>();

/** The words of an element, one entry per text run ("01", "Bathroom re-pipe", "Chermside, 4 days"). */
function textsOf(el: Element | undefined): string[] {
  if (!el) return [];
  const out: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue?.trim();
    if (t) out.push(t);
  }
  return out;
}

/** Text that swaps while its item is open ("+" ↔ "−"). */
const altBefore = new WeakMap<Element, string>();
function syncAlt(scope: Element) {
  for (const el of scope.querySelectorAll(`[${behaviourAttr("alt")}]`)) {
    const text = [...el.childNodes].find((n): n is Text => n.nodeType === 3);
    if (!text) continue;
    if (!altBefore.has(el)) altBefore.set(el, text.nodeValue ?? "");
    const open = !!el.closest(`[${STATE_ATTR}~="open"]`);
    text.nodeValue = open ? (parseBehaviour(behaviourAttr("alt"), el.getAttribute(behaviourAttr("alt"))) ?? "") : altBefore.get(el)!;
  }
}

/* ------------------------------------------------------------------------------------------------------------------
 * What's on screen (the editor draws the page in an iframe as tall as the page, and scrolls around it).
 * ---------------------------------------------------------------------------------------------------------------- */

function outer(win: Win): Win | null {
  try {
    return win.frameElement ? (win.parent as Win) : null;
  } catch {
    return null;
  }
}

function range(ctx: Ctx) {
  const parent = outer(ctx.win);
  const frame = parent && ctx.win.frameElement ? ctx.win.frameElement.getBoundingClientRect() : null;
  return visibleRange(frame, ctx.win.innerHeight, parent?.innerHeight ?? ctx.win.innerHeight);
}

function onScroll(ctx: Ctx, fn: () => void): Stop {
  let frame = 0;
  const later = () => {
    if (!frame) frame = ctx.win.requestAnimationFrame(() => ((frame = 0), fn()));
  };
  const targets = [ctx.win, outer(ctx.win)].filter(Boolean) as Win[];
  targets.forEach((t) => {
    t.addEventListener("scroll", later, { capture: true, passive: true });
    t.addEventListener("resize", later);
  });
  return () => {
    ctx.win.cancelAnimationFrame(frame);
    targets.forEach((t) => {
      t.removeEventListener("scroll", later, { capture: true });
      t.removeEventListener("resize", later);
    });
  };
}

/* ------------------------------------------------------------------------------------------------------------------
 * The runtime: scans the page, keeps one controller per element and behaviour, rescans as the page changes.
 * ---------------------------------------------------------------------------------------------------------------- */

const NAMES = Object.keys(BEHAVIOURS) as BehaviourName[];

export function startBehaviours(root: HTMLElement, { editing }: { editing: boolean }): Stop {
  const doc = root.ownerDocument;
  const win = doc.defaultView as Win;
  const motion = !win.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Elements waiting to be scrolled into view.
  const waiting = new Set<{ el: Element; amount: number; fn: () => void }>();
  const check = () => {
    if (!waiting.size) return;
    const { top, bottom } = range(ctx);
    for (const w of [...waiting]) {
      if (!w.el.isConnected) {
        waiting.delete(w);
        continue;
      }
      const r = w.el.getBoundingClientRect();
      const seen = Math.min(r.bottom, bottom) - Math.max(r.top, top);
      if (seen > 0 && seen >= Math.min(r.height, bottom - top) * w.amount) {
        waiting.delete(w);
        w.fn();
      }
    }
  };
  const ctx: Ctx = {
    root, doc, win, editing, motion,
    watch: (el, amount, fn) => {
      const w = { el, amount, fn };
      waiting.add(w);
      return () => waiting.delete(w);
    },
  };

  const live = new Map<Element, Map<BehaviourName, { value: string; stop: Stop }>>();
  const scan = () => {
    if (root.hasAttribute("data-vt-busy")) return;
    for (const [el, byName] of live) {
      for (const [name, c] of byName) {
        const value = el.isConnected ? parseBehaviour(behaviourAttr(name), el.getAttribute(behaviourAttr(name))) : null;
        if (value !== c.value) {
          c.stop();
          byName.delete(name);
        }
      }
      if (!byName.size) live.delete(el);
    }
    for (const name of NAMES) {
      for (const el of root.querySelectorAll<HTMLElement>(`[${behaviourAttr(name)}]`)) {
        if (el.closest(`[${CLONE_ATTR}]`) || live.get(el)?.has(name)) continue;
        const value = parseBehaviour(behaviourAttr(name), el.getAttribute(behaviourAttr(name)));
        if (value === null) continue;
        const stop = BEHAVIOURS[name]!(el, value, ctx) ?? (() => {});
        if (!live.has(el)) live.set(el, new Map());
        live.get(el)!.set(name, { value, stop });
      }
    }
    check();
  };

  // In-page links scroll smoothly (when the design asks for it) and land below a fixed header (scroll-margin).
  const onAnchor = (e: MouseEvent) => {
    const a = (e.target as Element).closest?.('a[href^="#"]');
    if (editing || !a || e.defaultPrevented || !root.contains(a)) return;
    const target = byId(ctx, a.getAttribute("href")!.slice(1));
    if (!target) return;
    e.preventDefault();
    const smooth = motion && win.getComputedStyle(root).getPropertyValue("--vt-smooth").trim() === "1";
    target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  };
  // Forms in a design never send anything.
  const onSubmit = (e: Event) => {
    if (root.contains(e.target as Node)) e.preventDefault();
  };

  root.setAttribute("data-vt-live", "");
  scan();
  check();
  // Motion starts after the first look, so what's already on screen doesn't hide and come back.
  if (motion) root.setAttribute("data-vt-motion", "");

  let timer = 0;
  const observer = new win.MutationObserver((records) => {
    const ours = records.every((r) => r.type === "childList" && [...r.addedNodes, ...r.removedNodes].every((n) => n instanceof win.Element && n.hasAttribute(CLONE_ATTR)));
    if (ours) return;
    win.clearTimeout(timer);
    timer = win.setTimeout(scan, 120);
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: [...NAMES.map(behaviourAttr), "id", "aria-controls", "data-vt-busy"] });
  const stopScroll = onScroll(ctx, check);
  // Images and fonts settle the layout after load; check again now and then for anything that moved into view.
  const poll = win.setInterval(check, 700);
  root.addEventListener("click", onAnchor);
  root.addEventListener("submit", onSubmit, true);

  return () => {
    observer.disconnect();
    stopScroll();
    win.clearTimeout(timer);
    win.clearInterval(poll);
    root.removeEventListener("click", onAnchor);
    root.removeEventListener("submit", onSubmit, true);
    for (const byName of live.values()) for (const c of byName.values()) c.stop();
    live.clear();
    root.removeAttribute("data-vt-live");
    root.removeAttribute("data-vt-motion");
  };
}

/** Mounted inside the design's root ([data-vt]). */
export function Behaviours({ editing }: { editing: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>("[data-vt]");
    return root ? startBehaviours(root, { editing }) : undefined;
  }, [editing]);
  return <span ref={ref} hidden data-vt-runtime="" />;
}
