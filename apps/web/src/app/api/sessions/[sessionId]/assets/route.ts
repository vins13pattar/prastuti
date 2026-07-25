import { recordAuditEvent } from "@/lib/server/audit"
import { ingestPresentationAsset } from "@/lib/server/presentation-assets"
import { sessionById } from "@/lib/server/product-repository"
import {
  authorizeOrganizerMutation,
  noStoreHeaders,
} from "@/lib/server/request-security"
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const organizer = await authorizeOrganizerMutation(request)
  if (!organizer) {
    return Response.json(
      { error: "Organizer authorization failed." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  const rateLimit = await checkRateLimit(request, "presentation-upload", {
    identifier: `presentation-upload:${organizer.identity.id}`,
    limit: 10,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const { sessionId } = await context.params
  const session = await sessionById(sessionId)
  if (
    !session ||
    session.organizationId !== organizer.identity.organizationId
  ) {
    return Response.json(
      { error: "Session not found." },
      { status: 404, headers: noStoreHeaders() },
    )
  }
  if (session.status !== "draft") {
    return Response.json(
      { error: "Presentation context can only be changed before starting." },
      { status: 409, headers: noStoreHeaders() },
    )
  }
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return Response.json(
      { error: "Choose a presentation file to upload." },
      { status: 400, headers: noStoreHeaders() },
    )
  }

  try {
    const asset = await ingestPresentationAsset({
      file,
      identity: organizer.identity,
      sessionId,
    })
    await recordAuditEvent({
      request,
      identity: organizer.identity,
      action: "presentation.uploaded",
      targetType: "presentation_asset",
      targetId: asset.id,
      outcome: "succeeded",
      metadata: {
        sessionId,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
      },
    })
    return Response.json(
      { asset },
      { status: 201, headers: noStoreHeaders() },
    )
  } catch (error) {
    await recordAuditEvent({
      request,
      identity: organizer.identity,
      action: "presentation.uploaded",
      targetType: "session",
      targetId: sessionId,
      outcome: "failed",
    })
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Presentation upload failed.",
      },
      { status: 422, headers: noStoreHeaders() },
    )
  }
}

