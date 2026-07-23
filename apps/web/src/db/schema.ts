import { sql } from "drizzle-orm"
import {
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
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: sessionStatus("status").default("draft").notNull(),
    sourceLanguage: text("source_language").notNull(),
    targetLanguages: jsonb("target_languages").$type<string[]>().notNull(),
    reservedCredits: integer("reserved_credits").default(0).notNull(),
    consumedCredits: integer("consumed_credits").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sessions_organization_id_idx").on(table.organizationId),
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
