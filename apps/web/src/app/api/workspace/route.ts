import { workspaceSnapshot } from "@/lib/server/product-store"
import {
  currentOrganizerSession,
  noStoreHeaders,
} from "@/lib/server/request-security"

export async function GET() {
  const organizer = await currentOrganizerSession()
  if (!organizer) {
    return Response.json(
      { error: "Organizer sign-in required." },
      { status: 401, headers: noStoreHeaders() },
    )
  }
  return Response.json(workspaceSnapshot(organizer.identity), {
    headers: noStoreHeaders(),
  })
}
