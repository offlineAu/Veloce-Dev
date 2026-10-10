import DOMPurify from "dompurify";
import { MAX_HTML_BYTES } from "./sanitize-limits";

export { MAX_HTML_BYTES };

/**
 * Browser-side clean-up of visitor HTML for the Custom HTML block, as they type. Keeps layout and <style>, allows
 * embed iframes, drops scripts, event handlers and javascript: URLs. The result is only ever shown inside a
 * sandboxed iframe, and the server cleans it again on submit (server/builder/sanitize-html.ts), so this module never
 * runs on the server: DOMPurify needs a real DOM, and a fake one (jsdom) doesn't load in serverless functions.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html.slice(0, MAX_HTML_BYTES), {
    FORCE_BODY: true, // keep a leading <style> block instead of dropping it with <head>
    ADD_TAGS: ["style", "iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "target"],
    FORBID_TAGS: ["script", "object", "embed", "base", "meta", "link", "form"],
  });
}
