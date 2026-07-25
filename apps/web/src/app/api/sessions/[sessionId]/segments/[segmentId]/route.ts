import { z } from "zod"

import { recordAuditEvent } from "@/lib/server/audit"
import {
  correctSegment,
  sessionById,
} from "@/lib/server/product-repository"
import {
  authorizeOrganizerMutation,
  noStoreHeaders,
} from "@/lib/server/request-security"

type RouteContext = {
  params: Promise<{ sessionId: string; segmentId: string }>
}

const correctionSchema = z.object({
  sourceText: z.string().trim().min(1).max(2000),
})

export async function PATCH(request: Request, context: RouteContext) {
  const organizer = await authorizeOrganizerMutation(request)
  if (!organizer) {
    return Response.json(
      { error: "Organizer authorization failed." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  const input = correctionSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!input.success) {
    return Response.json(
      { error: input.error.issues[0]?.message ?? "Invalid correction." },
      { status: 400, headers: noStoreHeaders() },
    )
  }
  const { sessionId, segmentId } = await context.params
  const session = await sessionById(sessionId)
  if (!session || session.organizationId !== organizer.identity.organizationId) {
    return Response.json(
      { error: "Session not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  const segment = await correctSegment(
    session,
    segmentId,
    input.data.sourceText,
  )
  if (!segment) {
    return Response.json(
      { error: "Caption segment not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  await recordAuditEvent({
    request,
    identity: organizer.identity,
    action: "caption.corrected",
    targetType: "caption_segment",
    targetId: segment.id,
    outcome: "succeeded",
    metadata: { sessionId: session.id },
  })
  return Response.json(
    { segment, session: await sessionById(session.id) },
    { headers: noStoreHeaders() },
  )
}
