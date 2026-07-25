import { z } from "zod"

import { estimateCredits } from "@/lib/credits"
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"

const quoteSchema = z.object({
  minutes: z.number().int().min(1).max(480),
  targetLanguages: z.number().int().min(1).max(3),
  translatedAudio: z.boolean(),
  presentationContext: z.boolean(),
  postSessionSummary: z.boolean(),
})

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "credit-quote", {
    limit: 30,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  const body = await request.json().catch(() => null)
  const parsed = quoteSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      {
        error: "Check the duration and language selection.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }

  return Response.json({
    quote: estimateCredits(parsed.data),
    rateCard: "sample-workspace-v1",
  })
}
