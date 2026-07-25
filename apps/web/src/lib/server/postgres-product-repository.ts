import "server-only"

import { createHash } from "node:crypto"

import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm"

import {
  attendeeSessions,
  captionSegments,
  creditLedgerEntries,
  creditLots,
  creditReservations,
  organizationMembers,
  organizations,
  sessions,
} from "@/db/schema"
import { getDatabase } from "@/db"
import {
  creditExpiryFromLoadedAt,
  estimateCredits,
  SAMPLE_RATE_CARD,
} from "@/lib/credits"
import type {
  AttendeeSession,
  CaptionSegment,
  CaptionTranslations,
  OrganizerIdentity,
  ProductSession,
  SessionContext,
  SupportedLanguage,
  WalletSnapshot,
  WorkspaceSnapshot,
} from "@/lib/product/types"
import { productRuntime } from "@/lib/runtime/product-runtime"
import {
  publishCaptionToAbly,
  synthesizeSharedAudio,
  translateWithAzure,
} from "@/lib/server/managed-media"

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
    Hindi: "इस वर्कफ़्लो को प्रोडक्शन में तैनಾತ करने से पहले जाँच लें।",
    Telugu: "ఈ వర్క్‌ఫ్లోను ప్రొడక్షన్‌కు డిప్లాయ్ చేసే ముందు పరీక్షిద్దాం.",
  },
}

type SessionRow = typeof sessions.$inferSelect
type SegmentRow = typeof captionSegments.$inferSelect

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function opaqueToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "")
}

function mapSegment(row: SegmentRow): CaptionSegment {
  return {
    id: row.id,
    sequence: row.sequence,
    sourceText: row.sourceText,
    translations: row.translations as CaptionTranslations,
    audioReferences: row.audioReferences as Partial<
      Record<SupportedLanguage, string>
    >,
    createdAt: row.createdAt.toISOString(),
    ...(row.correctedAt
      ? { correctedAt: row.correctedAt.toISOString() }
      : {}),
  }
}

function mapSession(row: SessionRow, segmentRows: SegmentRow[]): ProductSession {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizerId: row.organizerExternalId,
    name: row.name,
    sourceLanguage: row.sourceLanguage as SupportedLanguage,
    targetLanguages: row.targetLanguages as SupportedLanguage[],
    expectedMinutes: row.expectedMinutes,
    translatedAudio: row.translatedAudio,
    status: row.status,
    joinCode: row.joinCode,
    reservedCredits: row.reservedCredits,
    consumedCredits: row.consumedCredits,
    attendeeCount: row.attendeeCount,
    context: row.context,
    segments: segmentRows.map(mapSegment),
    createdAt: row.createdAt.toISOString(),
    ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
    ...(row.endedAt ? { endedAt: row.endedAt.toISOString() } : {}),
  }
}

function attendeeRealtimeSegment(
  session: ProductSession,
  segment: CaptionSegment,
): CaptionSegment {
  return {
    ...segment,
    audioReferences: Object.fromEntries(
      Object.keys(segment.audioReferences ?? {}).map((language) => [
        language,
        `/api/join/${session.joinCode}/audio/${segment.id}/${language}`,
      ]),
    ),
  }
}

async function segmentsForSessions(sessionIds: string[]) {
  if (sessionIds.length === 0) return new Map<string, SegmentRow[]>()
  const db = getDatabase()
  const rows = await db
    .select()
    .from(captionSegments)
    .where(inArray(captionSegments.sessionId, sessionIds))
    .orderBy(asc(captionSegments.sequence))
  const grouped = new Map<string, SegmentRow[]>()
  for (const row of rows) {
    const existing = grouped.get(row.sessionId) ?? []
    existing.push(row)
    grouped.set(row.sessionId, existing)
  }
  return grouped
}

