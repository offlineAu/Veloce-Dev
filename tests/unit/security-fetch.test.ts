import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mock.lookup }));
vi.mock("node:https", () => ({ request: mock.request }));
import { createSafeFetch, isPrivateAddress, pinnedDownload } from "@/server/builder/safe-fetch";

beforeEach(() => { vi.resetAllMocks(); mock.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]); });
function reply(status: number, data: Buffer, headers: Record<string, string> = {}) {
  mock.request.mockImplementationOnce((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => { const response = Object.assign(new PassThrough(), { statusCode: status, headers }); callback(response); queueMicrotask(() => response.end(data)); };
    return req;
  });
}
describe("connection-bound remote asset fetching", () => {
  it("rejects mapped, encoded, reserved and transition addresses", () => {
    for (const ip of ["::ffff:7f00:1", "::ffff:a9fe:a9fe", "::127.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::", "2001:db8::1", "192.0.2.1", "198.51.100.2", "203.0.113.1", "3fff::1"]) expect(isPrivateAddress(ip), ip).toBe(true);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });
  it("pins the checked address in the TLS lookup and never resolves again to connect", async () => {
    reply(200, Buffer.from("image"));
    const result = await pinnedDownload("https://images.example.com/a");
    expect(result.bytes.toString()).toBe("image");
    const options = mock.request.mock.calls[0]![1];
    const callback = vi.fn(); options.lookup("images.example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    expect(options.agent).toBe(false);
    expect(mock.lookup).toHaveBeenCalledTimes(1);
    expect(mock.request.mock.calls[0]![0].hostname).toBe("images.example.com");
  });
  it("rejects a mixed public/private DNS answer before opening a socket", async () => {
    mock.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }]);
    await expect(pinnedDownload("https://images.example.com/a")).rejects.toThrow("not public");
    expect(mock.request).not.toHaveBeenCalled();
  });
  it("revalidates redirects and does not forward bearer credentials", async () => {
    reply(302, Buffer.alloc(0), { location: "https://169.254.169.254/meta" });
    await expect(createSafeFetch()("https://images.example.com/a", { headers: { Authorization: "Bearer fixture" } })).rejects.toThrow("not public");
    expect(mock.request.mock.calls[0]![1].headers).not.toHaveProperty("Authorization");
    expect(mock.request).toHaveBeenCalledTimes(1);
  });
  it("caps actual streamed bytes even with a missing length", async () => {
    reply(200, Buffer.alloc(11));
    await expect(pinnedDownload("https://images.example.com/a", {}, 10)).rejects.toThrow("file too large");
  });
  it("bounds redirects and per-import file counts", async () => {
    for (let i = 0; i < 4; i++) reply(302, Buffer.alloc(0), { location: "https://images.example.com/again" });
    await expect(createSafeFetch()("https://images.example.com/a")).rejects.toThrow("too many redirects");
    reply(200, Buffer.from("one"));
    const fetcher = createSafeFetch(1);
    await fetcher("https://images.example.com/a");
    await expect(fetcher("https://images.example.com/b")).rejects.toThrow("too many files");
  });
});
