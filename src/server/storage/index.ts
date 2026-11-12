import "server-only";

import { getServerEnv } from "@/server/env";
import { ProviderUnavailableError, type StorageProvider } from "@/server/providers/contracts";
import { createLocalStorage } from "./local";
import { createS3Storage } from "./s3";

let cached: StorageProvider | undefined;

/**
 * The configured storage provider: local filesystem (development, single server) or any
 * S3-compatible service. A misconfigured S3 driver is reported, never silently replaced by disk.
 */
export function getStorage(): StorageProvider {
  if (cached) return cached;
  const { env } = getServerEnv();
  if (env.STORAGE_DRIVER === "s3") {
    const missing = (["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const).filter(
      (k) => !env[k],
    );
    if (missing.length > 0) {
      throw new ProviderUnavailableError("storage", `STORAGE_DRIVER=s3 needs ${missing.join(", ")}.`);
    }
    cached = createS3Storage({
      bucket: env.S3_BUCKET!,
      region: env.S3_REGION!,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      endpoint: env.S3_ENDPOINT,
    });
    return cached;
  }
  cached = createLocalStorage(env.STORAGE_LOCAL_DIR);
  return cached;
}
