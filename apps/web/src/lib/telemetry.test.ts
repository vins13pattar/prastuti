import { describe, expect, it } from "vitest"

import {
  REDACTED_TELEMETRY_VALUE,
  sanitizeTelemetryAttributes,
} from "./telemetry"

describe("telemetry attributes", () => {
  it("redacts secrets and omits structured payloads", () => {
    const sanitized = sanitizeTelemetryAttributes({
      provider: "razorpay",
      authorization: "Bearer private-value",
      paymentSignature: "private-signature",
      rawBody: '{"customer":"private"}',
      nested: { accessToken: "private-token" },
    })
    const serialized = JSON.stringify(sanitized)

    expect(sanitized).toEqual({
      provider: "razorpay",
      authorization: REDACTED_TELEMETRY_VALUE,
      paymentSignature: REDACTED_TELEMETRY_VALUE,
      rawBody: REDACTED_TELEMETRY_VALUE,
    })
    expect(serialized).not.toContain("private-value")
    expect(serialized).not.toContain("private-signature")
    expect(serialized).not.toContain("private-token")
    expect(serialized).not.toContain("customer")
  })

  it("bounds attribute names, values, and cardinality", () => {
    const sanitized = sanitizeTelemetryAttributes({
      eventType: "order.paid\nforged-line",
      attempts: 2,
      accepted: true,
      invalid$key: "ignored",
      infinite: Number.POSITIVE_INFINITY,
      ...Object.fromEntries(
        Array.from({ length: 40 }, (_, index) => [
          `field.${index}`,
          "x".repeat(300),
        ]),
      ),
    })

    expect(Object.keys(sanitized)).toHaveLength(32)
    expect(sanitized.eventType).toBe("order.paid forged-line")
    expect(sanitized.attempts).toBe(2)
    expect(sanitized.accepted).toBe(true)
    expect(sanitized).not.toHaveProperty("invalid$key")
    expect(sanitized).not.toHaveProperty("infinite")
    expect(String(sanitized["field.0"])).toHaveLength(256)
  })
})
