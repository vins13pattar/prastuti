import {
  buildSessionArtifacts,
  sessionById,
} from "@/lib/server/product-store"
import {
  currentAttendeeSession,
  noStoreHeaders,
} from "@/lib/server/request-security"

type RouteContext = {
  params: Promise<{ joinCode: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const attendee = await currentAttendeeSession()
  const { joinCode } = await context.params
  if (!attendee || attendee.joinCode !== joinCode.toUpperCase()) {
    return Response.json(
      { error: "Join this session before requesting captions." },
      { status: 401, headers: noStoreHeaders() },
    )
  }
  const session = sessionById(attendee.sessionId)
  if (!session) {
    return Response.json(
      { error: "This session is no longer available." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  return Response.json(
    {
      session: {
        name: session.name,
        status: session.status,
        sourceLanguage: session.sourceLanguage,
        targetLanguages: session.targetLanguages,
        segments: session.segments,
        endedAt: session.endedAt,
        artifacts:
          session.status === "completed"
            ? buildSessionArtifacts(session)
            : null,
      },
    },
    { headers: noStoreHeaders() },
  )
}
