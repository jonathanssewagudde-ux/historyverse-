import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  chronologicalSortKey,
  formatHistoricalDate,
  type HistoricalDate,
} from "@/lib/history/dates";
import { recordAudit } from "@/server/audit";
import { createLogger } from "@/server/logger";
import type { CommonsFile } from "@/server/sources/commons/client";
import { wikidataUrl, type WikidataClient } from "@/server/sources/wikidata/client";
import {
  mapWikidataEntity,
  slugify,
  type ImportedClaim,
  type ImportedEntity,
  type ImportKind,
} from "@/server/sources/wikidata/mapper";
import { wikipediaUrl } from "@/server/sources/wikipedia/client";

const log = createLogger("ingestion.wikidata");

type Tx = Prisma.TransactionClient;

export interface ImportSeed {
  qid: string;
  /** Overrides the kind inferred from Wikidata classes, e.g. KINGDOM for a "historical country". */
  kind?: ImportKind;
}

export interface ImportOptions {
  seeds: ImportSeed[];
  /** Follow parent/child/spouse links from imported people this many steps. */
  followKin?: number;
  /** Safety cap on the total number of entities fetched in one run. */
  maxEntities?: number;
  /** Fetch licence metadata for each entity's main image from Wikimedia Commons. */
  withMedia?: boolean;
  actor?: { id: string; email?: string | null; role?: string | null } | null;
}

export interface ImportDeps {
  db: PrismaClient;
  wikidata: WikidataClient;
  commons?: { getFiles(names: string[]): Promise<CommonsFile[]> };
}

export interface ImportReport {
  jobId: string;
  created: string[];
  updated: string[];
  /** Imported fields left untouched because the entity has already entered review. */
  protectedFromOverwrite: string[];
  claims: number;
  relations: number;
  kinships: number;
  terms: number;
  media: number;
  failed: { qid: string; error: string }[];
  warnings: { qid: string; message: string }[];
}

const dateData = (d: HistoricalDate): Prisma.HistoricalDateCreateInput => ({
  year: d.year,
  month: d.month ?? null,
  day: d.day ?? null,
  precision: d.precision.toUpperCase() as Prisma.HistoricalDateCreateInput["precision"],
  approximate: d.approximate ?? false,
  uncertain: d.uncertain ?? false,
  calendar: d.calendar === "julian" ? "JULIAN" : "GREGORIAN",
  sortKey: BigInt(chronologicalSortKey(d)),
});

async function replaceDate(
  tx: Tx,
  previousId: string | null | undefined,
  next: HistoricalDate | null,
) {
  if (previousId)
    await tx.historicalDate.delete({ where: { id: previousId } }).catch(() => undefined);
  return next ? (await tx.historicalDate.create({ data: dateData(next) })).id : null;
}

/** A slug unique within the entity kind. Collisions get the QID appended; never a random suffix. */
async function uniqueSlug(tx: Tx, kind: ImportKind, name: string, qid: string): Promise<string> {
  const base = slugify(name, qid);
  const taken = await tx.entity.findUnique({
    where: { kind_slug: { kind, slug: base } },
    select: { id: true },
  });
  return taken ? `${base}-${qid.toLowerCase()}` : base;
}

function claimValueText(claim: ImportedClaim, labels: Map<string, string>): string {
  switch (claim.value.type) {
    case "entity":
      return labels.get(claim.value.id) ?? claim.value.id;
    case "time":
      return claim.date ? formatHistoricalDate(claim.date) : claim.value.raw.time;
    case "coordinate":
      return `${claim.value.latitude.toFixed(4)}, ${claim.value.longitude.toFixed(4)}`;
    case "string":
      return claim.value.text;
  }
}

