import { describe, expect, it } from "vitest"

import {
  SERVERLESS_COMPONENTS,
} from "./architecture"

describe("serverless architecture", () => {
  it("contains no Prastuti-owned always-on runtime", () => {
    const technologies = SERVERLESS_COMPONENTS.map(
      (component) => component.technology,
    ).join(" ")

    expect(technologies).not.toMatch(/ECS|Kubernetes|dedicated Node/i)
  })
})
