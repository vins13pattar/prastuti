import "server-only"

import {
  allocateCreditLots,
  creditExpiryFromLoadedAt,
  estimateCredits,
  type CreditAllocation,
  type CreditLot,
} from "@/lib/credits"
import type {
  AttendeeSession,
  CaptionSegment,
  CreditLedgerItem,
  OrganizerIdentity,
  ProductSession,
  SupportedLanguage,
  WalletSnapshot,
  WorkspaceSnapshot,
} from "@/lib/product/types"

type OrganizerSession = {
  token: string
  csrfToken: string
  identity: OrganizerIdentity
  expiresAt: string
}

type StoredCreditLot = CreditLot & {
  reservedCredits: number
}

type ProductStore = {
  organizerSessions: Map<string, OrganizerSession>
  attendeeSessions: Map<string, AttendeeSession>
  sessions: Map<string, ProductSession>
  creditLots: StoredCreditLot[]
  reservations: Map<string, CreditAllocation[]>
  ledger: CreditLedgerItem[]
}

const LOCAL_IDENTITY: OrganizerIdentity = {
  id: "00000000-0000-4000-8000-000000000002",
  organizationId: "00000000-0000-4000-8000-000000000001",
  displayName: "Local organizer",
  workspaceName: "Prastuti local workspace",
}

const DEMO_SOURCE_SEGMENTS = [
  "ಈಗ ನಾವು vector database ನಲ್ಲಿ embeddings store ಮಾಡೋಣ.",
  "Next, connect the retrieval step to the language model.",
  "ಈ workflow ಅನ್ನು production ಗೆ deploy ಮಾಡುವ ಮೊದಲು test ಮಾಡೋಣ.",
] as const

const DEMO_TRANSLATIONS: Record<
  (typeof DEMO_SOURCE_SEGMENTS)[number],
  Partial<Record<SupportedLanguage, string>>
> = {
  "ಈಗ ನಾವು vector database ನಲ್ಲಿ embeddings store ಮಾಡೋಣ.": {
    English: "Now we will store the embeddings in the vector database.",
    Hindi: "अब हम एम्बेडिंग्स को वेक्टर डेटाबेस में संग्रहीत करेंगे।",
    Telugu: "ఇప్పుడు ఎంబెడింగ్స్‌ను వెక్టర్ డేటాబేస్‌లో నిల్వ చేద్దాం.",
  },
  "Next, connect the retrieval step to the language model.": {
    Kannada: "ಮುಂದೆ, retrieval ಹಂತವನ್ನು language model ಗೆ ಸಂಪರ್ಕಿಸಿ.",
    Hindi: "इसके बाद, रिट्रीवल चरण को भाषा मॉडल से जोड़ें।",
    Telugu: "తర్వాత, రిట్రీవల్ దశను లాంగ్వేజ్ మోడల్‌కు కనెక్ట్ చేయండి.",
  },
  "ಈ workflow ಅನ್ನು production ಗೆ deploy ಮಾಡುವ ಮೊದಲು test ಮಾಡೋಣ.": {
    English: "Let us test this workflow before deploying it to production.",
    Hindi: "इस वर्कफ़्लो को प्रोडक्शन में तैनात करने से पहले जाँच लें।",
    Telugu: "ఈ వర్క్‌ఫ్లోను ప్రొడక్షన్‌కు డిప్లాయ్ చేసే ముందు పరీక్షిద్దాం.",
  },
}

declare global {
  var __prastutiProductStore: ProductStore | undefined
}

function createStore(): ProductStore {
  const loadedAt = new Date()
  const lot: StoredCreditLot = {
    id: crypto.randomUUID(),
    loadedAt: loadedAt.toISOString(),
    expiresAt: creditExpiryFromLoadedAt(loadedAt).toISOString(),
    originalCredits: 20000,
    remainingCredits: 20000,
    reservedCredits: 0,
  }

  return {
    organizerSessions: new Map(),
    attendeeSessions: new Map(),
    sessions: new Map(),
    creditLots: [lot],
    reservations: new Map(),
    ledger: [
      {
        id: crypto.randomUUID(),
        type: "load",
        credits: 20000,
        createdAt: loadedAt.toISOString(),
        note: "Local development credit load",
      },
    ],
  }
}

