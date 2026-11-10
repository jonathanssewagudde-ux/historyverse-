import "server-only";

import { getDb } from "@/server/db/client";
import { checkDatabase, type DatabaseHealth } from "@/server/db/health";

export interface StudioOverview {
  database: DatabaseHealth;
  counts: { label: string; value: number }[];
  recentAudit: { id: string; action: string; actorEmail: string | null; createdAt: Date }[];
}

/** Real numbers from the database; nothing here is estimated or hard-coded. */
export async function getStudioOverview(options: {
  includeAudit: boolean;
}): Promise<StudioOverview> {
  const database = await checkDatabase();
  if (database.status !== "up") return { database, counts: [], recentAudit: [] };

  const db = getDb();
  const [users, entities, articles, published, sources, media, projects, recentAudit] =
    await Promise.all([
      db.user.count(),
      db.entity.count({ where: { deletedAt: null } }),
      db.article.count({ where: { deletedAt: null } }),
      db.article.count({ where: { deletedAt: null, status: { in: ["PUBLISHED", "UPDATED"] } } }),
      db.source.count(),
      db.mediaAsset.count({ where: { deletedAt: null } }),
      db.contentProject.count(),
      options.includeAudit
        ? db.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            select: { id: true, action: true, actorEmail: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

  return {
    database,
    counts: [
      { label: "Users", value: users },
      { label: "Historical entities", value: entities },
      { label: "Articles", value: articles },
      { label: "Published articles", value: published },
      { label: "Sources", value: sources },
      { label: "Media assets", value: media },
      { label: "Projects", value: projects },
    ],
    recentAudit,
  };
}
