import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { chronologicalSortKey, type HistoricalDate } from "@/lib/history/dates";
import { getDb } from "@/server/db/client";

/**
 * These tests prove that the database itself refuses invalid or unsafe states, independently of
 * application code. Each assertion maps to a rule in DATABASE.md / EDITORIAL_POLICY.md.
 */

let db: PrismaClient;
let licenseId: string;
let userId: string;

const dateRow = (d: HistoricalDate) => ({
  year: d.year,
  month: d.month,
  day: d.day,
  precision: d.precision.toUpperCase() as
    "YEAR" | "MONTH" | "DAY" | "DECADE" | "CENTURY" | "MILLENNIUM",
  approximate: d.approximate ?? false,
  sortKey: BigInt(chronologicalSortKey(d)),
});

beforeAll(async () => {
  db = getDb();
  const license = await db.mediaLicense.upsert({
    where: { code: "TEST-PD" },
    create: {
      code: "TEST-PD",
      name: "Test public domain",
      family: "PUBLIC_DOMAIN",
      publishable: true,
    },
    update: {},
  });
  licenseId = license.id;
  const user = await db.user.create({
    data: { id: "constraints-user", name: "Constraint Tester", email: "constraints@test.invalid" },
  });
  userId = user.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("historical dates", () => {
  it("stores valid dates and orders BCE before CE by sort key", async () => {
    const dates: HistoricalDate[] = [
      { year: 1962, month: 10, day: 9, precision: "day" },
      { year: -44, month: 3, day: 15, precision: "day" },
      { year: 1300, precision: "year", approximate: true },
      { year: -500, precision: "century" },
    ];
    const created = await Promise.all(
      dates.map((d) => db.historicalDate.create({ data: dateRow(d) })),
    );
    const ordered = await db.historicalDate.findMany({
      where: { id: { in: created.map((c) => c.id) } },
      orderBy: { sortKey: "asc" },
      select: { year: true },
    });
    expect(ordered.map((o) => o.year)).toEqual([-500, -44, 1300, 1962]);
  });

  it("rejects year zero", async () => {
    await expect(
      db.historicalDate.create({ data: { year: 0, precision: "YEAR", sortKey: 0n } }),
    ).rejects.toThrow(/historical_dates_no_year_zero/);
  });

  it("rejects a day on a year-precision date (no false precision)", async () => {
    await expect(
      db.historicalDate.create({
        data: { year: 1884, month: 10, day: 21, precision: "YEAR", sortKey: 1n },
      }),
    ).rejects.toThrow(/historical_dates_(month|day)_matches_precision/);
  });

  it("rejects day precision without a day, and out-of-range months", async () => {
    await expect(
      db.historicalDate.create({ data: { year: 1884, month: 10, precision: "DAY", sortKey: 1n } }),
    ).rejects.toThrow(/historical_dates_day_matches_precision/);
    await expect(
      db.historicalDate.create({
        data: { year: 1884, month: 13, precision: "MONTH", sortKey: 1n },
      }),
    ).rejects.toThrow(/historical_dates_month_range/);
  });
});

describe("entities", () => {
  it("enforces unique slugs per kind but allows the same slug across kinds", async () => {
    await db.entity.create({ data: { kind: "KINGDOM", slug: "test-realm", name: "Test Realm" } });
    await expect(
      db.entity.create({ data: { kind: "KINGDOM", slug: "test-realm", name: "Duplicate" } }),
    ).rejects.toThrow(/Unique constraint/i);
    await expect(
      db.entity.create({
        data: { kind: "COUNTRY", slug: "test-realm", name: "Same slug, other kind" },
      }),
    ).resolves.toBeTruthy();
  });

  it("rejects malformed slugs and self-referencing relations", async () => {
    await expect(
      db.entity.create({ data: { kind: "TOPIC", slug: "Not A Slug", name: "Bad" } }),
    ).rejects.toThrow(/entities_slug_format/);

    const entity = await db.entity.create({
      data: { kind: "TOPIC", slug: "self-ref", name: "Self" },
    });
    await expect(
      db.entityRelation.create({
        data: { fromId: entity.id, toId: entity.id, type: "RELATED_TO" },
      }),
    ).rejects.toThrow(/entity_relations_no_self_reference/);
  });

  it("supports the entity → state → kingdom specialisation chain", async () => {
    const entity = await db.entity.create({
      data: {
        kind: "KINGDOM",
        slug: "specialisation-check",
        name: "Specialisation Check",
        historicalState: {
          create: {
            polityType: "KINGDOM",
            continent: "AFRICA",
            kingdom: { create: { rulerTitle: "Test title" } },
          },
        },
      },
      include: { historicalState: { include: { kingdom: true } } },
    });
    expect(entity.historicalState?.kingdom?.rulerTitle).toBe("Test title");
    // Deleting the entity removes its detail rows.
    await db.entity.delete({ where: { id: entity.id } });
    expect(await db.kingdom.count({ where: { stateId: entity.id } })).toBe(0);
  });

  it("requires paired, in-range coordinates and a source for any geometry", async () => {
    const mk = (slug: string) => db.entity.create({ data: { kind: "LOCATION", slug, name: slug } });
    const a = await mk("loc-a");
    await expect(
      db.location.create({ data: { entityId: a.id, type: "CITY", latitude: 95, longitude: 10 } }),
    ).rejects.toThrow(/locations_latitude_range/);
    await expect(
      db.location.create({ data: { entityId: a.id, type: "CITY", latitude: 0.3 } }),
    ).rejects.toThrow(/locations_coordinates_paired/);
    await expect(
      db.location.create({
        data: { entityId: a.id, type: "REGION", geometry: { type: "Point", coordinates: [0, 0] } },
      }),
    ).rejects.toThrow(/locations_geometry_has_source/);
  });
});

describe("media licensing and AI reconstruction labelling", () => {
  const asset = (kind: "AUTHENTIC_PHOTO" | "AI_RECONSTRUCTION", ref: string) =>
    db.mediaAsset.create({
      data: {
        kind,
        title: ref,
        sourceName: "Test archive",
        sourceRef: ref,
        attribution: "Test",
        licenseId,
      },
    });

  it("refuses to delete a licence that assets depend on", async () => {
    await asset("AUTHENTIC_PHOTO", "licence-dependency");
    await expect(db.mediaLicense.delete({ where: { id: licenseId } })).rejects.toThrow();
  });

  it("only lets a reconstruction record attach to media labelled AI_RECONSTRUCTION", async () => {
    const photo = await asset("AUTHENTIC_PHOTO", "authentic-1");
    await expect(
      db.aIReconstruction.create({ data: { prompt: "p", mediaId: photo.id } }),
    ).rejects.toThrow(/must have kind AI_RECONSTRUCTION/);

    const generated = await asset("AI_RECONSTRUCTION", "generated-1");
    await expect(
      db.aIReconstruction.create({ data: { prompt: "p", mediaId: generated.id } }),
    ).resolves.toBeTruthy();
  });

  it("never lets an AI reconstruction be relabelled as authentic", async () => {
    const generated = await asset("AI_RECONSTRUCTION", "generated-2");
    await db.aIReconstruction.create({ data: { prompt: "p", mediaId: generated.id } });
    await expect(
      db.mediaAsset.update({ where: { id: generated.id }, data: { kind: "AUTHENTIC_PHOTO" } }),
    ).rejects.toThrow(/cannot be relabelled/);
  });
});

describe("publication safeguards", () => {
  it("blocks publishing an article that contains unreviewed AI text", async () => {
    await expect(
      db.article.create({
        data: {
          slug: "ai-draft-published",
          title: "t",
          status: "PUBLISHED",
          publishedAt: new Date(),
          containsUnreviewedAi: true,
        },
      }),
    ).rejects.toThrow(/articles_no_unreviewed_ai_when_public/);
  });

  it("requires a publication timestamp on public articles", async () => {
    await expect(
      db.article.create({ data: { slug: "no-published-at", title: "t", status: "PUBLISHED" } }),
    ).rejects.toThrow(/articles_public_has_published_at/);
    await expect(
      db.article.create({ data: { slug: "draft-ok", title: "t", containsUnreviewedAi: true } }),
    ).resolves.toBeTruthy();
  });

  it("requires a recorded approver before a schedule is approved", async () => {
    const article = await db.article.create({ data: { slug: "schedule-target", title: "t" } });
    await expect(
      db.publicationSchedule.create({
        data: { articleId: article.id, scheduledFor: new Date(), status: "APPROVED" },
      }),
    ).rejects.toThrow(/publication_schedules_approval_recorded/);
    await expect(
      db.publicationSchedule.create({
        data: {
          articleId: article.id,
          scheduledFor: new Date(),
          status: "APPROVED",
          approvedById: userId,
          approvedAt: new Date(),
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("requires exactly one target for schedules, reviews and translations", async () => {
    await expect(
      db.publicationSchedule.create({ data: { scheduledFor: new Date() } }),
    ).rejects.toThrow(/publication_schedules_exactly_one_target/);
    await expect(db.editorialReview.create({ data: { stage: "RESEARCH_REVIEW" } })).rejects.toThrow(
      /editorial_reviews_exactly_one_target/,
    );
    await expect(
      db.translation.create({ data: { locale: "fr", field: "title", value: "x" } }),
    ).rejects.toThrow(/translations_exactly_one_target/);
  });

  it("only marks a claim verified when a verifier is recorded", async () => {
    await expect(
      db.historicalClaim.create({ data: { statement: "s", verification: "VERIFIED" } }),
    ).rejects.toThrow(/historical_claims_verification_recorded/);
    const claim = await db.historicalClaim.create({ data: { statement: "s", origin: "AI_DRAFT" } });
    expect(claim.verification).toBe("UNVERIFIED");
  });

  it("keeps a YouTube video private until a real video id exists", async () => {
    const documentary = await db.documentary.create({ data: { slug: "doc-yt", title: "d" } });
    const channel = await db.youTubeChannel.create({
      data: { channelId: "UC-test", title: "Test" },
    });
    const base = {
      documentaryId: documentary.id,
      channelId: channel.id,
      title: "t",
      description: "d",
    };
    await expect(db.youTubeVideo.create({ data: { ...base, privacy: "PUBLIC" } })).rejects.toThrow(
      /youtube_videos_public_needs_video_id/,
    );
    const video = await db.youTubeVideo.create({ data: base });
    expect(video.privacy).toBe("PRIVATE");
  });
});

describe("audit log", () => {
  it("is append-only: updates and deletes are rejected by the database", async () => {
    const entry = await db.auditLog.create({ data: { action: "test.event", actorId: userId } });
    await expect(
      db.auditLog.update({ where: { id: entry.id }, data: { action: "tampered" } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    expect((await db.auditLog.findUnique({ where: { id: entry.id } }))?.action).toBe("test.event");
  });

  it("survives deletion of the user it refers to", async () => {
    const temp = await db.user.create({
      data: { id: "temp-user", name: "Temp", email: "temp@test.invalid" },
    });
    const entry = await db.auditLog.create({
      data: { action: "test.temp", actorId: temp.id, actorEmail: temp.email },
    });
    await db.user.delete({ where: { id: temp.id } });
    expect((await db.auditLog.findUnique({ where: { id: entry.id } }))?.actorEmail).toBe(
      "temp@test.invalid",
    );
  });
});
