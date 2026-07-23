export const CREDIT_VALIDITY_DAYS = 365

export type UsageInput = {
  minutes: number
  targetLanguages: number
  translatedAudio: boolean
  presentationContext: boolean
  postSessionSummary: boolean
}

export type CreditRateCard = {
  sourceCaptionsPerMinute: number
  translationPerLanguageMinute: number
  translatedAudioPerLanguageMinute: number
  presentationContextPerSession: number
  postSessionSummaryPerSession: number
}

export type CreditQuote = {
  sourceCaptions: number
  translation: number
  translatedAudio: number
  presentationContext: number
  postSessionSummary: number
  total: number
}

export type CreditLot = {
  id: string
  loadedAt: string
  expiresAt: string
  originalCredits: number
  remainingCredits: number
}

export type CreditAllocation = {
  lotId: string
  credits: number
}

export const SAMPLE_RATE_CARD: CreditRateCard = {
  sourceCaptionsPerMinute: 2,
  translationPerLanguageMinute: 1.5,
  translatedAudioPerLanguageMinute: 4,
  presentationContextPerSession: 20,
  postSessionSummaryPerSession: 25,
}

const roundCredits = (value: number) => Math.ceil(value)

export function estimateCredits(
  input: UsageInput,
  rates: CreditRateCard = SAMPLE_RATE_CARD,
): CreditQuote {
  if (!Number.isFinite(input.minutes) || input.minutes <= 0) {
    throw new Error("Session minutes must be greater than zero.")
  }

  if (
    !Number.isInteger(input.targetLanguages) ||
    input.targetLanguages < 1 ||
    input.targetLanguages > 3
  ) {
    throw new Error("Choose between one and three target languages.")
  }

  const sourceCaptions = roundCredits(
    input.minutes * rates.sourceCaptionsPerMinute,
  )
  const translation = roundCredits(
    input.minutes *
      input.targetLanguages *
      rates.translationPerLanguageMinute,
  )
  const translatedAudio = input.translatedAudio
    ? roundCredits(
        input.minutes *
          input.targetLanguages *
          rates.translatedAudioPerLanguageMinute,
      )
    : 0
  const presentationContext = input.presentationContext
    ? rates.presentationContextPerSession
    : 0
  const postSessionSummary = input.postSessionSummary
    ? rates.postSessionSummaryPerSession
    : 0

  return {
    sourceCaptions,
    translation,
    translatedAudio,
    presentationContext,
    postSessionSummary,
    total:
      sourceCaptions +
      translation +
      translatedAudio +
      presentationContext +
      postSessionSummary,
  }
}

export function creditExpiryFromLoadedAt(loadedAt: Date): Date {
  if (Number.isNaN(loadedAt.getTime())) {
    throw new Error("A valid credit loading time is required.")
  }

  return new Date(
    loadedAt.getTime() + CREDIT_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  )
}

export function allocateCreditLots(
  lots: CreditLot[],
  amount: number,
  now: Date,
): { allocations: CreditAllocation[]; unallocated: number } {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Allocation amount must be greater than zero.")
  }

  const eligibleLots = lots
    .filter(
      (lot) =>
        lot.remainingCredits > 0 && new Date(lot.expiresAt).getTime() > now.getTime(),
    )
    .sort(
      (left, right) =>
        new Date(left.expiresAt).getTime() -
        new Date(right.expiresAt).getTime(),
    )

  const allocations: CreditAllocation[] = []
  let unallocated = amount

  for (const lot of eligibleLots) {
    if (unallocated <= 0) break

    const credits = Math.min(lot.remainingCredits, unallocated)
    allocations.push({ lotId: lot.id, credits })
    unallocated -= credits
  }

  return { allocations, unallocated }
}

export function formatCredits(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)
}
