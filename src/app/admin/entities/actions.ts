"use server";

import { refresh } from "next/cache";

import { isRole } from "@/lib/auth/roles";
import { decideClaim, EntityAdminError, updateEntitySummary } from "@/server/admin/entities";
import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { importFromWikidata } from "@/server/ingestion/wikidata-import";
import { createWikimediaSources } from "@/server/sources";
import { isQid } from "@/server/sources/wikidata/client";
import type { ImportKind } from "@/server/sources/wikidata/mapper";

export type EntityActionState = { ok: boolean; message: string; entityIds?: string[] } | null;

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof EntityAdminError) return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was changed." };
}

export async function claimDecisionAction(
  _prev: EntityActionState,
  formData: FormData,
): Promise<EntityActionState> {
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "VERIFIED" && decision !== "REJECTED" && decision !== "UNVERIFIED") {
    return { ok: false, message: "Unknown decision." };
  }
  try {
    const actor = await assertPermission("claim:verify");
    await decideClaim(getDb(), actor, String(formData.get("claimId") ?? ""), decision);
    refresh();
    return {
      ok: true,
      message:
        decision === "VERIFIED"
          ? "Claim verified."
          : decision === "REJECTED"
            ? "Claim rejected."
            : "Claim returned to unverified.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function entitySummaryAction(
  _prev: EntityActionState,
  formData: FormData,
): Promise<EntityActionState> {
  try {
    const actor = await assertPermission("entity:edit");
    await updateEntitySummary(
      getDb(),
      actor,
      String(formData.get("entityId") ?? ""),
      String(formData.get("summary") ?? ""),
    );
    refresh();
    return { ok: true, message: "Summary saved." };
  } catch (error) {
    return failure(error);
  }
}

const IMPORT_KINDS = new Set<ImportKind>([
  "COUNTRY",
  "TERRITORY",
  "HISTORICAL_STATE",
  "KINGDOM",
  "EMPIRE",
  "CIVILIZATION",
  "DYNASTY",
  "PERSON",
  "EVENT",
  "PERIOD",
]);

/** Import one Wikidata item (and its main image's licence metadata) as an unreviewed draft. */
export async function importEntityAction(
  _prev: EntityActionState,
  formData: FormData,
): Promise<EntityActionState> {
  const qid = String(formData.get("qid") ?? "")
    .trim()
    .toUpperCase();
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isQid(qid)) return { ok: false, message: "Enter a Wikidata id such as Q1036." };
  const kind =
    kindRaw && IMPORT_KINDS.has(kindRaw as ImportKind) ? (kindRaw as ImportKind) : undefined;
  try {
    const actor = await assertPermission("entity:edit");
    const sources = createWikimediaSources();
    const report = await importFromWikidata(
      { db: getDb(), wikidata: sources.wikidata, commons: sources.commons },
      {
        seeds: [{ qid, kind }],
        maxEntities: 1,
        withMedia: true,
        actor: { id: actor.id, email: actor.email, role: isRole(actor.role) ? actor.role : null },
      },
    );
    if (report.failed.length > 0) {
      return { ok: false, message: `Import failed: ${report.failed[0]!.error}` };
    }
    refresh();
    const verb = report.created.length > 0 ? "Imported" : "Updated";
    const protectedNote =
      report.protectedFromOverwrite.length > 0
        ? " Fields already under review were left unchanged."
        : "";
    return {
      ok: true,
      message: `${verb} ${qid}: ${report.claims} claim(s) as unverified drafts.${protectedNote}`,
    };
  } catch (error) {
    if (error instanceof Error && /fetch|network|ECONN|timed out|429/i.test(error.message)) {
      return { ok: false, message: `Wikidata could not be reached: ${error.message}` };
    }
    return failure(error);
  }
}