export async function ensureOrganizerIdentity(input: {
  externalOrganizationId: string
  externalUserId: string
  displayName: string
  workspaceName: string
  role?: string
  preferredOrganizationId?: string
}) {
  const db = getDatabase()
  const [organization] = await db
    .insert(organizations)
    .values({
      ...(input.preferredOrganizationId
        ? { id: input.preferredOrganizationId }
        : {}),
      externalId: input.externalOrganizationId,
      name: input.workspaceName,
    })
    .onConflictDoUpdate({
      target: organizations.externalId,
      set: { name: input.workspaceName },
    })
    .returning()

  if (!organization) {
    throw new Error("Unable to resolve the organizer workspace.")
  }

  await db
    .insert(organizationMembers)
    .values({
      organizationId: organization.id,
      externalUserId: input.externalUserId,
      displayName: input.displayName,
      role: input.role ?? "member",
    })
    .onConflictDoUpdate({
      target: [
        organizationMembers.organizationId,
        organizationMembers.externalUserId,
      ],
      set: {
        displayName: input.displayName,
        role: input.role ?? "member",
      },
    })

  return {
    id: input.externalUserId,
    organizationId: organization.id,
    displayName: input.displayName,
    workspaceName: organization.name,
  } satisfies OrganizerIdentity
}

export async function ensureDevelopmentCredits(identity: OrganizerIdentity) {
  const db = getDatabase()
  const existing = await db
    .select({ id: creditLots.id })
    .from(creditLots)
    .where(eq(creditLots.organizationId, identity.organizationId))
    .limit(1)
  if (existing.length > 0) return
  await loadCredits(20_000, identity, "local-development-seed")
}

async function walletSnapshot(
  organizationId: string,
): Promise<WalletSnapshot> {
  const db = getDatabase()
  const now = new Date()
  const [lots, reservations, ledger] = await Promise.all([
    db
      .select()
      .from(creditLots)
      .where(
        and(
          eq(creditLots.organizationId, organizationId),
          gt(creditLots.expiresAt, now),
        ),
      )
      .orderBy(asc(creditLots.expiresAt)),
    db
      .select({
        lotId: creditReservations.lotId,
        credits: creditReservations.reservedCredits,
      })
      .from(creditReservations)
      .innerJoin(sessions, eq(creditReservations.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.organizationId, organizationId),
          isNull(creditReservations.settledAt),
        ),
      ),
    db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.organizationId, organizationId))
      .orderBy(desc(creditLedgerEntries.createdAt))
      .limit(100),
  ])
  const reservedByLot = new Map<string, number>()
  for (const reservation of reservations) {
    reservedByLot.set(
      reservation.lotId,
      (reservedByLot.get(reservation.lotId) ?? 0) + reservation.credits,
    )
  }
  const mappedLots = lots.map((lot) => ({
    id: lot.id,
    loadedAt: lot.loadedAt.toISOString(),
    expiresAt: lot.expiresAt.toISOString(),
    originalCredits: lot.originalCredits,
    remainingCredits: lot.remainingCredits,
    reservedCredits: reservedByLot.get(lot.id) ?? 0,
  }))
  return {
    availableCredits: mappedLots.reduce(
      (total, lot) => total + lot.remainingCredits,
      0,
    ),
    reservedCredits: mappedLots.reduce(
      (total, lot) => total + lot.reservedCredits,
      0,
    ),
    expiresAt:
      mappedLots.find(
        (lot) => lot.remainingCredits + lot.reservedCredits > 0,
      )?.expiresAt ?? null,
    lots: mappedLots,
    ledger: ledger.map((entry) => ({
      id: entry.id,
      type: entry.type,
      credits: entry.credits,
      ...(entry.sessionId ? { sessionId: entry.sessionId } : {}),
      createdAt: entry.createdAt.toISOString(),
      note: entry.reason ?? entry.type,
    })),
  }
}

export async function workspaceSnapshot(
  identity: OrganizerIdentity,
): Promise<WorkspaceSnapshot> {
  const db = getDatabase()
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.organizationId, identity.organizationId))
    .orderBy(desc(sessions.createdAt))
  const groupedSegments = await segmentsForSessions(
    sessionRows.map((session) => session.id),
  )
  return {
    identity,
    sessions: sessionRows.map((session) =>
      mapSession(session, groupedSegments.get(session.id) ?? []),
    ),
    wallet: await walletSnapshot(identity.organizationId),
  }
}

