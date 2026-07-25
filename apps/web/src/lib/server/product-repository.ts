import "server-only"

import { productRuntime } from "@/lib/runtime/product-runtime"
import * as memory from "@/lib/server/product-store"
import * as postgres from "@/lib/server/postgres-product-repository"
import type {
  OrganizerIdentity,
  ProductSession,
  SessionContext,
  SupportedLanguage,
} from "@/lib/product/types"

export function usesPostgresRepository() {
  return (
    productRuntime().mode === "managed" ||
    process.env.PRASTUTI_PERSISTENCE_MODE === "postgres"
  )
}

export async function prepareOrganizerWorkspace(identity: OrganizerIdentity) {
  if (!usesPostgresRepository()) return identity
  const persisted = await postgres.ensureOrganizerIdentity({
    externalOrganizationId: `local:${identity.organizationId}`,
    externalUserId: identity.id,
    displayName: identity.displayName,
    workspaceName: identity.workspaceName,
    preferredOrganizationId: identity.organizationId,
    role: "owner",
  })
  if (productRuntime().mode === "mock") {
    await postgres.ensureDevelopmentCredits(persisted)
  }
  return persisted
}

export async function workspaceSnapshot(identity: OrganizerIdentity) {
  return usesPostgresRepository()
    ? postgres.workspaceSnapshot(identity)
    : memory.workspaceSnapshot(identity)
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
  return usesPostgresRepository()
    ? postgres.createProductSession(input, identity)
    : memory.createProductSession(input)
}

export async function sessionById(id: string) {
  return usesPostgresRepository()
    ? postgres.sessionById(id)
    : memory.sessionById(id)
}

export async function sessionByJoinCode(joinCode: string) {
  return usesPostgresRepository()
    ? postgres.sessionByJoinCode(joinCode)
    : memory.sessionByJoinCode(joinCode)
}

export async function updateSessionContext(
  session: ProductSession,
  context: SessionContext,
) {
  return usesPostgresRepository()
    ? postgres.updateSessionContext(session, context)
    : memory.updateSessionContext(session, context)
}

export async function createAttendeeSession(joinCode: string) {
  return usesPostgresRepository()
    ? postgres.createAttendeeSession(joinCode)
    : memory.createAttendeeSession(joinCode)
}

export async function attendeeSessionByToken(token: string | undefined) {
  return usesPostgresRepository()
    ? postgres.attendeeSessionByToken(token)
    : memory.attendeeSessionByToken(token)
}

export async function validateAttendeeCsrf(
  token: string | undefined,
  csrfToken: string | null,
) {
  if (usesPostgresRepository()) {
    return postgres.validateAttendeeCsrf(token, csrfToken)
  }
  const attendee = memory.attendeeSessionByToken(token)
  return Boolean(attendee && csrfToken && attendee.csrfToken === csrfToken)
}

export async function transitionSession(
  session: ProductSession,
  action: "start" | "pause" | "resume" | "stop",
) {
  return usesPostgresRepository()
    ? postgres.transitionSession(session, action)
    : memory.transitionSession(session, action)
}

export async function appendSegment(
  session: ProductSession,
  sourceText?: string,
) {
  return usesPostgresRepository()
    ? postgres.appendSegment(session, sourceText)
    : memory.appendSegment(session, sourceText)
}

export async function correctSegment(
  session: ProductSession,
  segmentId: string,
  sourceText: string,
) {
  return usesPostgresRepository()
    ? postgres.correctSegment(session, segmentId, sourceText)
    : memory.correctSegment(session, segmentId, sourceText)
}

export async function loadCredits(
  credits: number,
  identity: OrganizerIdentity,
  paymentReference?: string,
) {
  return usesPostgresRepository()
    ? postgres.loadCredits(credits, identity, paymentReference)
    : memory.loadCredits(credits)
}

export const buildSessionArtifacts = memory.buildSessionArtifacts

