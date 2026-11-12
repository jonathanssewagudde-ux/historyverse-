import "server-only";

import { MAX_RANGE_BYTES, parseRange } from "@/lib/http/range";
import type { StorageProvider } from "@/server/providers/contracts";

export const notFoundResponse = () =>
  new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Stream a stored file to a signed-in staff member, with byte ranges so audio and video players
 * can seek. Files larger than one chunk are only ever read a range at a time.
 */
export async function serveStored(
  request: Request,
  storage: StorageProvider,
  key: string,
  contentType: string,
  options: { download?: string } = {},
): Promise<Response> {
  const size = await storage.size(key);
  if (size === null) return notFoundResponse();
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  if (options.download) {
    headers["Content-Disposition"] =
      `attachment; filename="${options.download.replace(/[^\w.-]+/g, "-")}"`;
  }
  let range = parseRange(request.headers.get("range"), size);
  // A player that asks for the whole of a large file gets the first chunk and continues by range.
  if (range.kind === "none" && size > MAX_RANGE_BYTES && !options.download) {
    range = { kind: "partial", start: 0, end: MAX_RANGE_BYTES - 1 };
  }
  if (range.kind === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  if (range.kind === "partial") {
    const slice = await storage.getRange(key, range.start, range.end);
    if (!slice) return notFoundResponse();
    return new Response(slice as unknown as BodyInit, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(slice.byteLength),
      },
    });
  }
  // The whole file (downloads), read and sent a chunk at a time.
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= size) return controller.close();
      const end = Math.min(size, offset + MAX_RANGE_BYTES) - 1;
      const chunk = await storage.getRange(key, offset, end);
      if (!chunk) return controller.error(new Error("The file disappeared while streaming."));
      controller.enqueue(chunk);
      offset = end + 1;
    },
  });
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