const store = globalThis.__prastutiProductStore ?? createStore()
globalThis.__prastutiProductStore = store

function opaqueToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "")
}

function activeLots() {
  const now = Date.now()
  return store.creditLots.filter(
    (lot) => new Date(lot.expiresAt).getTime() > now,
  )
}

function walletSnapshot(): WalletSnapshot {
  const lots = activeLots()
  return {
    availableCredits: lots.reduce(
      (total, lot) => total + lot.remainingCredits,
      0,
    ),
    reservedCredits: lots.reduce(
      (total, lot) => total + lot.reservedCredits,
      0,
    ),
    expiresAt:
      lots
        .filter((lot) => lot.remainingCredits + lot.reservedCredits > 0)
        .sort(
          (left, right) =>
            new Date(left.expiresAt).getTime() -
            new Date(right.expiresAt).getTime(),
        )[0]?.expiresAt ?? null,
    lots: lots.map((lot) => ({ ...lot })),
    ledger: [...store.ledger].reverse(),
  }
}

function applyAllocations(
  allocations: CreditAllocation[],
  operation: (lot: StoredCreditLot, credits: number) => void,
) {
  for (const allocation of allocations) {
    const lot = store.creditLots.find((item) => item.id === allocation.lotId)
    if (!lot) throw new Error("The allocated credit lot no longer exists.")
    operation(lot, allocation.credits)
  }
}

export function createLocalOrganizerSession() {
  const token = opaqueToken()
  const session: OrganizerSession = {
    token,
    csrfToken: opaqueToken(),
    identity: LOCAL_IDENTITY,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  }
  store.organizerSessions.set(token, session)
  return session
}

export function organizerSessionByToken(token: string | undefined) {
  if (!token) return null
  const session = store.organizerSessions.get(token)
  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    store.organizerSessions.delete(token)
    return null
  }
  return session
}

export function createAttendeeSession(joinCode: string) {
  const session = sessionByJoinCode(joinCode)
  if (!session || !["live", "paused"].includes(session.status)) return null

  const token = opaqueToken()
  const attendee: AttendeeSession = {
    attendeeId: crypto.randomUUID(),
    sessionId: session.id,
    joinCode,
    csrfToken: opaqueToken(),
    joinedAt: new Date().toISOString(),
  }
  store.attendeeSessions.set(token, attendee)
  session.attendeeCount += 1
  return { token, attendee }
}

export function attendeeSessionByToken(token: string | undefined) {
  return token ? (store.attendeeSessions.get(token) ?? null) : null
}

export function workspaceSnapshot(
  identity: OrganizerIdentity,
): WorkspaceSnapshot {
  return {
    identity,
    sessions: [...store.sessions.values()]
      .filter((session) => session.organizationId === identity.organizationId)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      ),
    wallet: walletSnapshot(),
  }
}

export function createProductSession(input: {
  name: string
  sourceLanguage: SupportedLanguage
  targetLanguages: SupportedLanguage[]
  expectedMinutes: number
  translatedAudio: boolean
}) {
  const id = crypto.randomUUID()
  const session: ProductSession = {
    id,
    organizationId: LOCAL_IDENTITY.organizationId,
    organizerId: LOCAL_IDENTITY.id,
    name: input.name,
    sourceLanguage: input.sourceLanguage,
    targetLanguages: input.targetLanguages,
    expectedMinutes: input.expectedMinutes,
    translatedAudio: input.translatedAudio,
    status: "draft",
    joinCode: id.replaceAll("-", "").slice(0, 8).toUpperCase(),
    reservedCredits: 0,
    consumedCredits: 0,
    attendeeCount: 0,
    context: { glossary: [], notes: "" },
    segments: [],
    createdAt: new Date().toISOString(),
  }
  store.sessions.set(id, session)
  return session
}

