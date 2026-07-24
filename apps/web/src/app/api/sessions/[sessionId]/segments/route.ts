import { z } from "zod"

import {
  appendSegment,
  sessionById,
} from "@/lib/server/product-store"
import {
  authorizeOrganizerMutation,
  noStoreHeaders,
} from "@/lib/server/request-security"

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
  const session = sessionById(sessionId)
  if (!session || session.organizationId !== organizer.identity.organizationId) {
    return Response.json(
      { error: "Session not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  try {
    const segment = appendSegment(session, input.data.sourceText)
    return Response.json(
      { segment, session },
      { status: 201, headers: noStoreHeaders() },
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Caption failed." },
      { status: 409, headers: noStoreHeaders() },
    )
  }
}
