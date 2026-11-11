import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertSafeKey, contentKey, createLocalStorage } from "./local";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "hv-storage-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("local storage", () => {
  it("stores, reads and deletes objects", async () => {
    const storage = createLocalStorage(dir);
    const body = new TextEncoder().encode("hello");
    await expect(storage.put("media/aa/file.txt", body, "text/plain")).resolves.toEqual({
      key: "media/aa/file.txt",
      size: 5,
      contentType: "text/plain",
    });
    expect(new TextDecoder().decode((await storage.get("media/aa/file.txt"))!)).toBe("hello");
    expect(await storage.url("media/aa/file.txt")).toBe("/media/file/media/aa/file.txt");
    await storage.delete("media/aa/file.txt");
    expect(await storage.get("media/aa/file.txt")).toBeNull();
  });

  it.each(["../etc/passwd", "/etc/passwd", "media/../../x", "Media/X.jpg", "media//x", "media/x/", ""])(
    "rejects unsafe key %j",
    async (key) => {
      expect(() => assertSafeKey(key)).toThrow(/Unsafe storage key/);
      await expect(createLocalStorage(dir).get(key)).rejects.toThrow();
    },
  );

  it("derives content-addressed keys", () => {
    const { key, sha256 } = contentKey(new TextEncoder().encode("hello"), "JPG");
    expect(sha256).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(key).toBe(`media/2c/${sha256}.jpg`);
  });
});