export function sessionById(id: string) {
  return store.sessions.get(id) ?? null
}

export function sessionByJoinCode(joinCode: string) {
  const normalized = joinCode.toUpperCase()
  return (
    [...store.sessions.values()].find(
      (session) => session.joinCode === normalized,
    ) ?? null
  )
}

export function updateSessionContext(
  session: ProductSession,
  context: ProductSession["context"],
) {
  session.context = context
  return session
}

function reserveForSession(session: ProductSession) {
  const quote = estimateCredits({
    minutes: session.expectedMinutes,
    targetLanguages: session.targetLanguages.length,
    translatedAudio: session.translatedAudio,
    presentationContext:
      session.context.glossary.length > 0 || session.context.notes.length > 0,
    postSessionSummary: true,
  })
  const lots = activeLots().map((lot) => ({
    ...lot,
    remainingCredits: lot.remainingCredits,
  }))
  const allocation = allocateCreditLots(lots, quote.total, new Date())
  if (allocation.unallocated > 0) {
    throw new Error(
      `Add ${allocation.unallocated} more credits before starting this session.`,
    )
  }
  applyAllocations(allocation.allocations, (lot, credits) => {
    lot.remainingCredits -= credits
    lot.reservedCredits += credits
  })
  store.reservations.set(session.id, allocation.allocations)
  session.reservedCredits = quote.total
  store.ledger.push({
    id: crypto.randomUUID(),
    type: "reserve",
    credits: -quote.total,
    sessionId: session.id,
    createdAt: new Date().toISOString(),
    note: `Reserved for ${session.name}`,
  })
}

function settleSession(session: ProductSession) {
  const elapsedMinutes = session.startedAt
    ? Math.max(
        1,
        Math.ceil(
          (Date.now() - new Date(session.startedAt).getTime()) / 60_000,
        ),
      )
    : 1
  const segmentMinutes = Math.max(1, Math.ceil(session.segments.length / 3))
  const actualMinutes = Math.min(
    session.expectedMinutes,
    Math.max(elapsedMinutes, segmentMinutes),
  )
  const actual = estimateCredits({
    minutes: actualMinutes,
    targetLanguages: session.targetLanguages.length,
    translatedAudio: session.translatedAudio,
    presentationContext:
      session.context.glossary.length > 0 || session.context.notes.length > 0,
    postSessionSummary: true,
  }).total
  const consumed = Math.min(actual, session.reservedCredits)
  let remainingToConsume = consumed
  const allocations = store.reservations.get(session.id) ?? []

  for (const allocation of allocations) {
    const lot = store.creditLots.find((item) => item.id === allocation.lotId)
    if (!lot) throw new Error("A reserved credit lot no longer exists.")
    const consumedFromLot = Math.min(allocation.credits, remainingToConsume)
    const releasedFromLot = allocation.credits - consumedFromLot
    lot.reservedCredits -= allocation.credits
    lot.remainingCredits += releasedFromLot
    remainingToConsume -= consumedFromLot
  }
  store.reservations.delete(session.id)

  session.consumedCredits = consumed
  if (consumed > 0) {
    store.ledger.push({
      id: crypto.randomUUID(),
      type: "consume",
      credits: -consumed,
      sessionId: session.id,
      createdAt: new Date().toISOString(),
      note: `Settled usage for ${session.name}`,
    })
  }
  const released = session.reservedCredits - consumed
  if (released > 0) {
    store.ledger.push({
      id: crypto.randomUUID(),
      type: "release",
      credits: released,
      sessionId: session.id,
      createdAt: new Date().toISOString(),
      note: `Returned unused reservation for ${session.name}`,
    })
  }
}

