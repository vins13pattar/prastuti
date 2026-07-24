import { z } from "zod"

import {
  correctSegment,
  sessionById,
} from "@/lib/server/product-store"
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
  const session = sessionById(sessionId)
  if (!session || session.organizationId !== organizer.identity.organizationId) {
    return Response.json(
      { error: "Session not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  const segment = correctSegment(session, segmentId, input.data.sourceText)
  if (!segment) {
    return Response.json(
      { error: "Caption segment not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  return Response.json({ segment, session }, { headers: noStoreHeaders() })
}
