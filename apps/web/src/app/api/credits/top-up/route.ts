import { z } from "zod"

import { creditExpiryFromLoadedAt } from "@/lib/credits"
import { productRuntime } from "@/lib/runtime/product-runtime"

const topUpSchema = z.object({
  credits: z.number().int().min(500).max(100000),
})

export async function POST(request: Request) {
  if (productRuntime().mode !== "mock") {
    return Response.json(
      { error: "The managed payment adapter is not configured." },
      { status: 501 },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = topUpSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: "Load between 500 and 100,000 credits." },
      { status: 400 },
    )
  }

  const loadedAt = new Date()

  return Response.json(
    {
      receipt: {
        id: crypto.randomUUID(),
        credits: parsed.data.credits,
        loadedAt: loadedAt.toISOString(),
        expiresAt: creditExpiryFromLoadedAt(loadedAt).toISOString(),
        status: "simulated",
      },
    },
    { status: 201 },
  )
}
