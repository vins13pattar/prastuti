import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/server/rate-limit"
import { reconcileRazorpayWebhook } from "@/lib/server/payments"
import {
  recordOperationalEvent,
  withOperationalSpan,
} from "@/lib/server/telemetry"

export async function POST(request: Request) {
  return withOperationalSpan(
    "payment.webhook",
    { provider: "razorpay" },
    async () => {
      const startedAt = performance.now()
      const rateLimit = await checkRateLimit(request, "razorpay-webhook", {
        limit: 180,
        windowSeconds: 60,
      })
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

      const signature = request.headers.get("x-razorpay-signature")
      const eventId = request.headers.get("x-razorpay-event-id")
      if (!signature || !eventId) {
        recordOperationalEvent({
          event: "payment.webhook.rejected",
          level: "warn",
          outcome: "denied",
          request,
          attributes: {
            provider: "razorpay",
            reason: "missing_headers",
            statusCode: 400,
          },
        })
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
          recordOperationalEvent({
            event: "payment.webhook.rejected",
            level: "warn",
            outcome: "denied",
            request,
            attributes: {
              provider: "razorpay",
              reason: "invalid_signature",
              statusCode: 401,
              durationMs: Math.round(performance.now() - startedAt),
            },
          })
          return Response.json(
            { error: "Webhook signature verification failed." },
            { status: 401 },
          )
        }
        recordOperationalEvent({
          event: "payment.webhook.accepted",
          outcome: "succeeded",
          request,
          attributes: {
            provider: "razorpay",
            eventType: result.event,
            duplicate: "duplicate" in result && result.duplicate,
            ignored: "ignored" in result && result.ignored,
            durationMs: Math.round(performance.now() - startedAt),
          },
        })
        return Response.json({ received: true })
      } catch (error) {
        recordOperationalEvent({
          event: "payment.webhook.failed",
          level: "error",
          outcome: "failed",
          request,
          error,
          attributes: {
            provider: "razorpay",
            statusCode: 500,
            durationMs: Math.round(performance.now() - startedAt),
          },
        })
        return Response.json(
          { error: "Webhook reconciliation failed." },
          { status: 500 },
        )
      }
    },
  )
}
