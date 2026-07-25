import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const sessionStatus = pgEnum("session_status", [
  "draft",
  "ready",
  "live",
  "paused",
  "settling",
  "completed",
  "failed",
])

export const ledgerEntryType = pgEnum("ledger_entry_type", [
  "load",
  "reserve",
  "consume",
  "release",
  "expire",
  "refund",
  "chargeback",
  "adjustment",
])

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: text("external_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    externalUserId: text("external_user_id").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("organization_members_org_user_uidx").on(
      table.organizationId,
      table.externalUserId,
    ),
  ],
)

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: sessionStatus("status").default("draft").notNull(),
    organizerExternalId: text("organizer_external_id").notNull(),
    sourceLanguage: text("source_language").notNull(),
    targetLanguages: jsonb("target_languages").$type<string[]>().notNull(),
    expectedMinutes: integer("expected_minutes").notNull(),
    translatedAudio: boolean("translated_audio").default(false).notNull(),
    joinCode: text("join_code").notNull(),
    attendeeCount: integer("attendee_count").default(0).notNull(),
    context: jsonb("context")
      .$type<{
        glossary: Array<{ source: string; preferred: string }>
        notes: string
      }>()
      .default({ glossary: [], notes: "" })
      .notNull(),
    reservedCredits: integer("reserved_credits").default(0).notNull(),
    consumedCredits: integer("consumed_credits").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sessions_organization_id_idx").on(table.organizationId),
    uniqueIndex("sessions_join_code_uidx").on(table.joinCode),
    check(
      "sessions_expected_minutes_valid",
      sql`${table.expectedMinutes} between 1 and 480`,
    ),
    check(
      "sessions_attendee_count_nonnegative",
      sql`${table.attendeeCount} >= 0`,
    ),
    check(
      "sessions_reserved_credits_nonnegative",
      sql`${table.reservedCredits} >= 0`,
    ),
    check(
      "sessions_consumed_credits_nonnegative",
      sql`${table.consumedCredits} >= 0`,
    ),
  ],
)

export const captionSegments = pgTable(
  "caption_segments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    sourceText: text("source_text").notNull(),
    translations: jsonb("translations")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    audioReferences: jsonb("audio_references")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("caption_segments_session_sequence_uidx").on(
      table.sessionId,
      table.sequence,
    ),
    check("caption_segments_sequence_positive", sql`${table.sequence} > 0`),
  ],
)

export const attendeeSessions = pgTable(
  "attendee_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    csrfHash: text("csrf_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("attendee_sessions_token_hash_uidx").on(table.tokenHash),
    index("attendee_sessions_session_idx").on(table.sessionId),
  ],
)

export const creditLots = pgTable(
  "credit_lots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    paymentReference: text("payment_reference").notNull(),
    originalCredits: integer("original_credits").notNull(),
    remainingCredits: integer("remaining_credits").notNull(),
    loadedAt: timestamp("loaded_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("credit_lots_organization_expiry_idx").on(
      table.organizationId,
      table.expiresAt,
    ),
    uniqueIndex("credit_lots_payment_reference_uidx").on(
      table.paymentReference,
    ),
    check("credit_lots_original_positive", sql`${table.originalCredits} > 0`),
    check(
      "credit_lots_remaining_valid",
      sql`${table.remainingCredits} >= 0 and ${table.remainingCredits} <= ${table.originalCredits}`,
    ),
    check(
      "credit_lots_expire_after_load",
      sql`${table.expiresAt} = ${table.loadedAt} + interval '365 days'`,
    ),
  ],
)

export const creditLedgerEntries = pgTable(
  "credit_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").references(() => creditLots.id, {
      onDelete: "restrict",
    }),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "restrict",
    }),
    providerEventId: text("provider_event_id"),
    type: ledgerEntryType("type").notNull(),
    credits: integer("credits").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("credit_ledger_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    uniqueIndex("credit_ledger_provider_event_uidx")
      .on(table.providerEventId)
      .where(sql`${table.providerEventId} is not null`),
    check("credit_ledger_nonzero", sql`${table.credits} <> 0`),
  ],
)

export const creditReservations = pgTable(
  "credit_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => creditLots.id, { onDelete: "restrict" }),
    reservedCredits: integer("reserved_credits").notNull(),
    consumedCredits: integer("consumed_credits").default(0).notNull(),
    releasedCredits: integer("released_credits").default(0).notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("credit_reservations_session_lot_uidx").on(
      table.sessionId,
      table.lotId,
    ),
    check(
      "credit_reservations_reserved_positive",
      sql`${table.reservedCredits} > 0`,
    ),
    check(
      "credit_reservations_settlement_valid",
      sql`${table.consumedCredits} >= 0 and ${table.releasedCredits} >= 0 and ${table.consumedCredits} + ${table.releasedCredits} <= ${table.reservedCredits}`,
    ),
  ],
)

export const usageMeters = pgTable(
  "usage_meters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    meter: text("meter").notNull(),
    language: text("language"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitCredits: numeric("unit_credits", {
      precision: 12,
      scale: 3,
    }).notNull(),
    billedCredits: integer("billed_credits").notNull(),
    providerCostMinor: integer("provider_cost_minor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("usage_meters_session_idx").on(table.sessionId),
    check("usage_meter_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "usage_meter_unit_credits_nonnegative",
      sql`${table.unitCredits} >= 0`,
    ),
    check(
      "usage_meter_billed_credits_nonnegative",
      sql`${table.billedCredits} >= 0`,
    ),
  ],
)

export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id").notNull(),
    receipt: text("receipt").notNull(),
    credits: integer("credits").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").default("INR").notNull(),
    status: text("status").default("created").notNull(),
    providerPaymentId: text("provider_payment_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("payment_orders_provider_order_uidx").on(
      table.provider,
      table.providerOrderId,
    ),
    uniqueIndex("payment_orders_receipt_uidx").on(table.receipt),
    check("payment_orders_credits_positive", sql`${table.credits} > 0`),
    check("payment_orders_amount_positive", sql`${table.amountMinor} > 0`),
  ],
)

export const providerEvents = pgTable(
  "provider_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").default("received").notNull(),
    errorCode: text("error_code"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("provider_events_provider_event_uidx").on(
      table.provider,
      table.providerEventId,
    ),
  ],
)

export const presentationAssets = pgTable(
  "presentation_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "cascade",
    }),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    scanStatus: text("scan_status").default("pending").notNull(),
    extractionStatus: text("extraction_status").default("pending").notNull(),
    extractedText: text("extracted_text"),
    deleteAfter: timestamp("delete_after", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("presentation_assets_storage_key_uidx").on(table.storageKey),
    index("presentation_assets_retention_idx").on(
      table.deleteAfter,
      table.deletedAt,
    ),
    check("presentation_assets_size_positive", sql`${table.sizeBytes} > 0`),
  ],
)

export const sessionArtifacts = pgTable(
  "session_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    storageKey: text("storage_key"),
    content: text("content"),
    status: text("status").default("ready").notNull(),
    workflowRunId: text("workflow_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("session_artifacts_session_kind_uidx").on(
      table.sessionId,
      table.kind,
    ),
  ],
)

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),
    actorExternalId: text("actor_external_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    requestId: text("request_id"),
    outcome: text("outcome").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
)
