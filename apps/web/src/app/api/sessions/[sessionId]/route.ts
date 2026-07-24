import { z } from "zod"

import {
  sessionById,
  transitionSession,
  updateSessionContext,
} from "@/lib/server/product-store"
import {
  authorizeOrganizerMutation,
  currentOrganizerSession,
  noStoreHeaders,
} from "@/lib/server/request-security"

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
  const session = sessionById(sessionId)
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
  const input = updateSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) {
    return Response.json(
      { error: input.error.issues[0]?.message ?? "Invalid session update." },
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
    if (input.data.operation === "transition") {
      transitionSession(session, input.data.action)
    } else {
      updateSessionContext(session, {
        glossary: input.data.glossary,
        notes: input.data.notes,
      })
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Session update failed.",
      },
      { status: 409, headers: noStoreHeaders() },
    )
  }
  return Response.json({ session }, { headers: noStoreHeaders() })
}
