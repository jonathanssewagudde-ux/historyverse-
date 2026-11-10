import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db/client";
import { createLogger, redact } from "@/server/logger";

const log = createLogger("audit");

export interface AuditEntry {
  /** Dotted verb, e.g. "user.registered", "user.role_changed", "article.published". */
  action: string;
  actor?: { id: string; email?: string | null; role?: string | null } | null;
  target?: { type: string; id: string };
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append an entry to the immutable audit log. Auditing must never break the action being audited,
 * so failures are logged and swallowed; the entry is also emitted to the application log.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const metadata = entry.metadata ? (redact(entry.metadata) as Prisma.InputJsonObject) : undefined;
  try {
    await getDb().auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actor?.id,
        actorEmail: entry.actor?.email ?? undefined,
        actorRole: entry.actor?.role ?? undefined,
        targetType: entry.target?.type,
        targetId: entry.target?.id,
        metadata,
        ipAddress: entry.ipAddress ?? undefined,
        userAgent: entry.userAgent?.slice(0, 500),
      },
    });
  } catch (error) {
    log.error("failed to write audit entry", {
      action: entry.action,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}
