import {
  currentOrganizerSession,
  noStoreHeaders,
} from "@/lib/server/request-security"

export async function GET() {
  const session = await currentOrganizerSession()
  if (!session) {
    return Response.json(
      { error: "No active organizer session." },
      { status: 401, headers: noStoreHeaders() },
    )
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
