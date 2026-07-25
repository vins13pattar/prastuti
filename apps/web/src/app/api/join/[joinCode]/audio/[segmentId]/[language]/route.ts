import { get } from "@vercel/blob"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { captionSegments } from "@/db/schema"
import { getDatabase } from "@/db"
import { supportedLanguages } from "@/lib/product/types"
import { productRuntime } from "@/lib/runtime/product-runtime"
import {
  currentAttendeeSession,
  noStoreHeaders,
} from "@/lib/server/request-security"

type RouteContext = {
  params: Promise<{
    joinCode: string
    segmentId: string
    language: string
  }>
}

const languageSchema = z.enum(supportedLanguages)

export async function GET(_request: Request, context: RouteContext) {
  const attendee = await currentAttendeeSession()
  const parameters = await context.params
  if (
    !attendee ||
    attendee.joinCode !== parameters.joinCode.toUpperCase()
  ) {
    return Response.json(
      { error: "Join this session before requesting audio." },
      { status: 401, headers: noStoreHeaders() },
    )
  }
  if (productRuntime().mode !== "managed") {
    return Response.json(
      { error: "Shared audio is only available with managed providers." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  const language = languageSchema.safeParse(parameters.language)
  if (!language.success) {
    return Response.json(
      { error: "Unsupported audio language." },
      { status: 400, headers: noStoreHeaders() },
    )
  }
  const [segment] = await getDatabase()
    .select({ audioReferences: captionSegments.audioReferences })
    .from(captionSegments)
    .where(
      and(
        eq(captionSegments.id, parameters.segmentId),
        eq(captionSegments.sessionId, attendee.sessionId),
      ),
    )
    .limit(1)
  const pathname = segment?.audioReferences[language.data]
  if (!pathname) {
    return Response.json(
      { error: "Audio is not available for this caption." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  const blob = await get(pathname, { access: "private" })
  if (!blob) {
    return Response.json(
      { error: "Audio is no longer available." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  return new Response(blob.stream, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

