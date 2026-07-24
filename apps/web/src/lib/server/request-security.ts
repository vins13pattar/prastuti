import "server-only"

import { cookies } from "next/headers"

import {
  attendeeSessionByToken,
  organizerSessionByToken,
} from "@/lib/server/product-store"

export const ORGANIZER_COOKIE = "prastuti_organizer"
export const ATTENDEE_COOKIE = "prastuti_attendee"

export async function currentOrganizerSession() {
  const cookieStore = await cookies()
  return organizerSessionByToken(cookieStore.get(ORGANIZER_COOKIE)?.value)
}

export async function currentAttendeeSession() {
  const cookieStore = await cookies()
  return attendeeSessionByToken(cookieStore.get(ATTENDEE_COOKIE)?.value)
}

export function noStoreHeaders() {
  return { "Cache-Control": "private, no-store" }
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  if (!origin || !host) return false
  try {
    const parsedOrigin = new URL(origin)
    return (
      ["http:", "https:"].includes(parsedOrigin.protocol) &&
      parsedOrigin.host === host
    )
  } catch {
    return false
  }
}

export async function authorizeOrganizerMutation(request: Request) {
  const session = await currentOrganizerSession()
  if (!session) return null
  if (!requireSameOrigin(request)) return null
  const csrfToken = request.headers.get("x-csrf-token")
  return csrfToken === session.csrfToken ? session : null
}

export async function authorizeAttendeeMutation(request: Request) {
  const session = await currentAttendeeSession()
  if (!session) return null
  if (!requireSameOrigin(request)) return null
  const csrfToken = request.headers.get("x-csrf-token")
  return csrfToken === session.csrfToken ? session : null
}
