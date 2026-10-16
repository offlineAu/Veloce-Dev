import { describe, expect, it } from "vitest";
import type { BlockItem } from "@/lib/builder/blocks";
import { detach, instanceOf, makeComponent, sameDesign, syncContent, syncDoc, syncInstance } from "@/lib/builder/components";
import type { SiteDoc } from "@/lib/builder/site-doc";
import { DEFAULT_THEME } from "@/lib/builder/theme";

const card = (title: string, img = "/a.webp"): BlockItem => ({
  type: "Box",
  props: { id: "Box-1", tag: "div", className: "vt:p-4", items: [
    { type: "DText", props: { id: "DText-1", tag: "h3", className: "vt:text-xl", text: title, runs: [] } },
    { type: "DImage", props: { id: "DImage-1", className: "vt:w-full", src: img, alt: "" } },
  ] },
});
const kids = (b: BlockItem) => b.props.items as BlockItem[];

describe("components", () => {
  const { main, def } = makeComponent(card("Main title"), "c-test1", "Card");

  it("marks the main block and keys every part", () => {
    expect(main.props.component).toEqual({ id: "c-test1", main: true });
    expect(kids(main).every((k) => typeof k.props.ckey === "string")).toBe(true);
    expect(def.name).toBe("Card");
  });

  it("copies follow the main one, with fresh ids and the same keys", () => {
    const copy = instanceOf(main, "c-test1");
    expect(copy.props.component).toEqual({ id: "c-test1" });
    expect(copy.props.id).not.toBe(main.props.id);
    expect(kids(copy).map((k) => k.props.ckey)).toEqual(kids(main).map((k) => k.props.ckey));
    expect(sameDesign(copy, main)).toBe(true);
  });

  it("a change to the main one reaches copies, which keep their own words and pictures", () => {
    const copy = instanceOf(main, "c-test1");
    // The copy changed its title; its picture still follows the main one.
    const edited: BlockItem = { ...copy, props: { ...copy.props, items: [{ ...kids(copy)[0]!, props: { ...kids(copy)[0]!.props, text: "Copy title" } }, kids(copy)[1]!] } };
    // The main one: new padding, a new picture, a new title.
    const next: BlockItem = { ...main, props: { ...main.props, className: "vt:p-8", items: [
      { ...kids(main)[0]!, props: { ...kids(main)[0]!.props, text: "New main title", className: "vt:text-2xl" } },
      { ...kids(main)[1]!, props: { ...kids(main)[1]!.props, src: "/b.webp" } },
    ] } };
    const synced = syncInstance(next, main, edited);
    expect(synced.props.className).toBe("vt:p-8");
    expect(kids(synced)[0]!.props).toMatchObject({ text: "Copy title", className: "vt:text-2xl", id: kids(edited)[0]!.props.id });
    expect(kids(synced)[1]!.props.src).toBe("/b.webp");
    expect(synced.props.component).toEqual({ id: "c-test1" });
  });

  it("parts added to the main one appear in copies; parts removed disappear", () => {
    const copy = instanceOf(main, "c-test1");
    const extra: BlockItem = { type: "DText", props: { id: "DText-9", tag: "p", className: "", text: "New line", runs: [], ckey: "k-new" } };
    const added = { ...main, props: { ...main.props, items: [kids(main)[0]!, extra] } };
    const synced = syncInstance(added, main, copy);
    expect(kids(synced).map((k) => k.type)).toEqual(["DText", "DText"]);
    expect(kids(synced)[1]!.props.text).toBe("New line");
  });

  it("syncs copies across a page and the whole site, leaving the open page to the editor", () => {
    const copy = instanceOf(main, "c-test1");
    const next = { ...main, props: { ...main.props, className: "vt:p-10" } };
    expect(syncContent([copy], "c-test1", main, main)).toBeNull();
    expect(syncContent([copy], "c-test1", next, main)![0]!.props.className).toBe("vt:p-10");

    const doc: SiteDoc = {
      version: 2,
      theme: DEFAULT_THEME,
      components: { "c-test1": def },
      pages: [
        { id: "p-1", path: "/", title: "Home", data: { root: {}, content: [main] } },
        { id: "p-2", path: "/about", title: "About", data: { root: {}, content: [copy] } },
      ],
    };
    const out = syncDoc(doc, "c-test1", next, "p-1");
    expect(out.components!["c-test1"]!.block.props.className).toBe("vt:p-10");
    expect(out.pages[1]!.data.content[0]!.props.className).toBe("vt:p-10");
  });

  it("detaching makes an ordinary block", () => {
    const d = detach(instanceOf(main, "c-test1"));
    expect(d.props.component).toBeUndefined();
    expect(JSON.stringify(d)).not.toContain("ckey");
  });
});
