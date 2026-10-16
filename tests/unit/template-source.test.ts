import { describe, expect, it, vi } from "vitest";
import { prepareTemplateHtml } from "@/server/builder/template-source";
import type { FetchLike } from "@/lib/builder/import/assets";

const remote = vi.fn<FetchLike>(async () => { throw new Error("Unexpected network request"); });
const bytes = Buffer.from("image-bytes");

describe("uploaded template image references", () => {
  it("bundles relative images, inline backgrounds and stylesheet backgrounds using folder paths", async () => {
    const result = prepareTemplateHtml('<style>.hero { background: url("../images/a.png") }</style><main><img src="../images/a.png"><div style="background-image: url(../images/a.png)"></div></main>', "pages/home.html", new Map([["images/a.png", bytes]]), remote);
    expect(result.html).not.toContain("../images/a.png");
    const urls = result.html.match(/https:\/\/template-assets.invalid\/\d+/g)!;
    expect(urls).toHaveLength(3);
    for (const url of urls) expect(Buffer.from(await (await result.fetcher(url)).arrayBuffer())).toEqual(bytes);
    expect(remote).not.toHaveBeenCalled();
  });

  it("matches a selected folder prefix or a uniquely named individual file", () => {
    expect(() => prepareTemplateHtml('<img src="images/a.png">', "home.html", new Map([["export/images/a.png", bytes]]), remote)).not.toThrow();
    expect(() => prepareTemplateHtml('<img src="images/a.png">', "home.html", new Map([["a.png", bytes]]), remote)).not.toThrow();
  });

  it("reports missing and ambiguous local files instead of silently removing photos", () => {
    expect(() => prepareTemplateHtml('<img src="images/missing.png">', "home.html", new Map(), remote)).toThrow(/Missing image/);
    expect(() => prepareTemplateHtml('<img src="a.png">', "home.html", new Map([["one/a.png", bytes], ["two/a.png", bytes]]), remote)).toThrow(/Missing image/);
  });

  it("bundles embedded raster images and leaves remote fetching to the guarded fetcher", async () => {
    const result = prepareTemplateHtml(`<img src="data:image/png;base64,${bytes.toString("base64")}">`, "home.html", new Map(), remote);
    const url = result.html.match(/https:\/\/template-assets.invalid\/\d+/)![0];
    expect(Buffer.from(await (await result.fetcher(url)).arrayBuffer())).toEqual(bytes);
  });
});
