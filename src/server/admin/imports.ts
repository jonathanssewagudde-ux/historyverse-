import "server-only";

import { getDb } from "@/server/db/client";
import { formatDateRowRange } from "@/server/history/date-row";

export interface ImportedEntityRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  summary: string | null;
  dates: string | null;
  wikidataId: string | null;
  claims: number;
  unverifiedClaims: number;
  media: number;
}

export interface ImportRunRow {
  id: string;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  created: number;
  updated: number;
  failed: number;
  warnings: number;
  error: string | null;
}

export async function getImportedData(): Promise<{
  entities: ImportedEntityRow[];
  runs: ImportRunRow[];
  totals: { entities: number; claims: number; verified: number; media: number };
}> {
  const db = getDb();
  const [entities, runs, claims, verified, media] = await Promise.all([
    db.entity.findMany({
      where: { deletedAt: null, wikidataId: { not: null } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      take: 200,
      select: {
        id: true,
        name: true,
        kind: true,
        status: true,
        summary: true,
        wikidataId: true,
        startDate: true,
        endDate: true,
        _count: { select: { claims: true, media: true } },
        claims: { where: { verification: "UNVERIFIED" }, select: { id: true } },
      },
    }),
    db.productionJob.findMany({
      where: { type: "INGESTION" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.historicalClaim.count({ where: { origin: "IMPORT" } }),
    db.historicalClaim.count({ where: { origin: "IMPORT", verification: "VERIFIED" } }),
    db.mediaAsset.count({ where: { deletedAt: null } }),
  ]);

  return {
    totals: { entities: entities.length, claims, verified, media },
    entities: entities.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      status: e.status,
      summary: e.summary,
      dates: formatDateRowRange(e.startDate, e.endDate),
      wikidataId: e.wikidataId,
      claims: e._count.claims,
      unverifiedClaims: e.claims.length,
      media: e._count.media,
    })),
    runs: runs.map((job) => {
      const output = (job.output ?? {}) as {
        created?: unknown[];
        updated?: unknown[];
        failed?: unknown[];
        warnings?: unknown[];
      };
      return {
        id: job.id,
        status: job.status,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        created: output.created?.length ?? 0,
        updated: output.updated?.length ?? 0,
        failed: output.failed?.length ?? 0,
        warnings: output.warnings?.length ?? 0,
        error: job.error,
      };
    }),
  };
}
