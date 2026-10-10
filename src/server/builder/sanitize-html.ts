import "server-only";
import sanitize from "sanitize-html";
import { MAX_HTML_BYTES } from "@/lib/builder/sanitize-limits";

/**
 * Server-side clean-up of Custom HTML blocks before a design is stored. Same policy as the editor's (layout and
 * <style> kept, embeds over https allowed; scripts, event handlers and javascript: URLs removed), using a parser that
 * needs no DOM, so it runs in serverless functions.
 */
export function sanitizeHtmlOnServer(html: string): string {
  return sanitize(html.slice(0, MAX_HTML_BYTES), {
    allowedTags: [...sanitize.defaults.allowedTags, "style", "img", "iframe", "video", "source", "picture", "figure", "figcaption", "button", "span", "section", "header", "footer", "nav", "main", "article", "aside", "svg", "path", "circle", "rect", "g", "line", "polyline", "polygon"],
    // <style> is needed for visitors' own CSS; the HTML is only ever shown inside a sandboxed iframe.
    allowVulnerableTags: true,
    allowedAttributes: {
      "*": ["class", "id", "style", "title", "role", "aria-*", "data-*", "width", "height", "align"],
      a: ["href", "target", "rel", "name"],
      img: ["src", "srcset", "sizes", "alt", "loading"],
      iframe: ["src", "allow", "allowfullscreen", "frameborder", "loading"],
      video: ["src", "poster", "controls", "autoplay", "muted", "loop", "playsinline"],
      source: ["src", "srcset", "type", "media"],
      svg: ["viewbox", "viewBox", "fill", "stroke", "xmlns"],
      path: ["d", "fill", "stroke", "stroke-width"],
      circle: ["cx", "cy", "r", "fill", "stroke"],
      rect: ["x", "y", "rx", "ry", "fill", "stroke"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"], iframe: ["https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
  });
}
