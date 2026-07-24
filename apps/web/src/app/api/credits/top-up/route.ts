import { z } from "zod"

import { productRuntime } from "@/lib/runtime/product-runtime"
import { loadCredits } from "@/lib/server/product-store"
import {
  authorizeOrganizerMutation,
  noStoreHeaders,
} from "@/lib/server/request-security"

const topUpSchema = z.object({
  credits: z.number().int().min(500).max(100000),
})

export async function POST(request: Request) {
  const organizer = await authorizeOrganizerMutation(request)
  if (!organizer) {
    return Response.json(
      { error: "Organizer authorization failed." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  if (productRuntime().mode !== "mock") {
    return Response.json(
      { error: "The managed payment adapter is not configured." },
      { status: 501, headers: noStoreHeaders() },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = topUpSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: "Load between 500 and 100,000 credits." },
      { status: 400, headers: noStoreHeaders() },
    )
  }

  const lot = loadCredits(parsed.data.credits)

  return Response.json(
    {
      receipt: {
        id: crypto.randomUUID(),
        credits: parsed.data.credits,
        loadedAt: lot.loadedAt,
        expiresAt: lot.expiresAt,
        status: "simulated",
      },
    },
    { status: 201, headers: noStoreHeaders() },
  )
}
