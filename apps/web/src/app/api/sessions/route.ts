import { z } from "zod"

import { supportedLanguages } from "@/lib/product/types"
import {
  createProductSession,
  workspaceSnapshot,
} from "@/lib/server/product-store"
import {
  authorizeOrganizerMutation,
  currentOrganizerSession,
  noStoreHeaders,
} from "@/lib/server/request-security"

const createSessionSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    sourceLanguage: z.enum(supportedLanguages),
    targetLanguages: z.array(z.enum(supportedLanguages)).min(1).max(3),
    expectedMinutes: z.number().int().min(1).max(480),
    translatedAudio: z.boolean(),
  })
  .refine(
    (input) => !input.targetLanguages.includes(input.sourceLanguage),
    "The source language cannot also be a target language.",
  )
  .refine(
    (input) => new Set(input.targetLanguages).size === input.targetLanguages.length,
    "Target languages must be unique.",
  )

export async function GET() {
  const organizer = await currentOrganizerSession()
  if (!organizer) {
    return Response.json(
      { error: "Organizer sign-in required." },
      { status: 401, headers: noStoreHeaders() },
    )
  }
  const snapshot = workspaceSnapshot(organizer.identity)
  return Response.json(
    { sessions: snapshot.sessions },
    { headers: noStoreHeaders() },
  )
}

export async function POST(request: Request) {
  const organizer = await authorizeOrganizerMutation(request)
  if (!organizer) {
    return Response.json(
      { error: "Organizer authorization failed." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  const input = createSessionSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!input.success) {
    return Response.json(
      { error: input.error.issues[0]?.message ?? "Invalid session details." },
      { status: 400, headers: noStoreHeaders() },
    )
  }
  const session = createProductSession(input.data)
  return Response.json({ session }, { status: 201, headers: noStoreHeaders() })
}