export async function createProductSession(
  input: {
    name: string
    sourceLanguage: SupportedLanguage
    targetLanguages: SupportedLanguage[]
    expectedMinutes: number
    translatedAudio: boolean
  },
  identity: OrganizerIdentity,
) {
  const db = getDatabase()
  const id = crypto.randomUUID()
  const [row] = await db
    .insert(sessions)
    .values({
      id,
      organizationId: identity.organizationId,
      organizerExternalId: identity.id,
      name: input.name,
      sourceLanguage: input.sourceLanguage,
      targetLanguages: input.targetLanguages,
      expectedMinutes: input.expectedMinutes,
      translatedAudio: input.translatedAudio,
      joinCode: id.replaceAll("-", "").slice(0, 8).toUpperCase(),
    })
    .returning()
  if (!row) throw new Error("Unable to create the session.")
  return mapSession(row, [])
}

export async function sessionById(id: string) {
  const db = getDatabase()
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1)
  if (!row) return null
  const segments = await segmentsForSessions([row.id])
  return mapSession(row, segments.get(row.id) ?? [])
}

export async function sessionByJoinCode(joinCode: string) {
  const db = getDatabase()
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.joinCode, joinCode.toUpperCase()))
    .limit(1)
  if (!row) return null
  const segments = await segmentsForSessions([row.id])
  return mapSession(row, segments.get(row.id) ?? [])
}

export async function updateSessionContext(
  session: ProductSession,
  context: SessionContext,
) {
  const db = getDatabase()
  await db.update(sessions).set({ context }).where(eq(sessions.id, session.id))
  return sessionById(session.id)
}

export async function createAttendeeSession(joinCode: string) {
  const session = await sessionByJoinCode(joinCode)
  if (!session || !["live", "paused"].includes(session.status)) return null
  const token = opaqueToken()
  const csrfToken = opaqueToken()
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000)
  const db = getDatabase()
  const [row] = await db
    .insert(attendeeSessions)
    .values({
      sessionId: session.id,
      tokenHash: sha256(token),
      csrfHash: sha256(csrfToken),
      expiresAt,
    })
    .returning()
  if (!row) throw new Error("Unable to create the attendee session.")
  await db
    .update(sessions)
    .set({ attendeeCount: sql`${sessions.attendeeCount} + 1` })
    .where(eq(sessions.id, session.id))
  return {
    token,
    attendee: {
      attendeeId: row.id,
      sessionId: session.id,
      joinCode: session.joinCode,
      csrfToken,
      joinedAt: row.joinedAt.toISOString(),
    } satisfies AttendeeSession,
  }
}

export async function attendeeSessionByToken(token: string | undefined) {
  if (!token) return null
  const db = getDatabase()
  const [row] = await db
    .select({
      id: attendeeSessions.id,
      sessionId: attendeeSessions.sessionId,
      joinedAt: attendeeSessions.joinedAt,
      joinCode: sessions.joinCode,
    })
    .from(attendeeSessions)
    .innerJoin(sessions, eq(attendeeSessions.sessionId, sessions.id))
    .where(
      and(
        eq(attendeeSessions.tokenHash, sha256(token)),
        gt(attendeeSessions.expiresAt, new Date()),
      ),
    )
    .limit(1)
  if (!row) return null
  return {
    attendeeId: row.id,
    sessionId: row.sessionId,
    joinCode: row.joinCode,
    csrfToken: "",
    joinedAt: row.joinedAt.toISOString(),
  } satisfies AttendeeSession
}

