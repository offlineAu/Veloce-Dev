import { describe, expect, it, vi } from "vitest";
import { readBody, readForm, readJson } from "@/server/security/body";
import { withCapacity } from "@/server/security/budget";

function streamed(parts: Uint8Array[], headers: Record<string, string> = {}) {
  let i = 0;
  const cancel = vi.fn();
  const body = new ReadableStream({ pull(controller) { if (i < parts.length) controller.enqueue(parts[i++]!); else controller.close(); }, cancel });
  return { request: new Request("https://example.com", { method: "POST", body, headers, duplex: "half" } as RequestInit), cancel };
}
describe("bounded request parsing", () => {
  it("rejects oversized chunked bytes without trusting Content-Length", async () => {
    const { request, cancel } = streamed([new Uint8Array(8), new Uint8Array(8), new Uint8Array(8)], { "content-length": "1" });
    await expect(readBody(request, 10)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalled();
  });
  it("bounds bytes rather than decoded character count", async () => {
    const { request } = streamed([new TextEncoder().encode("😀😀")]);
    await expect(readBody(request, 7)).rejects.toMatchObject({ status: 413 });
  });
  it("times out and cancels a stalled body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ pull() { return new Promise(() => undefined); }, cancel });
    const request = new Request("https://example.com", { method: "POST", body, duplex: "half" } as RequestInit);
    await expect(readBody(request, 100, 5)).rejects.toMatchObject({ status: 408 });
    expect(cancel).toHaveBeenCalled();
  });
  it("preserves valid multipart files and parses bounded JSON", async () => {
    const form = new FormData(); form.set("file", new File(["photo"], "photo.webp"));
    const parsed = await readForm(new Request("https://example.com", { method: "POST", body: form }), 1000);
    expect(await (parsed.get("file") as File).text()).toBe("photo");
    const { request } = streamed([new TextEncoder().encode('{"ok":true}')]);
    expect(await readJson(request)).toEqual({ ok: true });
  });
});
it("rejects excess processing without queueing unbounded jobs and releases failed slots", async () => {
  let finish!: () => void;
  const first = withCapacity("fixture", 1, () => new Promise<void>(resolve => { finish = resolve; }));
  await expect(withCapacity("fixture", 1, async () => true)).rejects.toThrow("busy");
  finish(); await first;
  await expect(withCapacity("fixture", 1, async () => { throw new Error("processing failed"); })).rejects.toThrow("failed");
  expect(await withCapacity("fixture", 1, async () => true)).toBe(true);
});
