"use server";

import { recordAudit } from "@/server/audit";
import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { testIntegration, type ConnectionTestResult } from "@/server/integrations/connection-tests";
import { integrations } from "@/server/integrations/registry";

export type TestState =
  { ok: false; message: string } | { ok: true; result: ConnectionTestResult } | null;

/** Run one live connection test. Read-only and free; recorded in the audit log. */
export async function testIntegrationAction(
  _prev: TestState,
  formData: FormData,
): Promise<TestState> {
  try {
    const actor = await assertPermission("integration:view");
    const id = String(formData.get("integrationId") ?? "");
    if (!integrations.some((i) => i.id === id))
      return { ok: false, message: "Unknown integration." };
    const result = await testIntegration(id);
    await recordAudit({
      action: "integration.tested",
      actor,
      target: { type: "integration", id },
      metadata: { status: result.status, latencyMs: result.latencyMs },
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { ok: false, message: "You do not have permission to do that." };
    return { ok: false, message: "The test could not be run." };
  }
}
