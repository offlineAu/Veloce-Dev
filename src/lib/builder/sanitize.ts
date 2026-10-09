import DOMPurify from "isomorphic-dompurify";

/** Largest snippet a single Custom HTML block may hold. */
export const MAX_HTML_BYTES = 50_000;

/**
 * Cleans visitor-supplied HTML for the Custom HTML block. Runs in the browser as they type and again on the
 * server before a draft is stored. Keeps layout and <style>, allows embed iframes, drops scripts, event
 * handlers and javascript: URLs. The result is still only ever shown inside a sandboxed iframe.
 */
export function sanitizeHtml(html: string): string {
  const clean = DOMPurify.sanitize(html.slice(0, MAX_HTML_BYTES), {
    FORCE_BODY: true, // keep a leading <style> block instead of dropping it with <head>
    ADD_TAGS: ["style", "iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "target"],
    FORBID_TAGS: ["script", "object", "embed", "base", "meta", "link", "form"],
  });
  return clean;
}
