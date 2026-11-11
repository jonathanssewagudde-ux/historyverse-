import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { migrateTestDatabase, truncateAll, withTestClient } from "../tests/support/database";
import { testEnv, TEST_DATABASE_URL } from "../tests/support/test-env";

const MWANGA_KEY = "media/e2/e2e-king-mwanga-ii-buganda.jpg";
const MUTESA_KEY = "media/e2/e2e-restricted-licence.jpg";

/**
 * Start every e2e run from a migrated, empty test database with reference data, stand-ins for
 * imported Wikidata/Commons records, and the real Buganda article file loaded as a draft.
 */
export default async function globalSetup() {
  migrateTestDatabase();
  await truncateAll();
  const env = { ...process.env, ...testEnv, DATABASE_URL: TEST_DATABASE_URL };
  execFileSync("pnpm", ["db:seed"], { env, stdio: "pipe" });

  // One real image file in the test storage directory.
  const storage = path.resolve(testEnv.STORAGE_LOCAL_DIR);
  rmSync(storage, { recursive: true, force: true });
  mkdirSync(path.join(storage, path.dirname(MWANGA_KEY)), { recursive: true });
  copyFileSync("tests/fixtures/media/king-mwanga-ii-buganda.jpg", path.join(storage, MWANGA_KEY));
  // A stored file under a restrictive licence, to prove licensing (not storage) gates publication.
  copyFileSync("tests/fixtures/media/king-mwanga-ii-buganda.jpg", path.join(storage, MUTESA_KEY));

  await withTestClient(async (client) => {
    const entity = (id: string, kind: string, slug: string, name: string, qid: string) =>
      client.query(
        `INSERT INTO "entities" ("id","kind","slug","name","wikidataId","updatedAt") VALUES ($1,$2::"EntityKind",$3,$4,$5,now())`,
        [id, kind, slug, name, qid],
      );
    await entity("e2e-buganda", "KINGDOM", "buganda", "Buganda", "Q473748");
    await entity("e2e-uganda", "COUNTRY", "uganda", "Uganda", "Q1036");
    await entity("e2e-mutesa-i", "PERSON", "muteesa-i", "Muteesa I", "Q889311");

    const license = async (code: string) =>
      (
        await client.query<{ id: string }>(`SELECT "id" FROM "media_licenses" WHERE "code" = $1`, [
          code,
        ])
      ).rows[0]!.id;
    const media = (
      id: string,
      ref: string,
      licenseCode: Promise<string>,
      storageKey: string | null,
    ) =>
      licenseCode.then((licenseId) =>
        client.query(
          `INSERT INTO "media_assets" ("id","kind","title","sourceName","sourceRef","sourceUrl","attribution","licenseId","storageKey","mimeType","width","height","updatedAt")
           VALUES ($1,'UNCLASSIFIED',$2,'Wikimedia Commons',$3,$4,'Test attribution',$5,$6,'image/jpeg',480,480,now())`,
          [
            id,
            ref.replace("File:", "").replace(/\.[a-z]+$/i, ""),
            ref,
            `https://commons.wikimedia.org/wiki/${ref.replace(/ /g, "_")}`,
            licenseId,
            storageKey,
          ],
        ),
      );
    await media(
      "e2emediamwanga00000000001",
      "File:King Mwanga II Buganda.jpg",
      license("PD"),
      MWANGA_KEY,
    );
    // Non-commercial licence: must never be shown publicly.
    await media(
      "e2emediamutesa000000000001",
      "File:Mutesa I.jpg",
      license("CC-BY-NC-4.0"),
      MUTESA_KEY,
    );
  });

  execFileSync("pnpm", ["article:load", "data/articles/buganda-kingdom.json"], {
    env,
    stdio: "pipe",
  });
}
