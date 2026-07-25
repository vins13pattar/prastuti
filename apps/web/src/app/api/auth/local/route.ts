import { cookies } from "next/headers"

import { productRuntime } from "@/lib/runtime/product-runtime"
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"
import { createLocalOrganizerSession } from "@/lib/server/product-store"
import {
  noStoreHeaders,
  ORGANIZER_COOKIE,
  requireSameOrigin,
} from "@/lib/server/request-security"

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "local-sign-in", {
    limit: 10,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  if (productRuntime().mode !== "mock") {
    return Response.json(
      { error: "Local sign-in is disabled outside mock mode." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  if (!requireSameOrigin(request)) {
    return Response.json(
      { error: "The sign-in request must come from this application." },
      { status: 403, headers: noStoreHeaders() },
    )
  }

  const localSession = createLocalOrganizerSession()
  const cookieStore = await cookies()
  cookieStore.set(ORGANIZER_COOKIE, localSession.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  })

  return Response.json(
    { identity: localSession.identity },
    { status: 201, headers: noStoreHeaders() },
  )
}