/** Write one mapped entity. Runs in a transaction so a failure leaves nothing half-imported. */
async function upsertEntity(tx: Tx, item: ImportedEntity, labels: Map<string, string>) {
  const existingId = await tx.externalIdentifier.findUnique({
    where: { source_value: { source: "wikidata", value: item.qid } },
    select: { entityId: true },
  });
  const existing = existingId
    ? await tx.entity.findUnique({ where: { id: existingId.entityId } })
    : await tx.entity.findUnique({ where: { wikidataId: item.qid } });

  // Imported data may only overwrite a record nobody has reviewed yet. Once an entity has entered
  // review or been published, re-imports add evidence (claims) but never change editorial fields.
  const overwritable = !existing || existing.status === "DRAFT";

  let entityId: string;
  if (!existing) {
    const startDateId = await replaceDate(tx, null, item.startDate);
    const endDateId = await replaceDate(tx, null, item.endDate);
    const created = await tx.entity.create({
      data: {
        kind: item.kind,
        slug: await uniqueSlug(tx, item.kind, item.name, item.qid),
        name: item.name,
        summary: item.description,
        wikidataId: item.qid,
        startDateId,
        endDateId,
      },
    });
    entityId = created.id;
  } else {
    entityId = existing.id;
    if (overwritable) {
      const startDateId = await replaceDate(tx, existing.startDateId, item.startDate);
      const endDateId = await replaceDate(tx, existing.endDateId, item.endDate);
      await tx.entity.update({
        where: { id: entityId },
        data: {
          name: item.name,
          summary: item.description,
          wikidataId: item.qid,
          startDateId,
          endDateId,
        },
      });
    }
  }

  // External identifiers: the dedup key for every later import.
  await tx.externalIdentifier.upsert({
    where: { source_value: { source: "wikidata", value: item.qid } },
    create: { entityId, source: "wikidata", value: item.qid, url: wikidataUrl(item.qid) },
    update: { entityId },
  });
  if (item.wikipediaTitle) {
    await tx.externalIdentifier.upsert({
      where: { source_value: { source: "enwiki", value: item.wikipediaTitle } },
      create: {
        entityId,
        source: "enwiki",
        value: item.wikipediaTitle,
        url: wikipediaUrl(item.wikipediaTitle),
      },
      update: { entityId },
    });
  }

  if (overwritable) {
    for (const alias of item.aliases) {
      await tx.entityAlias.upsert({
        where: { entityId_name_type: { entityId, name: alias.name, type: "ALTERNATIVE" } },
        create: { entityId, name: alias.name, language: alias.language },
        update: { language: alias.language },
      });
    }
    await upsertDetail(tx, entityId, item, labels);
  }

  const claimCount = await syncClaims(tx, entityId, item, labels);
  return { entityId, created: !existing, overwritable, claimCount };
}

async function upsertDetail(
  tx: Tx,
  entityId: string,
  item: ImportedEntity,
  labels: Map<string, string>,
) {
  const continent = (value: string | null | undefined) =>
    (value ?? null) as Prisma.CountryCreateInput["continent"];

  if (item.kind === "PERSON" && item.person) {
    const occupations = item.person.occupationQids
      .map((q) => labels.get(q))
      .filter((l): l is string => Boolean(l));
    const data = {
      gender: item.person.gender,
      occupations,
      isLiving: !item.endDate && isPlausiblyLiving(item.startDate),
    };
    await tx.historicalPerson.upsert({
      where: { entityId },
      create: { entityId, ...data },
      update: data,
    });
  } else if (item.kind === "COUNTRY" && item.country) {
    const data = {
      iso2: item.country.iso2,
      iso3: item.country.iso3,
      continent: continent(item.country.continent),
    };
    await tx.country.upsert({ where: { entityId }, create: { entityId, ...data }, update: data });
  } else if (
    (item.kind === "HISTORICAL_STATE" || item.kind === "KINGDOM" || item.kind === "EMPIRE") &&
    item.state
  ) {
    const polityType =
      item.kind === "KINGDOM" ? "KINGDOM" : item.kind === "EMPIRE" ? "EMPIRE" : "STATE";
    const data = { polityType, continent: continent(item.state.continent) } as const;
    await tx.historicalState.upsert({
      where: { entityId },
      create: { entityId, ...data },
      update: data,
    });
    if (item.kind === "KINGDOM") {
      await tx.kingdom.upsert({
        where: { stateId: entityId },
        create: { stateId: entityId },
        update: {},
      });
    } else if (item.kind === "EMPIRE") {
      await tx.empire.upsert({
        where: { stateId: entityId },
        create: { stateId: entityId },
        update: {},
      });
    }
  } else if (item.kind === "LOCATION") {
    const data = {
      type: "CITY" as const,
      latitude: item.location?.latitude ?? null,
      longitude: item.location?.longitude ?? null,
    };
    await tx.location.upsert({ where: { entityId }, create: { entityId, ...data }, update: data });
  } else if (item.kind === "CIVILIZATION") {
    await tx.civilization.upsert({ where: { entityId }, create: { entityId }, update: {} });
  } else if (item.kind === "DYNASTY") {
    await tx.dynasty.upsert({ where: { entityId }, create: { entityId }, update: {} });
  } else if (item.kind === "EVENT") {
    await tx.historicalEvent.upsert({
      where: { entityId },
      create: { entityId, type: "OTHER" },
      update: {},
    });
  } else if (item.kind === "PERIOD") {
    await tx.historicalPeriod.upsert({ where: { entityId }, create: { entityId }, update: {} });
  }
}

