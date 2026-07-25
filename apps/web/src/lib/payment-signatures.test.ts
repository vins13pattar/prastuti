import { createHmac } from "node:crypto"

import { describe, expect, it } from "vitest"

import { verifyHmacSha256 } from "./payment-signatures"

describe("payment webhook signatures", () => {
  it("accepts an exact HMAC SHA-256 signature", () => {
    const body = '{"event":"order.paid"}'
    const signature = createHmac("sha256", "test-secret")
      .update(body)
      .digest("hex")
    expect(verifyHmacSha256(body, signature, "test-secret")).toBe(true)
  })

  it("rejects changed bodies and malformed signatures", () => {
    const signature = createHmac("sha256", "test-secret")
      .update("original")
      .digest("hex")
    expect(verifyHmacSha256("changed", signature, "test-secret")).toBe(false)
    expect(verifyHmacSha256("original", "short", "test-secret")).toBe(false)
  })
})

