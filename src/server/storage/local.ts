import "server-only";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rm, stat, writeFile, type FileHandle } from "node:fs/promises";
import path from "node:path";

import type { StorageProvider, StoredObject } from "@/server/providers/contracts";

/** Keys are relative, lowercase-safe paths such as "media/ab/abcdef.jpg". */
const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]*$/;

export function assertSafeKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes("..") || key.includes("//") || key.endsWith("/")) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}

/** Content-addressed key: identical files share one stored copy. */
export function contentKey(body: Uint8Array, extension: string, prefix = "media"): { key: string; sha256: string } {
  const sha256 = createHash("sha256").update(body).digest("hex");
  const ext = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return { key: `${prefix}/${sha256.slice(0, 2)}/${sha256}.${ext}`, sha256 };
}

/** Filesystem storage for development and single-server deployments. */
export function createLocalStorage(rootDir: string): StorageProvider {
  const root = path.resolve(rootDir);
  const resolve = (key: string) => {
    assertSafeKey(key);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error(`Storage key escapes root: ${key}`);
    return full;
  };

  return {
    id: "local",
    async put(key, body, contentType): Promise<StoredObject> {
      const full = resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
      return { key, size: body.byteLength, contentType };
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(resolve(key)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async size(key) {
      try {
        return (await stat(resolve(key))).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async getRange(key, start, end) {
      let handle: FileHandle;
      try {
        handle = await open(resolve(key), "r");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      try {
        const length = Math.max(0, end - start + 1);
        const buffer = new Uint8Array(length);
        const { bytesRead } = await handle.read(buffer, 0, length, start);
        return buffer.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
    async url(key) {
      resolve(key);
      return `/media/file/${key}`;
    },
  };
}

export async function fileExists(rootDir: string, key: string): Promise<boolean> {
  try {
    assertSafeKey(key);
    return (await stat(path.join(path.resolve(rootDir), key))).isFile();
  } catch {
    return false;
  }
}