/** Someone with no recorded death, born within the last 110 years, is treated as possibly living. */
function isPlausiblyLiving(birth: HistoricalDate | null): boolean {
  return birth !== null && birth.year > new Date().getUTCFullYear() - 110;
}

/**
 * Store each Wikidata statement as an UNVERIFIED claim that cites the exact statement. Re-imports
 * add new statements and remove unverified ones Wikidata no longer makes; claims a person has
 * verified or rejected are never touched.
 */
async function syncClaims(
  tx: Tx,
  entityId: string,
  item: ImportedEntity,
  labels: Map<string, string>,
) {
  const source = await findOrCreateWikidataSource(tx, item);
  const existing = await tx.historicalClaim.findMany({
    where: { entityId, origin: "IMPORT", property: { not: null } },
    select: { id: true, verification: true, value: true },
  });
  const byStatement = new Map<string, (typeof existing)[number]>();
  for (const claim of existing) {
    const statementId = (claim.value as { statementId?: string } | null)?.statementId;
    if (statementId) byStatement.set(statementId, claim);
  }

  const seen = new Set<string>();
  let written = 0;
  for (const claim of item.claims) {
    if (!claim.statementId) continue;
    seen.add(claim.statementId);
    if (byStatement.has(claim.statementId)) continue;

    const dateId = claim.date
      ? (await tx.historicalDate.create({ data: dateData(claim.date) })).id
      : null;
    await tx.historicalClaim.create({
      data: {
        entityId,
        statement: `${item.name}: ${claim.propertyLabel} is ${claimValueText(claim, labels)}.`,
        type: "FACT",
        certainty: "PROBABLE",
        origin: "IMPORT",
        verification: "UNVERIFIED",
        property: claim.property,
        value: {
          statementId: claim.statementId,
          rank: claim.rank,
          ...claim.value,
        } as Prisma.InputJsonObject,
        dateId,
        citations: {
          create: {
            sourceId: source.id,
            locator: claim.statementId,
            note: `Wikidata revision ${item.revision ?? "unknown"}`,
          },
        },
      },
    });
    written += 1;
  }

  const stale = existing.filter((c) => {
    const statementId = (c.value as { statementId?: string } | null)?.statementId;
    return c.verification === "UNVERIFIED" && statementId && !seen.has(statementId);
  });
  if (stale.length > 0)
    await tx.historicalClaim.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
  return written;
}

async function findOrCreateWikidataSource(tx: Tx, item: ImportedEntity) {
  const url = wikidataUrl(item.qid);
  const found = await tx.source.findFirst({ where: { repository: "wikidata", url } });
  const data = {
    type: "DATASET" as const,
    title: `Wikidata: ${item.name} (${item.qid})`,
    publisher: "Wikimedia Foundation",
    url,
    repository: "wikidata",
    licenseNote: "CC0 1.0",
    accessedAt: new Date(),
    reliabilityNote:
      "Community-edited structured data. Statements are leads to be verified against independent sources, not established facts.",
  };
  return found ? tx.source.update({ where: { id: found.id }, data }) : tx.source.create({ data });
}

