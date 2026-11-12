import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { EditorOptions } from "@/components/admin/article-editor";

/** Choices offered by the article editor: entities, library media and existing sources. */
export async function loadEditorOptions(db: PrismaClient): Promise<EditorOptions> {
  const [entities, media, sources, categories] = await Promise.all([
    db.entity.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
      take: 2000,
    }),
    db.mediaAsset.findMany({
      // Reconstructions are offered once an editor has approved them in the AI Image Studio.
      where: {
        deletedAt: null,
        OR: [
          { kind: { not: "AI_RECONSTRUCTION" } },
          { kind: "AI_RECONSTRUCTION", reviewStatus: "APPROVED" },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: { license: true },
      take: 500,
    }),
    db.source.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, type: true, url: true },
      take: 1000,
    }),
    db.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { slug: true, name: true },
    }),
  ]);
  return {
    entities,
    media: media.map((m) => ({
      id: m.id,
      title: m.title,
      kind: m.kind,
      license: m.license.name,
      publishable: m.license.publishable,
      stored: Boolean(m.storageKey),
    })),
    sources,
    categories,
  };
}
