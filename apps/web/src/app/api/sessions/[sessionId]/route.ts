import { z } from "zod"
import { start } from "workflow/api"

import { recordAuditEvent } from "@/lib/server/audit"
import {
  sessionById,
  transitionSession,
  updateSessionContext,
} from "@/lib/server/product-repository"
import {
  authorizeOrganizerMutation,
  currentOrganizerSession,
  noStoreHeaders,
} from "@/lib/server/request-security"
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"
import {
  markSessionFinalizationStarted,
  queueSessionFinalization,
} from "@/lib/server/post-session"
import { finalizeSessionWorkflow } from "@/workflows/session-finalization"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

const updateSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("transition"),
    action: z.enum(["start", "pause", "resume", "stop"]),
  }),
  z.object({
    operation: z.literal("context"),
    glossary: z
      .array(
        z.object({
          source: z.string().trim().min(1).max(120),
          preferred: z.string().trim().min(1).max(240),
        }),
      )
      .max(100),
    notes: z.string().trim().max(5000),
  }),
])

export async function GET(_request: Request, context: RouteContext) {
  const organizer = await currentOrganizerSession()
  if (!organizer) {
    return Response.json(
      { error: "Organizer sign-in required." },
      { status: 401, headers: noStoreHeaders() },
    )
  }
  const { sessionId } = await context.params
  const session = await sessionById(sessionId)
  if (!session || session.organizationId !== organizer.identity.organizationId) {
    return Response.json(
      { error: "Session not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  return Response.json({ session }, { headers: noStoreHeaders() })
}

export async function PATCH(request: Request, context: RouteContext) {
  const organizer = await authorizeOrganizerMutation(request)
  if (!organizer) {
    return Response.json(
      { error: "Organizer authorization failed." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  const rateLimit = await checkRateLimit(request, "session-update", {
    identifier: `session-update:${organizer.identity.id}`,
    limit: 120,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  const input = updateSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) {
    return Response.json(
      { error: input.error.issues[0]?.message ?? "Invalid session update." },
      { status: 400, headers: noStoreHeaders() },
    )
  }
  const { sessionId } = await context.params
  const session = await sessionById(sessionId)
  if (!session || session.organizationId !== organizer.identity.organizationId) {
    return Response.json(
      { error: "Session not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }

  try {
    if (input.data.operation === "transition") {
      await transitionSession(session, input.data.action)
    } else {
      await updateSessionContext(session, {
        glossary: input.data.glossary,
        notes: input.data.notes,
      })
    }
  } catch (error) {
    await recordAuditEvent({
      request,
      identity: organizer.identity,
      action:
        input.data.operation === "transition"
          ? `session.${input.data.action}`
          : "session.context_updated",
      targetType: "session",
      targetId: session.id,
      outcome: "failed",
    })
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Session update failed.",
      },
      { status: 409, headers: noStoreHeaders() },
    )
  }
  await recordAuditEvent({
    request,
    identity: organizer.identity,
    action:
      input.data.operation === "transition"
        ? `session.${input.data.action}`
        : "session.context_updated",
    targetType: "session",
    targetId: session.id,
    outcome: "succeeded",
  })
  let workflowRunId: string | null = null
  let finalizationStatus: "started" | "pending" | null = null
  if (
    input.data.operation === "transition" &&
    input.data.action === "stop"
  ) {
    await queueSessionFinalization(session.id).catch(() => undefined)
    try {
      const run = await start(finalizeSessionWorkflow, [session.id])
      workflowRunId = run.runId
      finalizationStatus = "started"
      await markSessionFinalizationStarted(session.id, run.runId).catch(
        () => undefined,
      )
    } catch {
      finalizationStatus = "pending"
      await recordAuditEvent({
        request,
        identity: organizer.identity,
        action: "session.finalization_enqueued",
        targetType: "session",
        targetId: session.id,
        outcome: "failed",
      })
    }
  }
  return Response.json(
    {
      session: await sessionById(session.id),
      workflowRunId,
      finalizationStatus,
    },
    { headers: noStoreHeaders() },
  )
}
