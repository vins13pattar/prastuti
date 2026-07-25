import "server-only"

import { createHash } from "node:crypto"

import { and, eq, sql } from "drizzle-orm"
import Razorpay from "razorpay"
import { z } from "zod"

import { paymentOrders, providerEvents } from "@/db/schema"
import { getDatabase } from "@/db"
import { verifyHmacSha256 } from "@/lib/payment-signatures"
import type { OrganizerIdentity } from "@/lib/product/types"

const webhookSchema = z.object({
  event: z.string().min(1).max(120),
  payload: z.record(z.string(), z.unknown()),
})

const paidOrderSchema = z.object({
  order: z.object({
    entity: z.object({
      id: z.string().min(1),
      amount: z.number().int().positive(),
      currency: z.string().length(3),
    }),
  }),
  payment: z.object({
    entity: z.object({
      id: z.string().min(1),
      order_id: z.string().min(1),
      amount: z.number().int().positive(),
      currency: z.string().length(3),
      status: z.string(),
    }),
  }),
})

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for managed payments.`)
  return value
}

export async function createRazorpayCheckout(
  identity: OrganizerIdentity,
  credits: number,
) {
  const keyId = requiredEnvironment("NEXT_PUBLIC_RAZORPAY_KEY_ID")
  const keySecret = requiredEnvironment("RAZORPAY_KEY_SECRET")
  const creditPricePaise = Number(requiredEnvironment("CREDIT_PRICE_PAISE"))
  if (
    !Number.isSafeInteger(creditPricePaise) ||
    creditPricePaise <= 0 ||
    creditPricePaise > 10_000
  ) {
    throw new Error("CREDIT_PRICE_PAISE must be an integer from 1 to 10000.")
  }
  const amount = credits * creditPricePaise
  if (!Number.isSafeInteger(amount) || amount > 100_000_000) {
    throw new Error("The requested credit load exceeds the checkout limit.")
  }
  const receipt = `prst_${crypto.randomUUID().replaceAll("-", "")}`
  const client = new Razorpay({ key_id: keyId, key_secret: keySecret })
  const order = await client.orders.create({
    amount,
    currency: "INR",
    receipt,
    notes: {
      organization_id: identity.organizationId,
      credits: String(credits),
    },
  })
  await getDatabase().insert(paymentOrders).values({
    organizationId: identity.organizationId,
    provider: "razorpay",
    providerOrderId: order.id,
    receipt,
    credits,
    amountMinor: Number(order.amount),
    currency: order.currency,
  })
  return {
    provider: "razorpay" as const,
    key: keyId,
    orderId: order.id,
    receipt,
    amount: Number(order.amount),
    currency: order.currency,
    credits,
    creditPricePaise,
  }
}

export async function verifyRazorpayCheckout(input: {
  identity: OrganizerIdentity
  orderId: string
  paymentId: string
  signature: string
}) {
  const secret = requiredEnvironment("RAZORPAY_KEY_SECRET")
  if (
    !verifyHmacSha256(
      `${input.orderId}|${input.paymentId}`,
      input.signature,
      secret,
    )
  ) {
    return false
  }
  const db = getDatabase()
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.provider, "razorpay"),
        eq(paymentOrders.providerOrderId, input.orderId),
        eq(paymentOrders.organizationId, input.identity.organizationId),
      ),
    )
    .limit(1)
  if (!order) return false
  await db
    .update(paymentOrders)
    .set({
      status: "client_verified",
      providerPaymentId: input.paymentId,
    })
    .where(eq(paymentOrders.id, order.id))
  return true
}

async function recordReviewEvent(input: {
  eventId: string
  eventType: string
  payloadHash: string
  orderId?: string
}) {
  const db = getDatabase()
  const inserted = await db
    .insert(providerEvents)
    .values({
      provider: "razorpay",
      providerEventId: input.eventId,
      eventType: input.eventType,
      payloadHash: input.payloadHash,
      status: "manual_review",
    })
    .onConflictDoNothing()
    .returning()
  if (inserted.length === 0) return false
  if (input.orderId) {
    await db
      .update(paymentOrders)
      .set({ status: "review_required" })
      .where(
        and(
          eq(paymentOrders.provider, "razorpay"),
          eq(paymentOrders.providerOrderId, input.orderId),
        ),
      )
  }
  return true
}

export async function reconcileRazorpayWebhook(input: {
  rawBody: string
  signature: string
  eventId: string
}) {
  const secret = requiredEnvironment("PAYMENT_WEBHOOK_SECRET")
  if (!verifyHmacSha256(input.rawBody, input.signature, secret)) {
    return { accepted: false, reason: "invalid_signature" } as const
  }
  const parsedJson: unknown = JSON.parse(input.rawBody)
  const event = webhookSchema.parse(parsedJson)
  const payloadHash = createHash("sha256")
    .update(input.rawBody)
    .digest("hex")

  if (event.event === "order.paid") {
    const paid = paidOrderSchema.parse(event.payload)
    if (
      paid.order.entity.id !== paid.payment.entity.order_id ||
      paid.order.entity.amount !== paid.payment.entity.amount ||
      paid.order.entity.currency !== paid.payment.entity.currency ||
      !["captured", "authorized"].includes(paid.payment.entity.status)
    ) {
      throw new Error("Razorpay paid-order payload is inconsistent.")
    }
    const result = await getDatabase().execute(
      sql`select process_razorpay_order_paid(
        ${input.eventId},
        ${event.event},
        ${payloadHash},
        ${paid.order.entity.id},
        ${paid.payment.entity.id},
        ${paid.order.entity.amount}::integer,
        ${paid.order.entity.currency}
      )`,
    )
    return { accepted: true, event: event.event, result } as const
  }

  const entityPayload = event.payload as {
    payment?: { entity?: { order_id?: string } }
    refund?: { entity?: { order_id?: string } }
  }
  const orderId =
    entityPayload.payment?.entity?.order_id ??
    entityPayload.refund?.entity?.order_id
  const reviewEvents = new Set([
    "refund.processed",
    "payment.dispute.created",
    "payment.dispute.won",
    "payment.dispute.lost",
  ])
  if (reviewEvents.has(event.event)) {
    const processed = await recordReviewEvent({
      eventId: input.eventId,
      eventType: event.event,
      payloadHash,
      orderId,
    })
    return {
      accepted: true,
      event: event.event,
      duplicate: !processed,
    } as const
  }

  const processed = await recordReviewEvent({
    eventId: input.eventId,
    eventType: event.event,
    payloadHash,
  })
  return {
    accepted: true,
    event: event.event,
    ignored: true,
    duplicate: !processed,
  } as const
}
