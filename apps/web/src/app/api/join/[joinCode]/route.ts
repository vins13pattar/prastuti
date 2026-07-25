import { cookies } from "next/headers"

import {
  createAttendeeSession,
  sessionByJoinCode,
} from "@/lib/server/product-repository"
import {
  ATTENDEE_COOKIE,
  noStoreHeaders,
  requireSameOrigin,
} from "@/lib/server/request-security"
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"

type RouteContext = {
  params: Promise<{ joinCode: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { joinCode } = await context.params
  const session = await sessionByJoinCode(joinCode)
  if (!session) {
    return Response.json(
      { error: "This session could not be found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  return Response.json(
    {
      session: {
        name: session.name,
        joinCode: session.joinCode,
        sourceLanguage: session.sourceLanguage,
        targetLanguages: session.targetLanguages,
        status: session.status,
      },
    },
    { headers: noStoreHeaders() },
  )
}

export async function POST(request: Request, context: RouteContext) {
  const rateLimit = await checkRateLimit(request, "attendee-join", {
    limit: 30,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  if (!requireSameOrigin(request)) {
    return Response.json(
      { error: "The join request must come from this application." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  const { joinCode } = await context.params
  const result = await createAttendeeSession(joinCode)
  if (!result) {
    return Response.json(
      { error: "This session is not accepting attendees yet." },
      { status: 409, headers: noStoreHeaders() },
    )
  }
  const cookieStore = await cookies()
  cookieStore.set(ATTENDEE_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 6 * 60 * 60,
  })
  return Response.json(
    {
      attendeeId: result.attendee.attendeeId,
      sessionId: result.attendee.sessionId,
      csrfToken: result.attendee.csrfToken,
    },
    { status: 201, headers: noStoreHeaders() },
  )
}
