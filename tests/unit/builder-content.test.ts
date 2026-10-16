import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("server-only", () => ({}));
import type { BlockItem } from "@/lib/builder/blocks";
import { pageLinkTarget, type SiteDoc } from "@/lib/builder/site-doc";
import { docFromTemplate } from "@/lib/builder/template-doc";
import { siteDraftSchema } from "@/schemas/site-draft";
import { bindBlocks, blogCollection, listItems, normalizeCollections, normalizeMenus, normalizeSeo, splitItemPath, syncContentBlocks, syncList, syncMenu, type Collection } from "@/lib/builder/content";

const blog = (): Collection => ({
  id: "blog",
  name: "Blog",
  itemName: "post",
  fields: [
    { key: "title", label: "Title", type: "text" },
    { key: "image", label: "Image", type: "image" },
    { key: "date", label: "Date", type: "date" },
  ],
  items: [
    { id: "i-a", slug: "first", values: { title: "First", image: "https://img.test/a.webp", date: "2026-01-02" } },
    { id: "i-b", slug: "second", values: { title: "Second", image: "https://img.test/b.webp", date: "2026-03-04" } },
    { id: "i-c", slug: "third", values: { title: "Third", date: "2026-02-03" } },
  ],
});
const card: BlockItem = {
  type: "Box",
  props: { id: "Box-card", tag: "article", className: "vt:p-4", items: [
    { type: "DText", props: { id: "DText-t", tag: "h3", className: "", text: "Title here", runs: [], bind: { content: "title" } } },
    { type: "DImage", props: { id: "DImage-i", className: "", src: "", alt: "", bind: { src: "image" } } },
    { type: "DLink", props: { id: "DLink-l", tag: "a", className: "", href: "#", textOnly: true, text: "Read more", items: [], bind: { href: "@page" } } },
    { type: "DText", props: { id: "DText-d", tag: "p", className: "", text: "date", runs: [], bind: { content: "date" } } },
  ] },
};
const list = (props: Record<string, unknown> = {}): BlockItem => ({ type: "Box", props: { id: "Box-list", tag: "div", className: "vt:grid", list: { collection: "blog", sort: "newest", ...props }, items: [card] } });
const kids = (b: BlockItem) => b.props.items as BlockItem[];

describe("content model", () => {
  it("keeps valid collections and drops unsafe values", () => {
    const [c] = normalizeCollections([{ id: "blog", name: "Blog", fields: [{ key: "title", type: "text" }, { key: "image", type: "image" }, { key: "bad key", type: "text" }, { key: "x", type: "script" }], items: [
      { id: "i-1", slug: "one", values: { title: "One", image: "javascript:alert(1)" } },
      { id: "i-2", slug: "One Two", values: {} },
      { id: "i-1", slug: "dup", values: {} },
    ] }])!;
    expect(c!.fields.map((f) => f.key)).toEqual(["title", "image"]);
    expect(c!.items).toEqual([{ id: "i-1", slug: "one", values: { title: "One" } }]);
    expect(normalizeMenus({ main: [{ id: "m-1", label: "Home", href: "page:p-1" }, { id: "m-2", label: "X", href: "javascript:x" }] })).toEqual({ main: [{ id: "m-1", label: "Home", href: "page:p-1" }] });
    expect(normalizeSeo({ title: "  Hello ", description: "", image: "data:x" })).toEqual({ title: "Hello" });
    expect(blogCollection(["blog"]).id).toBe("blog-2");
  });

  it("orders and limits a list's items", () => {
    expect(listItems(blog(), { sort: "newest" }).map((i) => i.slug)).toEqual(["second", "third", "first"]);
    expect(listItems(blog(), { sort: "title", limit: 2 }).map((i) => i.slug)).toEqual(["first", "second"]);
  });

  it("fills bound props from an item, with dates shown and the item's page linked", () => {
    const [b] = bindBlocks([card], blog(), blog().items[0]!, "p-post");
    expect(kids(b!)[0]!.props).toMatchObject({ text: "First", runs: [] });
    expect(kids(b!)[1]!.props.src).toBe("https://img.test/a.webp");
    expect(kids(b!)[2]!.props.href).toBe("page:p-post/first");
    expect(kids(b!)[3]!.props.text).toBe("Jan 2, 2026");
  });

  it("writes a list out: the design first (filled with the first item), then one copy per item", () => {
    const synced = syncList(list({ limit: 2 }), [blog()], () => "p-post")!;
    const cards = kids(synced);
    expect(cards.map((c) => kids(c)[0]!.props.text)).toEqual(["Second", "Third"]);
    expect(cards[0]!.props.id).toBe("Box-card");
    expect(cards[1]!.props).toMatchObject({ listCopy: true, listItem: "i-c", id: "Box-card~i-c" });
    // Every id is unique, and a second sync changes nothing.
    const ids = JSON.stringify(synced).match(/"id":"[^"]+"/g)!;
    expect(new Set(ids).size).toBe(ids.length);
    expect(syncList(synced, [blog()], () => "p-post")).toBeNull();
  });

  it("writes a menu out on the design of its first link", () => {
    const nav: BlockItem = { type: "Box", props: { id: "Box-nav", tag: "nav", className: "", menu: "main", items: [
      { type: "DLink", props: { id: "DLink-1", tag: "a", className: "vt:text-sm", href: "#", textOnly: true, text: "Old", items: [] } },
    ] } };
    const menus = { main: [{ id: "m-1", label: "Home", href: "page:p-1" }, { id: "m-2", label: "Blog", href: "page:p-2" }] };
    const synced = syncMenu(nav, menus)!;
    expect(kids(synced).map((l) => [l.props.text, l.props.href, l.props.className])).toEqual([["Home", "page:p-1", "vt:text-sm"], ["Blog", "page:p-2", "vt:text-sm"]]);
    expect(syncMenu(synced, menus)).toBeNull();
    expect(syncContentBlocks([nav, list()], [blog()], menus, () => undefined)).not.toBeNull();
  });

  it("splits an item page's address", () => {
    expect(splitItemPath("/blog/first-post")).toEqual({ page: "/blog", slug: "first-post" });
    expect(splitItemPath("/")).toEqual({ page: "/" });
  });
});

