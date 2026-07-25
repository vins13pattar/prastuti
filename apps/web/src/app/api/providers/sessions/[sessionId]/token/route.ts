import {
  issueAblyToken,
  issueAzureSpeechToken,
} from "@/lib/server/managed-media"
import { sessionById } from "@/lib/server/product-repository"
import {
  authorizeAttendeeMutation,
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

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params
  const session = await sessionById(sessionId)
  if (!session || !["live", "paused"].includes(session.status)) {
    return Response.json(
      { error: "The live session is unavailable." },
      { status: 404, headers: noStoreHeaders() },
    )
  }

  const organizer = await authorizeOrganizerMutation(request)
  const attendee = organizer ? null : await authorizeAttendeeMutation(request)
  const isOrganizer =
    organizer?.identity.organizationId === session.organizationId
  const isAttendee = attendee?.sessionId === session.id
  if (!isOrganizer && !isAttendee) {
    return Response.json(
      { error: "Session access is required." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  const role = isOrganizer ? "presenter" : "attendee"
  const clientId = isOrganizer
    ? organizer.identity.id
    : (attendee?.attendeeId ?? "")
  const rateLimit = await checkRateLimit(request, "provider-token", {
    identifier: `provider-token:${role}:${clientId}`,
    limit: 20,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  try {
    const realtime = await issueAblyToken({
      sessionId,
      clientId,
      role,
    })
    const speech = isOrganizer ? await issueAzureSpeechToken() : null
    return Response.json(
      { role, realtime, speech },
      { headers: noStoreHeaders() },
    )
  } catch {
    return Response.json(
      { error: "Managed live providers are unavailable." },
      { status: 503, headers: noStoreHeaders() },
    )
  }
}
