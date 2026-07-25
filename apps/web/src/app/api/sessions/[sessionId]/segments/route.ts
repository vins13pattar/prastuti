import { z } from "zod"

import { recordAuditEvent } from "@/lib/server/audit"
import {
  appendSegment,
  sessionById,
} from "@/lib/server/product-repository"
import {
  authorizeOrganizerMutation,
  noStoreHeaders,
} from "@/lib/server/request-security"
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

const segmentSchema = z.object({
  sourceText: z.string().trim().min(1).max(2000).optional(),
})

export async function POST(request: Request, context: RouteContext) {
  const organizer = await authorizeOrganizerMutation(request)
  if (!organizer) {
    return Response.json(
      { error: "Organizer authorization failed." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  const rateLimit = await checkRateLimit(request, "caption-segment", {
    identifier: `caption-segment:${organizer.identity.id}`,
    limit: 240,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  const input = segmentSchema.safeParse(
    await request.json().catch(() => ({})),
  )
  if (!input.success) {
    return Response.json(
      { error: input.error.issues[0]?.message ?? "Invalid caption segment." },
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
    const segment = await appendSegment(session, input.data.sourceText)
    await recordAuditEvent({
      request,
      identity: organizer.identity,
      action: "caption.created",
      targetType: "caption_segment",
      targetId: segment.id,
      outcome: "succeeded",
      metadata: { sessionId: session.id },
    })
    return Response.json(
      { segment, session: await sessionById(session.id) },
      { status: 201, headers: noStoreHeaders() },
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Caption failed." },
      { status: 409, headers: noStoreHeaders() },
    )
  }
}
