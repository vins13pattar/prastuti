import type { CreditLot } from "@/lib/credits"

export const demoCreditLots: CreditLot[] = [
  {
    id: "lot_01JSA2",
    loadedAt: "2026-04-12T05:30:00.000Z",
    expiresAt: "2027-04-12T05:30:00.000Z",
    originalCredits: 15000,
    remainingCredits: 15000,
  },
  {
    id: "lot_01K0Q8",
    loadedAt: "2026-07-05T10:15:00.000Z",
    expiresAt: "2027-07-05T10:15:00.000Z",
    originalCredits: 5000,
    remainingCredits: 3420,
  },
]

export const recentSessions = [
  {
    id: "SES-4821",
    name: "GenAI Foundations",
    source: "Kannada",
    targets: "English, Hindi, Telugu",
    attendees: 84,
    credits: 946,
    status: "Completed",
    date: "22 Jul 2026",
  },
  {
    id: "SES-4796",
    name: "RAG for Support Teams",
    source: "English",
    targets: "Kannada, Hindi",
    attendees: 61,
    credits: 588,
    status: "Completed",
    date: "18 Jul 2026",
  },
  {
    id: "SES-4743",
    name: "LangGraph Workshop",
    source: "Kannada",
    targets: "English",
    attendees: 37,
    credits: 312,
    status: "Completed",
    date: "11 Jul 2026",
  },
]

export const usageByMeter = [
  {
    meter: "Translated audio",
    detail: "Language-minutes synthesized",
    credits: 996,
  },
  {
    meter: "Live translation",
    detail: "Language-minutes translated",
    credits: 438,
  },
  {
    meter: "Source captions",
    detail: "Source minutes transcribed",
    credits: 264,
  },
  {
    meter: "Context and summaries",
    detail: "Session-level processing",
    credits: 148,
  },
]
