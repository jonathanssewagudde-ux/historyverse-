import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  decideClaim,
  getEntityDetail,
  listEntities,
  updateEntitySummary,
} from "@/server/admin/entities";
import {
  imageSize,
  reviewMedia,
  sniffImageType,
  updateMedia,
  uploadMedia,
} from "@/server/admin/media";
import { deleteCategory, saveCategory } from "@/server/admin/categories";
import { getReviewQueue, resolveCorrection, submitCorrection } from "@/server/admin/reviews";
import { listSources, updateSource } from "@/server/admin/sources";
import { getDb } from "@/server/db/client";
import { createLocalStorage } from "@/server/storage/local";

let db: PrismaClient;
const editor = { id: "studio-editor", email: "editor@studio.invalid", role: "EDITOR" as const };
const researcher = {
  id: "studio-researcher",
  email: "researcher@studio.invalid",
  role: "RESEARCHER" as const,
};
let entityId: string;
let cited: string;
let uncited: string;

beforeAll(async () => {
  db = getDb();
  await db.user.createMany({
    data: [
      { id: editor.id, name: "Studio Editor", email: editor.email, role: "EDITOR" },
      { id: researcher.id, name: "Studio Researcher", email: researcher.email, role: "RESEARCHER" },
    ],
    skipDuplicates: true,
  });
  const entity = await db.entity.create({
    data: {
      kind: "KINGDOM",
      slug: "studio-buganda",
      name: "Buganda",
      wikidataId: "Q473748",
      aliases: { create: [{ name: "Kingdom of Buganda", type: "ALTERNATIVE" }] },
    },
  });
  await db.entity.create({ data: { kind: "PERSON", slug: "studio-person", name: "Muteesa I" } });
  entityId = entity.id;
  const source = await db.source.create({
    data: {
      type: "DATASET",
      title: "Wikidata: Buganda (Q473748)",
      url: "https://www.wikidata.org/wiki/Q473748",
    },
  });
  cited = (
    await db.historicalClaim.create({
      data: {
        entityId,
        statement: "Buganda is a subnational kingdom within Uganda.",
        origin: "IMPORT",
        citations: { create: [{ sourceId: source.id }] },
      },
    })
  ).id;
  uncited = (
    await db.historicalClaim.create({
      data: { entityId, statement: "A claim with no source.", origin: "HUMAN" },
    })
  ).id;
});

describe("entity managers", () => {
  it("lists only the manager's kinds and searches names, aliases and Wikidata ids", async () => {
    expect((await listEntities(db, "kingdoms")).map((e) => e.name)).toEqual(["Buganda"]);
    expect((await listEntities(db, "people")).map((e) => e.name)).toEqual(["Muteesa I"]);
    expect(await listEntities(db, "kingdoms", "kingdom of")).toHaveLength(1);
    expect(await listEntities(db, "kingdoms", "q473748")).toHaveLength(1);
    expect(await listEntities(db, "kingdoms", "Rwanda")).toHaveLength(0);
    const [row] = await listEntities(db, "kingdoms");
    expect(row).toMatchObject({ claims: 2, unverified: 2 });
  });

  it("lets editors verify a cited claim, records who did it, and audits it", async () => {
    await decideClaim(db, editor, cited, "VERIFIED");
    const claim = await db.historicalClaim.findUniqueOrThrow({ where: { id: cited } });
    expect(claim).toMatchObject({ verification: "VERIFIED", verifiedById: editor.id });
    const audit = await db.auditLog.findFirst({
      where: { action: "claim.verified", targetId: cited },
    });
    expect(audit?.actorId).toBe(editor.id);
    const detail = await getEntityDetail(db, entityId);
    expect(detail!.claims.find((c) => c.id === cited)).toMatchObject({
      verifiedBy: "Studio Editor",
      sources: [{ title: "Wikidata: Buganda (Q473748)" }],
    });
  });

  it("refuses to verify a claim without a source, and refuses researchers", async () => {
    await expect(decideClaim(db, editor, uncited, "VERIFIED")).rejects.toThrow(
      /without a cited source/,
    );
    await expect(decideClaim(db, researcher, cited, "REJECTED")).rejects.toThrow(/Only editors/);
    await decideClaim(db, editor, uncited, "REJECTED");
    await decideClaim(db, editor, cited, "UNVERIFIED");
    expect(await db.historicalClaim.findUniqueOrThrow({ where: { id: cited } })).toMatchObject({
      verification: "UNVERIFIED",
      verifiedById: null,
    });
  });

  it("edits the summary with an audited before/after", async () => {
    await updateEntitySummary(db, researcher, entityId, "  A kingdom of the Baganda people.  ");
    expect((await db.entity.findUniqueOrThrow({ where: { id: entityId } })).summary).toBe(
      "A kingdom of the Baganda people.",
    );
    await expect(updateEntitySummary(db, researcher, entityId, "x".repeat(601))).rejects.toThrow(
      /under 600/,
    );
    const audit = await db.auditLog.findFirst({ where: { action: "entity.summary_updated" } });
    expect(audit?.metadata).toMatchObject({ after: "A kingdom of the Baganda people." });
  });
});

