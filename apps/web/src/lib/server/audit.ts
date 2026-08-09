import "server-only"

import { auditEvents } from "@/db/schema"
import { getDatabase } from "@/db"
import type { OrganizerIdentity } from "@/lib/product/types"
import { usesPostgresRepository } from "@/lib/server/product-repository"
import { recordOperationalEvent } from "@/lib/server/telemetry"

export type AuditEventInput = {
  request?: Request
  identity?: OrganizerIdentity
  action: string
  targetType?: string
  targetId?: string
  outcome: "succeeded" | "denied" | "failed"
  metadata?: Record<string, string | number | boolean | null>
}

export async function recordAuditEvent(input: AuditEventInput) {
  const requestId = input.request?.headers.get("x-prastuti-request-id")
  const event = {
    organizationId: input.identity?.organizationId,
    actorExternalId: input.identity?.id,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    requestId: requestId ?? undefined,
    outcome: input.outcome,
    metadata: input.metadata,
  }

  try {
    if (usesPostgresRepository()) {
      await getDatabase().insert(auditEvents).values(event)
    }

    recordOperationalEvent({
      event: "audit.recorded",
      request: input.request,
      outcome: input.outcome,
      attributes: {
        action: input.action,
        targetType: input.targetType,
        storage: usesPostgresRepository() ? "postgres" : "structured-log",
      },
    })
  } catch (error) {
    recordOperationalEvent({
      event: "audit.write_failed",
      level: "error",
      request: input.request,
      outcome: "failed",
      error,
      attributes: {
        action: input.action,
        targetType: input.targetType,
      },
    })
  }
}
