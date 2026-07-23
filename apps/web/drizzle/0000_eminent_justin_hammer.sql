CREATE TYPE "public"."ledger_entry_type" AS ENUM('load', 'reserve', 'consume', 'release', 'expire', 'refund', 'chargeback', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('draft', 'ready', 'live', 'settling', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lot_id" uuid,
	"session_id" uuid,
	"provider_event_id" text,
	"type" "ledger_entry_type" NOT NULL,
	"credits" integer NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_nonzero" CHECK ("credit_ledger_entries"."credits" <> 0)
);
--> statement-breakpoint
CREATE TABLE "credit_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payment_reference" text NOT NULL,
	"original_credits" integer NOT NULL,
	"remaining_credits" integer NOT NULL,
	"loaded_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_lots_original_positive" CHECK ("credit_lots"."original_credits" > 0),
	CONSTRAINT "credit_lots_remaining_valid" CHECK ("credit_lots"."remaining_credits" >= 0 and "credit_lots"."remaining_credits" <= "credit_lots"."original_credits"),
	CONSTRAINT "credit_lots_expire_after_load" CHECK ("credit_lots"."expires_at" = "credit_lots"."loaded_at" + interval '365 days')
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "session_status" DEFAULT 'draft' NOT NULL,
	"source_language" text NOT NULL,
	"target_languages" jsonb NOT NULL,
	"reserved_credits" integer DEFAULT 0 NOT NULL,
	"consumed_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_reserved_credits_nonnegative" CHECK ("sessions"."reserved_credits" >= 0),
	CONSTRAINT "sessions_consumed_credits_nonnegative" CHECK ("sessions"."consumed_credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "usage_meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"meter" text NOT NULL,
	"language" text,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_credits" numeric(12, 3) NOT NULL,
	"billed_credits" integer NOT NULL,
	"provider_cost_minor" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_meter_quantity_positive" CHECK ("usage_meters"."quantity" > 0),
	CONSTRAINT "usage_meter_unit_credits_nonnegative" CHECK ("usage_meters"."unit_credits" >= 0),
	CONSTRAINT "usage_meter_billed_credits_nonnegative" CHECK ("usage_meters"."billed_credits" >= 0)
);
--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_lot_id_credit_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."credit_lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_meters" ADD CONSTRAINT "usage_meters_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_organization_created_idx" ON "credit_ledger_entries" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_provider_event_uidx" ON "credit_ledger_entries" USING btree ("provider_event_id") WHERE "credit_ledger_entries"."provider_event_id" is not null;--> statement-breakpoint
CREATE INDEX "credit_lots_organization_expiry_idx" ON "credit_lots" USING btree ("organization_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_lots_payment_reference_uidx" ON "credit_lots" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX "sessions_organization_id_idx" ON "sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "usage_meters_session_idx" ON "usage_meters" USING btree ("session_id");