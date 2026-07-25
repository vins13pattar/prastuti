import { z } from "zod"

import { productRuntime } from "@/lib/runtime/product-runtime"
import { recordAuditEvent } from "@/lib/server/audit"
import { createRazorpayCheckout } from "@/lib/server/payments"
import { loadCredits } from "@/lib/server/product-repository"
import {
  authorizeOrganizerMutation,
  noStoreHeaders,
} from "@/lib/server/request-security"
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"

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
  const rateLimit = await checkRateLimit(request, "credit-top-up", {
    identifier: `credit-top-up:${organizer.identity.id}`,
    limit: 10,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)
  const body = await request.json().catch(() => null)
  const parsed = topUpSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: "Load between 500 and 100,000 credits." },
      { status: 400, headers: noStoreHeaders() },
    )
  }

  if (productRuntime().mode === "managed") {
    try {
      const checkout = await createRazorpayCheckout(
        organizer.identity,
        parsed.data.credits,
      )
      await recordAuditEvent({
        request,
        identity: organizer.identity,
        action: "payment.checkout_created",
        targetType: "payment_order",
        targetId: checkout.orderId,
        outcome: "succeeded",
        metadata: {
          credits: parsed.data.credits,
          amountMinor: checkout.amount,
        },
      })
      return Response.json(
        { checkout },
        { status: 201, headers: noStoreHeaders() },
      )
    } catch {
      return Response.json(
        {
          error:
            "Payment checkout is unavailable. Verify the payment provider and approved credit price configuration.",
        },
        { status: 503, headers: noStoreHeaders() },
      )
    }
  }

  const lot = await loadCredits(parsed.data.credits, organizer.identity)
  await recordAuditEvent({
    request,
    identity: organizer.identity,
    action: "credits.local_load",
    targetType: "credit_lot",
    targetId: lot.id,
    outcome: "succeeded",
    metadata: { credits: parsed.data.credits },
  })

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