/** Second pass: connect imported entities to each other. Only links whose both ends exist. */
async function linkEntities(
  db: PrismaClient,
  items: ImportedEntity[],
  labels: Map<string, string>,
) {
  const idByQid = new Map<string, string>();
  for (const row of await db.externalIdentifier.findMany({
    where: { source: "wikidata" },
    select: { value: true, entityId: true },
  })) {
    idByQid.set(row.value, row.entityId);
  }
  const kindById = new Map(
    (
      await db.entity.findMany({
        where: { id: { in: [...idByQid.values()] } },
        select: { id: true, kind: true, status: true },
      })
    ).map((e) => [e.id, e] as const),
  );
  const counts = { relations: 0, kinships: 0, terms: 0 };

  const relate = async (fromId: string, toId: string, type: "LOCATED_IN" | "CAPITAL_OF") => {
    if (fromId === toId) return;
    const where = { fromId_toId_type: { fromId, toId, type } };
    if (!(await db.entityRelation.findUnique({ where }))) {
      await db.entityRelation.create({ data: { fromId, toId, type, certainty: "PROBABLE" } });
      counts.relations += 1;
    }
  };

  for (const item of items) {
    const entityId = idByQid.get(item.qid);
    if (!entityId || kindById.get(entityId)?.status !== "DRAFT") continue;
    const resolve = (qid: string | null | undefined) => (qid ? idByQid.get(qid) : undefined);

    const countryId = resolve(item.countryQid);
    if (countryId) await relate(entityId, countryId, "LOCATED_IN");

    const capitalId = resolve(item.country?.capitalQid ?? item.state?.capitalQid);
    if (capitalId) {
      await relate(capitalId, entityId, "CAPITAL_OF");
      if (item.country) await db.country.update({ where: { entityId }, data: { capitalId } });
      if (item.state) await db.historicalState.update({ where: { entityId }, data: { capitalId } });
    }
    if (item.kind === "LOCATION" && countryId && kindById.get(countryId)?.kind === "COUNTRY") {
      await db.location.update({ where: { entityId }, data: { modernCountryId: countryId } });
    }

    if (item.person) {
      await db.historicalPerson.update({
        where: { entityId },
        data: {
          birthPlaceId: resolve(item.person.birthPlaceQid) ?? null,
          deathPlaceId: resolve(item.person.deathPlaceQid) ?? null,
        },
      });
    }

    for (const kin of item.kinship) {
      const fromId = resolve(kin.fromQid);
      const toId = resolve(kin.toQid);
      if (!fromId || !toId || fromId === toId) continue;
      if (kindById.get(fromId)?.kind !== "PERSON" || kindById.get(toId)?.kind !== "PERSON")
        continue;
      // Spouse links are symmetric: store one row regardless of which side Wikidata states it on.
      const [a, b] = kin.type === "SPOUSE_OF" && fromId > toId ? [toId, fromId] : [fromId, toId];
      const where = { fromId_toId_type: { fromId: a, toId: b, type: kin.type } };
      if (!(await db.royalRelationship.findUnique({ where }))) {
        await db.royalRelationship.create({
          data: { fromId: a, toId: b, type: kin.type, certainty: "PROBABLE" },
        });
        counts.kinships += 1;
      }
    }

    for (const term of item.terms) {
      const officeName = labels.get(term.officeQid);
      if (!officeName) continue;
      const office = await db.politicalOffice.upsert({
        where: { wikidataId: term.officeQid },
        create: {
          wikidataId: term.officeQid,
          name: officeName,
          slug: `${slugify(officeName, term.officeQid)}-${term.officeQid.toLowerCase()}`,
          type: "OTHER",
        },
        update: { name: officeName },
      });
      const already = await db.leadershipTerm.findFirst({
        where: { personId: entityId, officeId: office.id },
      });
      if (already) continue;
      await db.leadershipTerm.create({
        data: {
          personId: entityId,
          officeId: office.id,
          ordinal: term.ordinal,
          certainty: "PROBABLE",
          startDateId: term.start
            ? (await db.historicalDate.create({ data: dateData(term.start) })).id
            : null,
          endDateId: term.end
            ? (await db.historicalDate.create({ data: dateData(term.end) })).id
            : null,
        },
      });
      counts.terms += 1;
    }
  }
  return counts;
}

