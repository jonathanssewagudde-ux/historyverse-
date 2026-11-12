import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { StorageProvider, StoredObject } from "@/server/providers/contracts";
import { assertSafeKey } from "./local";

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** For S3-compatible services (R2, MinIO, GCS). Omit for AWS S3. */
  endpoint?: string;
  /** Path-style URLs (bucket in the path), needed by most self-hosted S3-compatible servers. */
  forcePathStyle?: boolean;
}

/**
 * S3-compatible object storage. Objects are private: they are read by the server (the media
 * route applies its licence and review checks) or through short-lived signed URLs.
 */
export function createS3Storage(config: S3Config): StorageProvider {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return {
    id: "s3",
    async put(key, body, contentType): Promise<StoredObject> {
      assertSafeKey(key);
      await client.send(
        new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentType: contentType }),
      );
      return { key, size: body.byteLength, contentType };
    },
    async get(key) {
      assertSafeKey(key);
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        return res.Body ? new Uint8Array(await res.Body.transformToByteArray()) : null;
      } catch (error) {
        if (error instanceof NoSuchKey || (error as { name?: string }).name === "NoSuchKey") return null;
        throw error;
      }
    },
    async size(key) {
      assertSafeKey(key);
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return head.ContentLength ?? null;
      } catch (error) {
        const name = (error as { name?: string }).name;
        if (name === "NotFound" || name === "NoSuchKey") return null;
        throw error;
      }
    },
    async getRange(key, start, end) {
      assertSafeKey(key);
      try {
        const res = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: `bytes=${start}-${end}` }),
        );
        return res.Body ? new Uint8Array(await res.Body.transformToByteArray()) : null;
      } catch (error) {
        if (error instanceof NoSuchKey || (error as { name?: string }).name === "NoSuchKey") return null;
        throw error;
      }
    },
    async delete(key) {
      assertSafeKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    async url(key, expiresInSeconds = 900) {
      assertSafeKey(key);
      return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
        expiresIn: Math.min(Math.max(60, expiresInSeconds), 7 * 86_400),
      });
    },
  };
}
