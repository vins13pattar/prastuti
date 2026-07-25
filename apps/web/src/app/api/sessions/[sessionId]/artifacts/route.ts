import { z } from "zod"

import {
  buildSessionArtifacts,
  sessionById,
} from "@/lib/server/product-repository"
import {
  currentOrganizerSession,
  noStoreHeaders,
} from "@/lib/server/request-security"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

const formatSchema = z.enum(["json", "txt", "vtt"])

function vttTimestamp(index: number) {
  const start = index * 4
  const end = start + 4
  const format = (seconds: number) =>
    `00:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
      seconds % 60,
    ).padStart(2, "0")}.000`
  return `${format(start)} --> ${format(end)}`
}

export async function GET(request: Request, context: RouteContext) {
  const organizer = await currentOrganizerSession()
  if (!organizer) {
    return Response.json(
      { error: "Organizer sign-in required." },
      { status: 401, headers: noStoreHeaders() },
    )
  }
  const { sessionId } = await context.params
  const session = await sessionById(sessionId)
  if (!session || session.organizationId !== organizer.identity.organizationId) {
    return Response.json(
      { error: "Session not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  if (session.status !== "completed") {
    return Response.json(
      { error: "Artifacts are available after the session ends." },
      { status: 409, headers: noStoreHeaders() },
    )
  }
  const format = formatSchema.safeParse(
    new URL(request.url).searchParams.get("format") ?? "json",
  )
  if (!format.success) {
    return Response.json(
      { error: "Choose json, txt, or vtt." },
      { status: 400, headers: noStoreHeaders() },
    )
  }
  const artifacts = buildSessionArtifacts(session)
  if (format.data === "json") {
    return Response.json(
      { session, artifacts },
      { headers: noStoreHeaders() },
    )
  }
  if (format.data === "vtt") {
    const captions = session.segments
      .map(
        (segment, index) =>
          `${index + 1}\n${vttTimestamp(index)}\n${segment.sourceText}`,
      )
      .join("\n\n")
    return new Response(`WEBVTT\n\n${captions}\n`, {
      headers: {
        ...noStoreHeaders(),
        "Content-Type": "text/vtt; charset=utf-8",
        "Content-Disposition": `attachment; filename="prastuti-${session.id}.vtt"`,
      },
    })
  }
  return new Response(
    `${session.name}\n\nSummary\n${artifacts.summary}\n\nTranscript\n${artifacts.transcript}\n`,
    {
      headers: {
        ...noStoreHeaders(),
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="prastuti-${session.id}.txt"`,
      },
    },
  )
}
