import "server-only";

/** Bounds actual bytes before parsing; Content-Length is only an early rejection. */
export class BodyLimitError extends Error {
  constructor(public readonly status: 408 | 413, message: string) { super(message); }
}

export async function readBody(request: Pick<Request, "headers" | "body">, maxBytes: number, timeoutMs = 15_000): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) throw new BodyLimitError(413, "Request too large");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new BodyLimitError(408, "Request timed out"));
      void reader.cancel().catch(() => undefined);
    }, timeoutMs);
  });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new BodyLimitError(413, "Request too large");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export async function readForm(request: Request, maxBytes: number): Promise<FormData> {
  const bytes = await readBody(request, maxBytes);
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
}

export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readBody(request, maxBytes)));
}
