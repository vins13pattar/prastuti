import { z } from "zod"

import { recordAuditEvent } from "@/lib/server/audit"
import { verifyRazorpayCheckout } from "@/lib/server/payments"
import {
  authorizeOrganizerMutation,
  noStoreHeaders,
} from "@/lib/server/request-security"

const verificationSchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/i),
})

export async function POST(request: Request) {
  const organizer = await authorizeOrganizerMutation(request)
  if (!organizer) {
    return Response.json(
      { error: "Organizer authorization failed." },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  const input = verificationSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!input.success) {
    return Response.json(
      { error: "The checkout response is invalid." },
      { status: 400, headers: noStoreHeaders() },
    )
  }
  const verified = await verifyRazorpayCheckout({
    identity: organizer.identity,
    orderId: input.data.razorpay_order_id,
    paymentId: input.data.razorpay_payment_id,
    signature: input.data.razorpay_signature,
  })
  await recordAuditEvent({
    request,
    identity: organizer.identity,
    action: "payment.checkout_verified",
    targetType: "payment_order",
    targetId: input.data.razorpay_order_id,
    outcome: verified ? "succeeded" : "denied",
  })
  return Response.json(
    verified
      ? { status: "pending_webhook_reconciliation" }
      : { error: "The checkout signature could not be verified." },
    { status: verified ? 202 : 400, headers: noStoreHeaders() },
  )
}