export async function validateAttendeeCsrf(
  token: string | undefined,
  csrfToken: string | null,
) {
  if (!token || !csrfToken) return false
  const db = getDatabase()
  const [row] = await db
    .select({ id: attendeeSessions.id })
    .from(attendeeSessions)
    .where(
      and(
        eq(attendeeSessions.tokenHash, sha256(token)),
        eq(attendeeSessions.csrfHash, sha256(csrfToken)),
        gt(attendeeSessions.expiresAt, new Date()),
      ),
    )
    .limit(1)
  return Boolean(row)
}

function mockTranslations(
  sourceText: string,
  targets: SupportedLanguage[],
  glossary: SessionContext["glossary"],
) {
  const known =
    DEMO_TRANSLATIONS[
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
  ) as CaptionTranslations
}

export async function appendSegment(
  session: ProductSession,
  sourceText?: string,
) {
  if (session.status !== "live") {
    throw new Error("Captions can only be added while the session is live.")
  }
  const text =
    sourceText?.trim() ??
    DEMO_SOURCE_SEGMENTS[session.segments.length % DEMO_SOURCE_SEGMENTS.length]
  const translations =
    productRuntime().mode === "managed"
      ? await translateWithAzure(
          text,
          session.sourceLanguage,
          session.targetLanguages,
        )
      : mockTranslations(
          text,
          session.targetLanguages,
          session.context.glossary,
        )
  const segmentId = crypto.randomUUID()
  const audioReferences =
    productRuntime().mode === "managed" && session.translatedAudio
      ? await synthesizeSharedAudio({
          organizationId: session.organizationId,
          sessionId: session.id,
          segmentId,
          translations,
        })
      : {}
  const db = getDatabase()
  const [row] = await db
    .insert(captionSegments)
    .values({
      id: segmentId,
      sessionId: session.id,
      sequence: session.segments.length + 1,
      sourceText: text,
      translations,
      audioReferences,
    })
    .returning()
  if (!row) throw new Error("Unable to store the caption.")
  const segment = mapSegment(row)
  if (productRuntime().mode === "managed") {
    await publishCaptionToAbly(
      session.id,
      attendeeRealtimeSegment(session, segment),
    ).catch(() => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "realtime_publish_failed",
          sessionId: session.id,
          segmentId: segment.id,
        }),
      )
    })
  }
  return segment
}

export async function correctSegment(
  session: ProductSession,
  segmentId: string,
  sourceText: string,
) {
  const translations = mockTranslations(
    sourceText,
    session.targetLanguages,
    session.context.glossary,
  )
  const correctedTranslations =
    productRuntime().mode === "managed"
      ? await translateWithAzure(
          sourceText,
          session.sourceLanguage,
          session.targetLanguages,
        )
      : translations
  const audioReferences =
    productRuntime().mode === "managed" && session.translatedAudio
      ? await synthesizeSharedAudio({
          organizationId: session.organizationId,
          sessionId: session.id,
          segmentId,
          translations: correctedTranslations,
        })
      : {}
  const db = getDatabase()
  const [row] = await db
    .update(captionSegments)
    .set({
      sourceText,
      translations: correctedTranslations,
      audioReferences,
      correctedAt: new Date(),
    })
    .where(
      and(
        eq(captionSegments.id, segmentId),
        eq(captionSegments.sessionId, session.id),
      ),
    )
    .returning()
  if (!row) return null
  const segment = mapSegment(row)
  if (productRuntime().mode === "managed") {
    await publishCaptionToAbly(
      session.id,
      attendeeRealtimeSegment(session, segment),
      "caption.corrected",
    ).catch(() => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "realtime_publish_failed",
          sessionId: session.id,
          segmentId: segment.id,
        }),
      )
    })
  }
  return segment
}