/** Record the licence and attribution of each entity's main image. No files are downloaded here. */
async function importMedia(deps: ImportDeps, items: ImportedEntity[], report: ImportReport) {
  if (!deps.commons) return;
  const withImage = items.filter((i) => i.imageFile);
  if (withImage.length === 0) return;

  let files: CommonsFile[];
  try {
    files = await deps.commons.getFiles(withImage.map((i) => i.imageFile!));
  } catch (error) {
    report.warnings.push({
      qid: "*",
      message: `Media metadata unavailable: ${error instanceof Error ? error.message : "error"}`,
    });
    return;
  }
  const byTitle = new Map(files.map((f) => [f.title.replace(/_/g, " "), f]));

  for (const item of withImage) {
    const file = byTitle.get(`File:${item.imageFile!.replace(/_/g, " ")}`);
    const entity = await deps.db.entity.findUnique({
      where: { wikidataId: item.qid },
      select: { id: true },
    });
    if (!file || !entity) {
      if (!file)
        report.warnings.push({
          qid: item.qid,
          message: `No Commons metadata for "${item.imageFile}".`,
        });
      continue;
    }
    const { license } = file;
    const licenseRow = await deps.db.mediaLicense.upsert({
      where: { code: license.code },
      create: {
        code: license.code,
        name: license.name,
        family: license.family,
        url: license.url,
        requiresAttribution: license.requiresAttribution,
        allowsCommercialUse: license.allowsCommercialUse,
        allowsDerivatives: license.allowsDerivatives,
        requiresShareAlike: license.requiresShareAlike,
        publishable: license.publishable,
      },
      update: {},
    });
    const data = {
      title: file.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
      description: file.description,
      creator: file.creator,
      sourceUrl: file.descriptionUrl,
      licenseId: licenseRow.id,
      attribution: file.attribution,
      mimeType: file.mimeType,
      width: file.width,
      height: file.height,
    };
    const asset = await deps.db.mediaAsset.upsert({
      where: { sourceName_sourceRef: { sourceName: "Wikimedia Commons", sourceRef: file.title } },
      // Whether this is a photograph, artwork or map is an editorial judgement, so it starts
      // UNCLASSIFIED and pending review.
      create: {
        ...data,
        kind: "UNCLASSIFIED",
        sourceName: "Wikimedia Commons",
        sourceRef: file.title,
      },
      update: data,
    });
    await deps.db.entityMedia.upsert({
      where: { entityId_mediaId: { entityId: entity.id, mediaId: asset.id } },
      create: { entityId: entity.id, mediaId: asset.id, role: "primary" },
      update: {},
    });
    report.media += 1;
  }
}

/**
 * Import Wikidata items as draft entities with full provenance.
 *
 * Idempotent: items are matched by their Wikidata id, so running it again updates rather than
 * duplicates. Nothing imported is published or marked verified; that is always a person's decision.
 */
