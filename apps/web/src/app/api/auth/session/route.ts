import { cookies } from "next/headers"

import { productRuntime } from "@/lib/runtime/product-runtime"
import {
  CSRF_COOKIE,
  currentOrganizerSession,
  noStoreHeaders,
} from "@/lib/server/request-security"

export async function GET() {
  let session = await currentOrganizerSession()
  if (!session) {
    return Response.json(
      { error: "No active organizer session." },
      { status: 401, headers: noStoreHeaders() },
    )
  }
  if (productRuntime().mode === "managed" && !session.csrfToken) {
    const csrfToken = crypto.randomUUID().replaceAll("-", "")
    const cookieStore = await cookies()
    cookieStore.set(CSRF_COOKIE, csrfToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60,
    })
    session = { ...session, csrfToken }
  }
  return Response.json(
    {
      identity: session.identity,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    },
    { headers: noStoreHeaders() },
  )
}
