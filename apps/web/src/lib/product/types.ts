export const supportedLanguages = [
  "Kannada",
  "English",
  "Hindi",
  "Telugu",
] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]
export type SessionStatus =
  | "draft"
  | "ready"
  | "live"
  | "paused"
  | "settling"
  | "completed"
  | "failed"

export type CaptionTranslations = Partial<
  Record<SupportedLanguage, string>
>

export type CaptionSegment = {
  id: string
  sequence: number
  sourceText: string
  translations: CaptionTranslations
  audioReferences?: Partial<Record<SupportedLanguage, string>>
  createdAt: string
  correctedAt?: string
}

export type SessionContext = {
  glossary: Array<{ source: string; preferred: string }>
  notes: string
}

export type ProductSession = {
  id: string
  organizationId: string
  organizerId: string
  name: string
  sourceLanguage: SupportedLanguage
  targetLanguages: SupportedLanguage[]
  expectedMinutes: number
  translatedAudio: boolean
  status: SessionStatus
  joinCode: string
  reservedCredits: number
  consumedCredits: number
  attendeeCount: number
  context: SessionContext
  segments: CaptionSegment[]
  createdAt: string
  startedAt?: string
  endedAt?: string
}

export type OrganizerIdentity = {
  id: string
  organizationId: string
  displayName: string
  workspaceName: string
}

export type CreditLedgerItem = {
  id: string
  type:
    | "load"
    | "reserve"
    | "consume"
    | "release"
    | "expire"
    | "refund"
    | "chargeback"
    | "adjustment"
  credits: number
  sessionId?: string
  createdAt: string
  note: string
}

export type WalletSnapshot = {
  availableCredits: number
  reservedCredits: number
  expiresAt: string | null
  lots: Array<{
    id: string
    loadedAt: string
    expiresAt: string
    originalCredits: number
    remainingCredits: number
    reservedCredits: number
  }>
  ledger: CreditLedgerItem[]
}

export type WorkspaceSnapshot = {
  identity: OrganizerIdentity
  sessions: ProductSession[]
  wallet: WalletSnapshot
}

export type AttendeeSession = {
  attendeeId: string
  sessionId: string
  joinCode: string
  csrfToken: string
  joinedAt: string
}