describe("media library", () => {
  const jpeg = new Uint8Array(readFileSync("tests/fixtures/media/king-mwanga-ii-buganda.jpg"));
  const storage = createLocalStorage(mkdtempSync(path.join(tmpdir(), "hv-media-")));
  let pd: string;
  let nc: string;
  let uploaded: string;

  beforeAll(async () => {
    pd = (
      await db.mediaLicense.upsert({
        where: { code: "PD" },
        create: { code: "PD", name: "Public domain", family: "PUBLIC_DOMAIN", publishable: true },
        update: {},
      })
    ).id;
    nc = (
      await db.mediaLicense.upsert({
        where: { code: "CC-BY-NC-4.0" },
        create: { code: "CC-BY-NC-4.0", name: "CC BY-NC 4.0", family: "CC_BY_NC" },
        update: {},
      })
    ).id;
  });

  it("recognises images by their bytes, not their claimed type", () => {
    expect(sniffImageType(jpeg)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(imageSize(jpeg, "image/jpeg")).toEqual({ width: 376, height: 480 });
  });

  const input = {
    title: "King Mwanga II",
    kind: "UNCLASSIFIED",
    attribution: "Unknown engraver",
    altText: "",
    sourceName: "Test archive",
    sourceUrl: "",
  };

  it("stores an upload as a pending asset and refuses duplicates and non-images", async () => {
    uploaded = await uploadMedia(db, storage, researcher, { ...input, body: jpeg, licenseId: pd });
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: uploaded } });
    expect(asset).toMatchObject({
      reviewStatus: "PENDING",
      mimeType: "image/jpeg",
      width: 376,
      uploadedById: researcher.id,
    });
    expect(await storage.get(asset.storageKey!)).toEqual(jpeg);
    await expect(
      uploadMedia(db, storage, researcher, { ...input, body: jpeg, licenseId: pd }),
    ).rejects.toThrow(/already in the library/);
    await expect(
      uploadMedia(db, storage, researcher, {
        ...input,
        body: new TextEncoder().encode("hello"),
        licenseId: pd,
      }),
    ).rejects.toThrow(/Only JPEG, PNG/);
    await expect(
      uploadMedia(db, storage, researcher, {
        ...input,
        body: jpeg,
        licenseId: pd,
        sourceUrl: "javascript:alert(1)",
      }),
    ).rejects.toThrow(/not a valid web address/);
  });

  it("approves only classified, described, publishable images, and only for editors", async () => {
    await expect(reviewMedia(db, researcher, uploaded, "APPROVED")).rejects.toThrow(/Only editors/);
    await expect(reviewMedia(db, editor, uploaded, "APPROVED")).rejects.toThrow(
      /not yet classified/,
    );
    const edit = {
      title: "King Mwanga II",
      kind: "ARTWORK",
      altText: "",
      description: "",
      attribution: "Unknown engraver",
      licenseId: pd,
    };
    await updateMedia(db, researcher, uploaded, edit);
    await expect(reviewMedia(db, editor, uploaded, "APPROVED")).rejects.toThrow(/alt text/);
    await updateMedia(db, researcher, uploaded, {
      ...edit,
      altText: "Engraved portrait of a seated king",
    });
    await reviewMedia(db, editor, uploaded, "APPROVED");
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: uploaded } })).reviewStatus).toBe(
      "APPROVED",
    );

    // Changing the licence sends it back to review, and a non-publishable licence blocks approval.
    await updateMedia(db, researcher, uploaded, {
      ...edit,
      altText: "Engraved portrait of a seated king",
      licenseId: nc,
    });
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: uploaded } })).reviewStatus).toBe(
      "PENDING",
    );
    await expect(reviewMedia(db, editor, uploaded, "APPROVED")).rejects.toThrow(
      /does not allow publication/,
    );
    expect(await db.auditLog.count({ where: { targetId: uploaded } })).toBeGreaterThanOrEqual(4);
  });
});

describe("references", () => {
  const base = {
    type: "DATASET",
    title: "Wikidata: Buganda (Q473748)",
    authors: "",
    publisher: "Wikimedia Foundation",
    publishedYear: "",
    url: "https://www.wikidata.org/wiki/Q473748",
    archiveUrl: "",
    isbn: "",
    doi: "",
    accessedAt: "2026-05-01",
    reliabilityNote: "Crowd-sourced; check against published works.",
  };

  it("lists sources with their usage and corrects them with validation", async () => {
    const [row] = await listSources(db, "buganda (q473748)");
    expect(row).toMatchObject({ citations: 1, claims: 1 });
    await updateSource(db, researcher, row!.id, base);
    expect((await db.source.findUniqueOrThrow({ where: { id: row!.id } })).publisher).toBe(
      "Wikimedia Foundation",
    );
    await expect(
      updateSource(db, researcher, row!.id, { ...base, publishedYear: "0" }),
    ).rejects.toThrow(/no year 0/);
    await expect(
      updateSource(db, researcher, row!.id, { ...base, url: "ftp://x" }),
    ).rejects.toThrow(/valid web address/);
    await expect(updateSource(db, researcher, row!.id, { ...base, doi: "nope" })).rejects.toThrow(
      /DOI/,
    );
    await expect(updateSource(db, { ...researcher, role: "USER" }, row!.id, base)).rejects.toThrow(
      /cannot edit/,
    );
  });
});

