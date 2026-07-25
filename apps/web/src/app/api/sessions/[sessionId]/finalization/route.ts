import { start } from "workflow/api"

import { recordAuditEvent } from "@/lib/server/audit"
import {
  markSessionFinalizationStarted,
  queueSessionFinalization,
} from "@/lib/server/post-session"
import { sessionById } from "@/lib/server/product-repository"
import {
  authorizeOrganizerMutation,
  noStoreHeaders,
} from "@/lib/server/request-security"
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"
import { finalizeSessionWorkflow } from "@/workflows/session-finalization"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const organizer = await authorizeOrganizerMutation(request)
  if (!organizer) {
    return Response.json(
      { error: "Organizer authorization failed." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  const rateLimit = await checkRateLimit(request, "session-finalization", {
    identifier: `session-finalization:${organizer.identity.id}`,
    limit: 10,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const { sessionId } = await context.params
  const session = await sessionById(sessionId)
  if (
    !session ||
    session.organizationId !== organizer.identity.organizationId
  ) {
    return Response.json(
      { error: "Session not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  if (session.status !== "completed") {
    return Response.json(
      { error: "Only completed sessions can be finalized." },
      { status: 409, headers: noStoreHeaders() },
    )
  }

  await queueSessionFinalization(session.id).catch(() => undefined)
  try {
    const run = await start(finalizeSessionWorkflow, [session.id])
    await markSessionFinalizationStarted(session.id, run.runId).catch(
      () => undefined,
    )
    await recordAuditEvent({
      request,
      identity: organizer.identity,
      action: "session.finalization_enqueued",
      targetType: "session",
      targetId: session.id,
      outcome: "succeeded",
      metadata: { workflowRunId: run.runId },
    })
    return Response.json(
      { finalizationStatus: "started", workflowRunId: run.runId },
      { status: 202, headers: noStoreHeaders() },
    )
  } catch {
    await recordAuditEvent({
      request,
      identity: organizer.identity,
      action: "session.finalization_enqueued",
      targetType: "session",
      targetId: session.id,
      outcome: "failed",
    })
    return Response.json(
      {
        error:
          "Finalization is pending because the workflow service is unavailable.",
        finalizationStatus: "pending",
      },
      { status: 503, headers: noStoreHeaders() },
    )
  }
}
