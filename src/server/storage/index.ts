import "server-only";

import { getServerEnv } from "@/server/env";
import { ProviderUnavailableError, type StorageProvider } from "@/server/providers/contracts";
import { createLocalStorage } from "./local";

let cached: StorageProvider | undefined;

/**
 * The configured storage provider. Local filesystem storage is implemented; the S3-compatible
 * driver arrives with the media studio (Milestone 9) and is reported as unavailable until then
 * rather than silently falling back to local disk.
 */
export function getStorage(): StorageProvider {
  if (cached) return cached;
  const { env } = getServerEnv();
  if (env.STORAGE_DRIVER === "s3") {
    throw new ProviderUnavailableError("storage", "The S3 storage driver is not implemented yet (Milestone 9). Use STORAGE_DRIVER=local.");
  }
  cached = createLocalStorage(env.STORAGE_LOCAL_DIR);
  return cached;
}
