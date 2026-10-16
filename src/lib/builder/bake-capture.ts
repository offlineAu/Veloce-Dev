/*
 * The capture that "bakes" a template page: the page runs once, with its own script, and what it finished as is what
 * gets imported (product cards, charts, lists its script built from data). Shared by the developer panel's upload,
 * which runs it in a sandboxed iframe (components/dev/bake.ts), and the CLI importer, which runs it in a headless
 * browser (scripts/import-template.ts --bake).
 *
 * It runs first inside the page: in-memory stand-ins for storage and cookies (so scripts that use them don't stop),
 * a record of the inline styles the script changes, then, after load:
 *   - optional steps to get the page to the state to capture (`before`, an async function body that can `await
 *     wait(ms)`: sign in to a demo, open a view)
 *   - a scroll through the page, so content that appears on scroll gets built too
 *   - motion and position the script set inline on the page's own elements are put back as they were (a stacked
 *     card's transform, a column's measured offset), so what's captured is the design, not one moment of its
 *     animation; sizes and variables it set from data (a bar's width) keep their final value
 *   - its own capture script is removed; the page's scripts stay, for the importer to read what they did
 * and the page is posted to `parent` as `{ type: "veloce-bake", token, html }`.
 */

export const BAKE_MESSAGE = "veloce-bake";

/** The capture script's source. */
export const captureScript = (token: string, before = "") => `(() => {
  const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null), setItem: (k, v) => m.set(String(k), String(v)), removeItem: (k) => m.delete(String(k)), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
  for (const name of ["localStorage", "sessionStorage"]) { try { window[name].getItem("x"); } catch { try { Object.defineProperty(window, name, { value: memory(), configurable: true }); } catch {} } }
  try { let jar = ""; Object.defineProperty(document, "cookie", { get: () => jar, set: (v) => { jar = String(v).split(";")[0]; }, configurable: true }); } catch {}
  const before = new Map();
  const watch = new MutationObserver((records) => { for (const r of records) if (r.type === "attributes" && !before.has(r.target)) before.set(r.target, r.oldValue); });
  watch.observe(document, { subtree: true, attributes: true, attributeFilter: ["style"], attributeOldValue: true });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const capture = async () => {
    await wait(900);
    try { await (async () => { ${before} })(); } catch (e) { console.error("bake steps failed", e); }
    const step = Math.max(200, innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await wait(120); }
    scrollTo(0, 0);
    // Long enough for what started on the way down (a count-up, a bar filling) to finish.
    await wait(2000);
    watch.disconnect();
    // Only motion and position go back (a card mid-transform, a measured offset); sizes and variables the script
    // set from data (a progress bar's width, a chart's --p) are the design, so they keep their final value.
    const MOTION = /^(transform|translate|rotate|scale|top|right|bottom|left|inset|transition.*|animation.*|will-change)$/;
    const decls = (s) => { const d = document.createElement("div"); d.setAttribute("style", s || ""); return d.style; };
    for (const [el, old] of before) {
      if (!el.isConnected) continue;
      const was = decls(old), now = el.style;
      for (const p of [...now]) if (MOTION.test(p)) now.setProperty(p, was.getPropertyValue(p), was.getPropertyPriority(p));
      for (const p of [...was]) if (MOTION.test(p) && !now.getPropertyValue(p)) now.setProperty(p, was.getPropertyValue(p), was.getPropertyPriority(p));
      if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
    }
    document.getElementById("veloce-capture")?.remove();
    parent.postMessage({ type: ${JSON.stringify(BAKE_MESSAGE)}, token: ${JSON.stringify(token)}, html: "<!DOCTYPE html>\\n" + document.documentElement.outerHTML }, "*");
  };
  if (document.readyState === "complete") capture(); else addEventListener("load", capture);
})();`;

/** The page with the capture script first in it, so the storage stand-ins are there before its own scripts run. */
export function withCapture(html: string, token: string, before?: string): string {
  const script = `<script id="veloce-capture">${captureScript(token, before)}</script>`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${script}`) : `${script}${html}`;
}