describe("links to item pages", () => {
  it("reads page and item from a page link", () => {
    expect(pageLinkTarget("page:p-1")).toEqual({ pageId: "p-1", itemSlug: undefined });
    expect(pageLinkTarget("page:p-1/first-post")).toEqual({ pageId: "p-1", itemSlug: "first-post" });
    expect(pageLinkTarget("page:p-1/../x")).toBeNull();
    expect(pageLinkTarget("https://x.test")).toBeNull();
  });
});

describe("submitted designs with collections", () => {
  const pkg = JSON.parse(readFileSync("public/builder-templates/noir-needle/v1/template.json", "utf8"));
  const site = (): SiteDoc => {
    const doc = docFromTemplate(pkg, "pieces");
    const [home] = doc.pages;
    const post = { id: "p-post", path: "/post", title: "Post", data: { root: { props: { ...home!.data.root.props, itemsOf: "blog", seo: { title: "A post" } } }, content: [] } };
    const synced = syncList(list(), [blog()], () => "p-post")!;
    home!.data.content = [...home!.data.content, synced];
    return { ...doc, collections: [blog()], menus: { main: [{ id: "m-1", label: "Home", href: `page:${home!.id}` }] }, pages: [...doc.pages, post] };
  };
  const check = async (doc: SiteDoc) => {
    const r = await siteDraftSchema.safeParseAsync({ templateId: "noir-needle", data: doc });
    return r.success ? "ok" : r.error.issues[0]!.message;
  };
  const withPiece = (doc: SiteDoc, props: Record<string, unknown>): SiteDoc => {
    const home = doc.pages[0]!;
    const piece: BlockItem = { type: "DLink", props: { id: "DLink-x", tag: "a", className: "", href: "#", textOnly: true, text: "x", items: [], ...props } };
    return { ...doc, pages: [{ ...home, data: { ...home.data, content: [...home.data.content, piece] } }, ...doc.pages.slice(1)] };
  };

  it("accepts collections, lists, menus, item pages and links to items", async () => {
    const doc = site();
    expect(await check(doc)).toBe("ok");
    const r = await siteDraftSchema.parseAsync({ templateId: "noir-needle", data: doc });
    expect(r.data.collections?.[0]?.items).toHaveLength(3);
    expect(r.data.pages.at(-1)!.data.root.props).toMatchObject({ itemsOf: "blog", seo: { title: "A post" } });
    expect(await check(withPiece(doc, { href: "page:p-post/first", bind: { href: "@page" } }))).toBe("ok");
  });

  it("rejects bad bindings, list settings and links to missing pages", async () => {
    const doc = site();
    expect(await check(withPiece(doc, { bind: { onclick: "title" } }))).not.toBe("ok");
    expect(await check(withPiece(doc, { bind: { content: "Bad Key" } }))).not.toBe("ok");
    expect(await check(withPiece(doc, { list: { collection: "blog", limit: 9999 } }))).not.toBe("ok");
    expect(await check(withPiece(doc, { menu: "sidebar" }))).not.toBe("ok");
    expect(await check(withPiece(doc, { href: "page:nope/first" }))).not.toBe("ok");
  });
});
