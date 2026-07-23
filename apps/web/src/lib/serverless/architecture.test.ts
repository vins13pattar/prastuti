import { describe, expect, it } from "vitest"

import {
  SERVERLESS_COMPONENTS,
  serverlessReadiness,
} from "./architecture"

describe("serverless architecture", () => {
  it("contains no Prastuti-owned always-on runtime", () => {
    const technologies = SERVERLESS_COMPONENTS.map(
      (component) => component.technology,
    ).join(" ")

    expect(technologies).not.toMatch(/ECS|Kubernetes|dedicated Node/i)
  })

  it("reports missing deployment integrations without revealing secrets", () => {
    const readiness = serverlessReadiness({
      DATABASE_URL: "secret-database-value",
      REALTIME_PROVIDER_URL: "secret-realtime-value",
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.configured).toBe(2)
    expect(readiness.missing).toContain("PAYMENT_WEBHOOK_SECRET")
    expect(JSON.stringify(readiness)).not.toContain("secret-database-value")
    expect(JSON.stringify(readiness)).not.toContain("secret-realtime-value")
  })
})
