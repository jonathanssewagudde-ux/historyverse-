import "server-only";

import type { EntityKind, Prisma, PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { formatDateRow, formatDateRowRange } from "@/server/history/date-row";

type Actor = { id: string; email?: string | null; role: Role };

/** The entity managers in the Studio and the kinds each one covers. */
export const ENTITY_MANAGERS = {
  countries: { title: "Countries", kinds: ["COUNTRY", "TERRITORY"], importKind: "COUNTRY" },
  people: { title: "People", kinds: ["PERSON"], importKind: "PERSON" },
  kingdoms: {
    title: "Kingdoms and states",
    kinds: ["KINGDOM", "EMPIRE", "HISTORICAL_STATE", "DYNASTY"],
    importKind: "KINGDOM",
  },
  civilizations: { title: "Civilizations", kinds: ["CIVILIZATION"], importKind: "CIVILIZATION" },
  events: { title: "Events and periods", kinds: ["EVENT", "PERIOD"], importKind: "EVENT" },
} as const satisfies Record<string, { title: string; kinds: EntityKind[]; importKind: EntityKind }>;

export type EntityManagerKey = keyof typeof ENTITY_MANAGERS;

export class EntityAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityAdminError";
  }
}

export interface EntityListRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  wikidataId: string | null;
  dates: string | null;
  claims: number;
  unverified: number;
  articles: number;
}

export async function listEntities(
  db: PrismaClient,
  manager: EntityManagerKey,
  q = "",
): Promise<EntityListRow[]> {
  const kinds = [...ENTITY_MANAGERS[manager].kinds] as EntityKind[];
  const term = q.trim().slice(0, 100);
  const where: Prisma.EntityWhereInput = {
    deletedAt: null,
    kind: { in: kinds },
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { aliases: { some: { name: { contains: term, mode: "insensitive" } } } },
            { wikidataId: term.toUpperCase() },
          ],
        }
      : {}),
  };
  const rows = await db.entity.findMany({
    where,
    orderBy: { name: "asc" },
    take: 200,
    include: {
      startDate: true,
      endDate: true,
      _count: { select: { claims: true, articlesPrimary: true } },
      claims: { where: { verification: "UNVERIFIED" }, select: { id: true } },
    },
  });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    status: e.status,
    wikidataId: e.wikidataId,
    dates: formatDateRowRange(e.startDate, e.endDate),
    claims: e._count.claims,
    unverified: e.claims.length,
    articles: e._count.articlesPrimary,
  }));
}

export async function getEntityDetail(db: PrismaClient, id: string) {
  const entity = await db.entity.findUnique({
    where: { id },
    include: {
      startDate: true,
      endDate: true,
      aliases: { orderBy: { name: "asc" } },
      articlesPrimary: { select: { id: true, title: true, status: true } },
      claims: {
        orderBy: [{ verification: "asc" }, { createdAt: "asc" }],
        include: {
          date: true,
          verifiedBy: { select: { name: true } },
          citations: { include: { source: { select: { title: true, url: true } } } },
        },
      },
    },
  });
  if (!entity || entity.deletedAt) return null;
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    status: entity.status,
    summary: entity.summary,
    wikidataId: entity.wikidataId,
    dates: formatDateRowRange(entity.startDate, entity.endDate),
    aliases: entity.aliases.map((a) => a.name),
    articles: entity.articlesPrimary,
    claims: entity.claims.map((c) => ({
      id: c.id,
      statement: c.statement,
      type: c.type,
      certainty: c.certainty,
      origin: c.origin,
      verification: c.verification,
      date: formatDateRow(c.date),
      verifiedBy: c.verifiedBy?.name ?? null,
      sources: c.citations.map((ct) => ({
        title: ct.source.title,
        url: ct.source.url,
        locator: ct.locator,
      })),
    })),
  };
}

export type EntityDetail = NonNullable<Awaited<ReturnType<typeof getEntityDetail>>>;

/**
 * Verify or reject one claim. Verification is a person's statement that the cited source supports
 * the claim, so a claim with no source cannot be verified.
 */
export async function decideClaim(
  db: PrismaClient,
  actor: Actor,
  claimId: string,
  decision: "VERIFIED" | "REJECTED" | "UNVERIFIED",
) {
  if (!hasPermission(actor.role, "claim:verify")) {
    throw new EntityAdminError("Only editors can verify claims.");
  }
  const claim = await db.historicalClaim.findUnique({
    where: { id: claimId },
    include: { _count: { select: { citations: true } } },
  });
  if (!claim) throw new EntityAdminError("Claim not found.");
  if (decision === "VERIFIED" && claim._count.citations === 0) {
    throw new EntityAdminError("A claim without a cited source cannot be verified.");
  }
  const decided = decision !== "UNVERIFIED";
  await db.historicalClaim.update({
    where: { id: claimId },
    data: {
      verification: decision,
      verifiedById: decided ? actor.id : null,
      verifiedAt: decided ? new Date() : null,
    },
  });
  await recordAudit({
    action: `claim.${decision.toLowerCase()}`,
    actor,
    target: { type: "claim", id: claimId },
    metadata: { entityId: claim.entityId, previous: claim.verification },
  });
  return claim.entityId;
}

/** Edit the short neutral description shown on entity pages and in search. */
export async function updateEntitySummary(
  db: PrismaClient,
  actor: Actor,
  entityId: string,
  summary: string,
) {
  if (!hasPermission(actor.role, "entity:edit")) {
    throw new EntityAdminError("You cannot edit entities.");
  }
  const text = summary.trim();
  if (text.length > 600) throw new EntityAdminError("Keep the summary under 600 characters.");
  const entity = await db.entity.findUnique({ where: { id: entityId } });
  if (!entity || entity.deletedAt) throw new EntityAdminError("Entity not found.");
  await db.entity.update({ where: { id: entityId }, data: { summary: text || null } });
  await recordAudit({
    action: "entity.summary_updated",
    actor,
    target: { type: "entity", id: entityId },
    metadata: { before: entity.summary, after: text || null },
  });
}
