import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"
import { reconcileRazorpayWebhook } from "@/lib/server/payments"

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, "razorpay-webhook", {
    limit: 180,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const signature = request.headers.get("x-razorpay-signature")
  const eventId = request.headers.get("x-razorpay-event-id")
  if (!signature || !eventId) {
    return Response.json(
      { error: "Required Razorpay webhook headers are missing." },
      { status: 400 },
    )
  }
  const rawBody = await request.text()
  try {
    const result = await reconcileRazorpayWebhook({
      rawBody,
      signature,
      eventId,
    })
    if (!result.accepted) {
      return Response.json(
        { error: "Webhook signature verification failed." },
        { status: 401 },
      )
    }
    return Response.json({ received: true })
  } catch {
    return Response.json(
      { error: "Webhook reconciliation failed." },
      { status: 500 },
    )
  }
}