export async function transitionSession(
  session: ProductSession,
  action: "start" | "pause" | "resume" | "stop",
) {
  const db = getDatabase()
  if (action === "start") {
    const quote = estimateCredits({
      minutes: session.expectedMinutes,
      targetLanguages: session.targetLanguages.length,
      translatedAudio: session.translatedAudio,
      presentationContext:
        session.context.glossary.length > 0 ||
        session.context.notes.length > 0,
      postSessionSummary: true,
    })
    await db.execute(
      sql`select reserve_prastuti_credits(${session.id}::uuid, ${session.organizationId}::uuid, ${quote.total}::integer)`,
    )
  } else if (action === "pause") {
    const updated = await db
      .update(sessions)
      .set({ status: "paused" })
      .where(
        and(eq(sessions.id, session.id), eq(sessions.status, "live")),
      )
      .returning()
    if (updated.length === 0) {
      throw new Error("Only a live session can be paused.")
    }
  } else if (action === "resume") {
    const updated = await db
      .update(sessions)
      .set({ status: "live" })
      .where(
        and(eq(sessions.id, session.id), eq(sessions.status, "paused")),
      )
      .returning()
    if (updated.length === 0) {
      throw new Error("Only a paused session can be resumed.")
    }
  } else {
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
    const usage = {
      minutes: actualMinutes,
      targetLanguages: session.targetLanguages.length,
      translatedAudio: session.translatedAudio,
      presentationContext:
        session.context.glossary.length > 0 ||
        session.context.notes.length > 0,
      postSessionSummary: true,
    }
    const quote = estimateCredits(usage)
    const meters = [
      {
        meter: "source_caption_minutes",
        language: session.sourceLanguage,
        quantity: actualMinutes,
        unit_credits: SAMPLE_RATE_CARD.sourceCaptionsPerMinute,
        billed_credits: quote.sourceCaptions,
      },
      {
        meter: "translation_language_minutes",
        quantity: actualMinutes * session.targetLanguages.length,
        unit_credits: SAMPLE_RATE_CARD.translationPerLanguageMinute,
        billed_credits: quote.translation,
      },
      ...(quote.translatedAudio > 0
        ? [
            {
              meter: "translated_audio_language_minutes",
              quantity: actualMinutes * session.targetLanguages.length,
              unit_credits:
                SAMPLE_RATE_CARD.translatedAudioPerLanguageMinute,
              billed_credits: quote.translatedAudio,
            },
          ]
        : []),
      ...(quote.presentationContext > 0
        ? [
            {
              meter: "presentation_context_session",
              quantity: 1,
              unit_credits: SAMPLE_RATE_CARD.presentationContextPerSession,
              billed_credits: quote.presentationContext,
            },
          ]
        : []),
      {
        meter: "post_session_summary",
        quantity: 1,
        unit_credits: SAMPLE_RATE_CARD.postSessionSummaryPerSession,
        billed_credits: quote.postSessionSummary,
      },
    ]
    await db.execute(
      sql`select record_prastuti_usage_and_settle(
        ${session.id}::uuid,
        ${session.organizationId}::uuid,
        ${JSON.stringify(meters)}::jsonb,
        ${quote.total}::integer
      )`,
    )
  }
  const updated = await sessionById(session.id)
  if (!updated) throw new Error("Session not found after transition.")
  return updated
}

export async function loadCredits(
  credits: number,
  identity: OrganizerIdentity,
  paymentReference = `manual:${crypto.randomUUID()}`,
) {
  const loadedAt = new Date()
  const db = getDatabase()
  const [lot] = await db
    .insert(creditLots)
    .values({
      organizationId: identity.organizationId,
      paymentReference,
      originalCredits: credits,
      remainingCredits: credits,
      loadedAt,
      expiresAt: creditExpiryFromLoadedAt(loadedAt),
    })
    .returning()
  if (!lot) throw new Error("Unable to create the credit lot.")
  await db.insert(creditLedgerEntries).values({
    organizationId: identity.organizationId,
    lotId: lot.id,
    type: "load",
    credits,
    reason: paymentReference.startsWith("local")
      ? "Local development credit load"
      : "Confirmed payment credit load",
  })
  return {
    id: lot.id,
    loadedAt: lot.loadedAt.toISOString(),
    expiresAt: lot.expiresAt.toISOString(),
    originalCredits: lot.originalCredits,
    remainingCredits: lot.remainingCredits,
    reservedCredits: 0,
  }
}