export async function importFromWikidata(
  deps: ImportDeps,
  options: ImportOptions,
): Promise<ImportReport> {
  const { db, wikidata } = deps;
  const maxEntities = options.maxEntities ?? 60;

  const job = await db.productionJob.create({
    data: {
      type: "INGESTION",
      status: "RUNNING",
      startedAt: new Date(),
      requestedById: options.actor?.id ?? null,
      input: {
        source: "wikidata",
        seeds: options.seeds,
        followKin: options.followKin ?? 0,
        withMedia: !!options.withMedia,
      } as unknown as Prisma.InputJsonObject,
    },
  });
  const report: ImportReport = {
    jobId: job.id,
    created: [],
    updated: [],
    protectedFromOverwrite: [],
    claims: 0,
    relations: 0,
    kinships: 0,
    terms: 0,
    media: 0,
    failed: [],
    warnings: [],
  };

  try {
    // 1. Fetch and map, following family links breadth-first up to the configured depth.
    const mapped = new Map<string, ImportedEntity>();
    let frontier: ImportSeed[] = options.seeds;
    for (let depth = 0; depth <= (options.followKin ?? 0) && frontier.length > 0; depth++) {
      const next: ImportSeed[] = [];
      for (const seed of frontier) {
        if (mapped.has(seed.qid)) continue;
        if (mapped.size >= maxEntities) {
          report.warnings.push({
            qid: seed.qid,
            message: `Skipped: the limit of ${maxEntities} entities per run was reached.`,
          });
          continue;
        }
        try {
          const item = mapWikidataEntity(await wikidata.getEntity(seed.qid), seed.kind);
          mapped.set(item.qid, item);
          for (const message of item.warnings) report.warnings.push({ qid: item.qid, message });
          if (item.kind === "PERSON") {
            for (const kin of item.kinship) {
              const other = kin.fromQid === item.qid ? kin.toQid : kin.fromQid;
              next.push({ qid: other, kind: "PERSON" });
            }
          }
        } catch (error) {
          report.failed.push({
            qid: seed.qid,
            error: error instanceof Error ? error.message : "unknown error",
          });
        }
      }
      frontier = next;
    }
    const items = [...mapped.values()];

    // 2. Labels for referenced items (occupations, offices, places) so claims read in plain language.
    const referenced = items.flatMap((i) => [
      ...i.referencedQids,
      ...i.terms.map((t) => t.officeQid),
    ]);
    let labels = new Map<string, string>(items.map((i) => [i.qid, i.name]));
    try {
      labels = new Map([...(await wikidata.getLabels(referenced)), ...labels]);
    } catch (error) {
      report.warnings.push({
        qid: "*",
        message: `Labels unavailable; claims show Wikidata ids instead (${error instanceof Error ? error.message : "error"}).`,
      });
    }

    // 3. Write each entity atomically.
    for (const item of items) {
      try {
        const result = await db.$transaction((tx) => upsertEntity(tx, item, labels), {
          timeout: 30_000,
        });
        (result.created ? report.created : report.updated).push(item.qid);
        if (!result.overwritable) report.protectedFromOverwrite.push(item.qid);
        report.claims += result.claimCount;
      } catch (error) {
        report.failed.push({
          qid: item.qid,
          error: error instanceof Error ? error.message.split("\n").pop()! : "unknown error",
        });
      }
    }

    // 4. Link what was imported, then attach media metadata.
    const written = items.filter((i) => !report.failed.some((f) => f.qid === i.qid));
    Object.assign(report, await linkEntities(db, written, labels));
    if (options.withMedia) await importMedia(deps, written, report);

    await db.productionJob.update({
      where: { id: job.id },
      data: {
        status:
          report.failed.length > 0 && report.created.length + report.updated.length === 0
            ? "FAILED"
            : "SUCCEEDED",
        progress: 100,
        finishedAt: new Date(),
        output: report as unknown as Prisma.InputJsonObject,
        error: report.failed.length > 0 ? `${report.failed.length} item(s) failed` : null,
      },
    });
  } catch (error) {
    await db.productionJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : "unknown error",
      },
    });
    throw error;
  }

  log.info("wikidata import finished", {
    jobId: job.id,
    created: report.created.length,
    updated: report.updated.length,
    failed: report.failed.length,
  });
  await recordAudit({
    action: "ingestion.wikidata_import",
    actor: options.actor ?? { id: "system:cli", role: "SYSTEM" },
    target: { type: "production_job", id: job.id },
    metadata: {
      created: report.created.length,
      updated: report.updated.length,
      claims: report.claims,
      failed: report.failed.length,
    },
  });
  return report;
}