export function transitionSession(
  session: ProductSession,
  action: "start" | "pause" | "resume" | "stop",
) {
  if (action === "start") {
    if (session.status !== "draft") {
      throw new Error("Only a draft session can be started.")
    }
    reserveForSession(session)
    session.status = "live"
    session.startedAt = new Date().toISOString()
  } else if (action === "pause") {
    if (session.status !== "live") {
      throw new Error("Only a live session can be paused.")
    }
    session.status = "paused"
  } else if (action === "resume") {
    if (session.status !== "paused") {
      throw new Error("Only a paused session can be resumed.")
    }
    session.status = "live"
  } else {
    if (!["live", "paused"].includes(session.status)) {
      throw new Error("Only an active session can be stopped.")
    }
    settleSession(session)
    session.status = "completed"
    session.endedAt = new Date().toISOString()
  }
  return session
}

function mockTranslations(
  sourceText: string,
  targets: SupportedLanguage[],
  glossary: ProductSession["context"]["glossary"],
) {
  const known = DEMO_TRANSLATIONS[
    sourceText as (typeof DEMO_SOURCE_SEGMENTS)[number]
  ]
  const contextualSource = glossary.reduce(
    (text, term) => text.split(term.source).join(term.preferred),
    sourceText,
  )
  return Object.fromEntries(
    targets.map((language) => [
      language,
      known?.[language] ?? `[${language}] ${contextualSource}`,
    ]),
  )
}

export function appendSegment(
  session: ProductSession,
  sourceText?: string,
): CaptionSegment {
  if (session.status !== "live") {
    throw new Error("Captions can only be added while the session is live.")
  }
  const text =
    sourceText?.trim() ??
    DEMO_SOURCE_SEGMENTS[session.segments.length % DEMO_SOURCE_SEGMENTS.length]
  const segment: CaptionSegment = {
    id: crypto.randomUUID(),
    sequence: session.segments.length + 1,
    sourceText: text,
    translations: mockTranslations(
      text,
      session.targetLanguages,
      session.context.glossary,
    ),
    createdAt: new Date().toISOString(),
  }
  session.segments.push(segment)
  return segment
}

export function correctSegment(
  session: ProductSession,
  segmentId: string,
  sourceText: string,
) {
  const segment = session.segments.find((item) => item.id === segmentId)
  if (!segment) return null
  segment.sourceText = sourceText
  segment.translations = mockTranslations(
    sourceText,
    session.targetLanguages,
    session.context.glossary,
  )
  segment.correctedAt = new Date().toISOString()
  return segment
}

export function loadCredits(credits: number) {
  const loadedAt = new Date()
  const lot: StoredCreditLot = {
    id: crypto.randomUUID(),
    loadedAt: loadedAt.toISOString(),
    expiresAt: creditExpiryFromLoadedAt(loadedAt).toISOString(),
    originalCredits: credits,
    remainingCredits: credits,
    reservedCredits: 0,
  }
  store.creditLots.push(lot)
  store.ledger.push({
    id: crypto.randomUUID(),
    type: "load",
    credits,
    createdAt: loadedAt.toISOString(),
    note: "Simulated local credit load",
  })
  return lot
}

export function buildSessionArtifacts(session: ProductSession) {
  const transcript = session.segments
    .map(
      (segment) =>
        `${segment.sequence}. ${segment.sourceText}\n${session.targetLanguages
          .map(
            (language) =>
              `${language}: ${segment.translations[language] ?? ""}`,
          )
          .join("\n")}`,
    )
    .join("\n\n")
  const keyPoints = session.segments
    .slice(0, 5)
    .map((segment) => segment.sourceText)
  return {
    transcript,
    summary:
      keyPoints.length > 0
        ? `Session "${session.name}" covered ${keyPoints.join(" ")}`
        : `Session "${session.name}" ended without captured captions.`,
    keyPoints,
  }
}
