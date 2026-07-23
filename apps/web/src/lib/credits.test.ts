import { describe, expect, it } from "vitest"

import {
  allocateCreditLots,
  creditExpiryFromLoadedAt,
  estimateCredits,
} from "./credits"

describe("estimateCredits", () => {
  it("quotes a multilingual audio session from each enabled meter", () => {
    const quote = estimateCredits({
      minutes: 60,
      targetLanguages: 3,
      translatedAudio: true,
      presentationContext: true,
      postSessionSummary: true,
    })

    expect(quote).toEqual({
      sourceCaptions: 120,
      translation: 270,
      translatedAudio: 720,
      presentationContext: 20,
      postSessionSummary: 25,
      total: 1155,
    })
  })

  it("rejects unsupported language counts", () => {
    expect(() =>
      estimateCredits({
        minutes: 45,
        targetLanguages: 4,
        translatedAudio: true,
        presentationContext: false,
        postSessionSummary: false,
      }),
    ).toThrow("Choose between one and three target languages.")
  })
})

describe("creditExpiryFromLoadedAt", () => {
  it("expires credits 365 days after loading", () => {
    const loadedAt = new Date("2026-07-23T10:30:00.000Z")
    expect(creditExpiryFromLoadedAt(loadedAt).toISOString()).toBe(
      "2027-07-23T10:30:00.000Z",
    )
  })
})

describe("allocateCreditLots", () => {
  it("uses the earliest-expiring valid lot first", () => {
    const result = allocateCreditLots(
      [
        {
          id: "later",
          loadedAt: "2026-06-01T00:00:00.000Z",
          expiresAt: "2027-06-01T00:00:00.000Z",
          originalCredits: 1000,
          remainingCredits: 700,
        },
        {
          id: "earlier",
          loadedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2027-01-01T00:00:00.000Z",
          originalCredits: 500,
          remainingCredits: 300,
        },
      ],
      450,
      new Date("2026-08-01T00:00:00.000Z"),
    )

    expect(result).toEqual({
      allocations: [
        { lotId: "earlier", credits: 300 },
        { lotId: "later", credits: 150 },
      ],
      unallocated: 0,
    })
  })

  it("ignores expired lots and exposes any shortfall", () => {
    const result = allocateCreditLots(
      [
        {
          id: "expired",
          loadedAt: "2025-01-01T00:00:00.000Z",
          expiresAt: "2026-01-01T00:00:00.000Z",
          originalCredits: 500,
          remainingCredits: 500,
        },
      ],
      100,
      new Date("2026-07-23T00:00:00.000Z"),
    )

    expect(result).toEqual({ allocations: [], unallocated: 100 })
  })
})
