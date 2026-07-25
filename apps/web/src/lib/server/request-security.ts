import "server-only"

import { auth } from "@clerk/nextjs/server"
import { cookies } from "next/headers"

import {
  organizerSessionByToken,
} from "@/lib/server/product-store"
import {
  attendeeSessionByToken,
  prepareOrganizerWorkspace,
  validateAttendeeCsrf,
} from "@/lib/server/product-repository"
import { ensureOrganizerIdentity } from "@/lib/server/postgres-product-repository"
import { productRuntime } from "@/lib/runtime/product-runtime"

export const ORGANIZER_COOKIE = "prastuti_organizer"
export const ATTENDEE_COOKIE = "prastuti_attendee"
export const CSRF_COOKIE = "prastuti_csrf"

export async function currentOrganizerSession() {
  const cookieStore = await cookies()
  if (productRuntime().mode === "mock") {
    const session = organizerSessionByToken(
      cookieStore.get(ORGANIZER_COOKIE)?.value,
    )
    if (!session) return null
    return {
      ...session,
      identity: await prepareOrganizerWorkspace(session.identity),
    }
  }

  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    return null
  }

  const authentication = await auth()
  if (!authentication.userId) return null
  const claims = authentication.sessionClaims as Record<string, unknown>
  const externalOrganizationId =
    authentication.orgId ?? `personal:${authentication.userId}`
  const displayName =
    typeof claims.name === "string" ? claims.name : "Organizer"
  const workspaceName =
    typeof claims.org_name === "string"
      ? claims.org_name
      : typeof claims.organization_name === "string"
        ? claims.organization_name
        : "My Prastuti workspace"
  const identity = await ensureOrganizerIdentity({
    externalOrganizationId,
    externalUserId: authentication.userId,
    displayName,
    workspaceName,
    role:
      typeof claims.org_role === "string" ? claims.org_role : "owner",
  })
  return {
    token: authentication.sessionId ?? "managed",
    csrfToken: cookieStore.get(CSRF_COOKIE)?.value ?? "",
    identity,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  }
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
  if (!requireSameOrigin(request)) return null
  const csrfToken = request.headers.get("x-csrf-token")
  const cookieStore = await cookies()
  const token = cookieStore.get(ATTENDEE_COOKIE)?.value
  if (!(await validateAttendeeCsrf(token, csrfToken))) return null
  return attendeeSessionByToken(token)
}