describe("reader corrections", () => {
  const reader = { id: "studio-reader", email: "reader@studio.invalid", role: "USER" as const };
  let published: string;
  let draft: string;

  beforeAll(async () => {
    await db.user.create({ data: { id: reader.id, name: "Rea Der", email: reader.email } });
    const base = { template: "KINGDOM" as const, primaryEntityId: entityId, locale: "en" };
    published = (
      await db.article.create({
        data: {
          ...base,
          slug: "studio-published",
          title: "Published",
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      })
    ).id;
    draft = (await db.article.create({ data: { ...base, slug: "studio-draft", title: "Draft" } }))
      .id;
  });

  const report = {
    message: "The 1894 date should be 1900 according to the agreement text.",
    evidenceUrl: "",
  };

  it("accepts reports on published articles only, with validation", async () => {
    const id = await submitCorrection(db, reader, { ...report, articleId: published });
    expect((await db.correctionRequest.findUniqueOrThrow({ where: { id } })).status).toBe("OPEN");
    await expect(submitCorrection(db, reader, { ...report, articleId: draft })).rejects.toThrow(
      /not found/,
    );
    await expect(
      submitCorrection(db, reader, { ...report, message: "wrong", articleId: published }),
    ).rejects.toThrow(/Describe what is wrong/);
    await expect(
      submitCorrection(db, reader, {
        ...report,
        evidenceUrl: "javascript:alert(1)",
        articleId: published,
      }),
    ).rejects.toThrow(/valid web address/);
  });

  it("shows reports in the queue until an editor resolves them", async () => {
    const queue = await getReviewQueue(db);
    expect(queue.corrections).toHaveLength(1);
    expect(queue.corrections[0]).toMatchObject({
      reporter: "Rea Der",
      article: { title: "Published" },
    });
    const id = queue.corrections[0]!.id;
    await expect(resolveCorrection(db, researcher, id, "ACCEPTED", "Checked")).rejects.toThrow(
      /Only editors/,
    );
    await expect(resolveCorrection(db, editor, id, "ACCEPTED", "")).rejects.toThrow(
      /Say what was decided/,
    );
    await resolveCorrection(
      db,
      editor,
      id,
      "ACCEPTED",
      "Checked against the 1900 agreement; fixed.",
    );
    await expect(resolveCorrection(db, editor, id, "DECLINED", "again")).rejects.toThrow(
      /already been resolved/,
    );
    expect((await getReviewQueue(db)).corrections).toHaveLength(0);
  });
});

describe("categories", () => {
  it("creates nested categories, refuses loops, and deletes only unused ones", async () => {
    const parent = await saveCategory(db, editor, {
      name: "East Africa",
      description: "",
      parentId: "",
    });
    const child = await saveCategory(db, editor, {
      name: "Great Lakes kingdoms",
      description: "",
      parentId: parent,
    });
    expect((await db.category.findUniqueOrThrow({ where: { id: child } })).slug).toBe(
      "great-lakes-kingdoms",
    );
    await expect(
      saveCategory(db, editor, {
        id: parent,
        name: "East Africa",
        description: "",
        parentId: child,
      }),
    ).rejects.toThrow(/inside itself/);
    await expect(
      saveCategory(db, editor, { name: "East Africa", description: "", parentId: "" }),
    ).rejects.toThrow(/already exists/);
    await expect(
      saveCategory(db, researcher, { name: "Nope", description: "", parentId: "" }),
    ).rejects.toThrow(/Only editors/);

    // Renaming keeps the address.
    await saveCategory(db, editor, {
      id: child,
      name: "Interlacustrine kingdoms",
      description: "",
      parentId: parent,
    });
    expect((await db.category.findUniqueOrThrow({ where: { id: child } })).slug).toBe(
      "great-lakes-kingdoms",
    );

    await db.article.update({
      where: { slug: "studio-published" },
      data: { categories: { connect: [{ id: child }] } },
    });
    await expect(deleteCategory(db, editor, child)).rejects.toThrow(/still used by 1 article/);
    await expect(deleteCategory(db, editor, parent)).rejects.toThrow(/1 subcategor/);
    await db.article.update({
      where: { slug: "studio-published" },
      data: { categories: { set: [] } },
    });
    await deleteCategory(db, editor, child);
    await deleteCategory(db, editor, parent);
    expect(await db.category.count({ where: { id: { in: [parent, child] } } })).toBe(0);
  });
});
