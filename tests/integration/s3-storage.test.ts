import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createS3Storage } from "@/server/storage/s3";

/** The S3 driver against s3rver, a local S3-compatible server (no cloud account involved). */

// s3rver ships CommonJS without types.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const S3rver = require("s3rver") as new (options: Record<string, unknown>) => {
  run(): Promise<{ port: number }>;
  close(): Promise<void>;
};

let server: InstanceType<typeof S3rver>;
let storage: ReturnType<typeof createS3Storage>;

beforeAll(async () => {
  server = new S3rver({
    port: 0,
    address: "127.0.0.1",
    silent: true,
    directory: mkdtempSync(path.join(tmpdir(), "hv-s3-")),
    configureBuckets: [{ name: "historyverse-test" }],
  });
  const { port } = await server.run();
  storage = createS3Storage({
    bucket: "historyverse-test",
    region: "us-east-1",
    accessKeyId: "S3RVER",
    secretAccessKey: "S3RVER",
    endpoint: `http://127.0.0.1:${port}`,
  });
});

afterAll(async () => {
  await server?.close();
});

describe("S3-compatible storage", () => {
  it("stores, reads back and deletes objects", async () => {
    const body = new TextEncoder().encode("HISTORYVERSE storage test");
    expect(await storage.put("media/ab/test.txt", body, "text/plain")).toEqual({
      key: "media/ab/test.txt",
      size: body.byteLength,
      contentType: "text/plain",
    });
    expect(await storage.get("media/ab/test.txt")).toEqual(body);
    await storage.delete("media/ab/test.txt");
    expect(await storage.get("media/ab/test.txt")).toBeNull();
  });

  it("signs short-lived URLs that really serve the object", async () => {
    await storage.put("media/cd/hello.txt", new TextEncoder().encode("hello"), "text/plain");
    const url = await storage.url("media/cd/hello.txt", 120);
    expect(url).toMatch(/X-Amz-Expires=120/);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello");
  });

  it("refuses keys that try to leave the storage area", async () => {
    await expect(storage.put("../escape.txt", new Uint8Array([1]), "text/plain")).rejects.toThrow();
  });
});
