import { describe, expect, it } from "vitest"

import { productRuntime } from "./product-runtime"

describe("product runtime", () => {
  it("defaults to infrastructure-free mock mode outside production", () => {
    const runtime = productRuntime({ NODE_ENV: "development" })

    expect(runtime.mode).toBe("mock")
    expect(runtime.infrastructureFree).toBe(true)
    expect(runtime.readyForCurrentMode).toBe(true)
    expect(runtime.integrations.every(({ adapter }) => adapter === "deterministic-mock")).toBe(true)
  })

  it("defaults to managed mode in production and fails closed", () => {
    const runtime = productRuntime({ NODE_ENV: "production" })

    expect(runtime.mode).toBe("managed")
    expect(runtime.readyForCurrentMode).toBe(false)
    expect(runtime.missingForManagedDeployment).toContain("DATABASE_URL")
    expect(runtime.missingForManagedDeployment).toContain(
      "PAYMENT_WEBHOOK_SECRET",
    )
  })

  it("never returns configured secret values", () => {
    const runtime = productRuntime({
      PRASTUTI_RUNTIME_MODE: "managed",
      DATABASE_URL: "secret-database-value",
      PAYMENT_WEBHOOK_SECRET: "secret-payment-value",
    })
    const serialized = JSON.stringify(runtime)

    expect(serialized).not.toContain("secret-database-value")
    expect(serialized).not.toContain("secret-payment-value")
  })

  it("rejects unknown runtime modes", () => {
    expect(() =>
      productRuntime({ PRASTUTI_RUNTIME_MODE: "unsafe" }),
    ).toThrow("PRASTUTI_RUNTIME_MODE must be one of")
  })
})
