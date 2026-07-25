ALTER TYPE "public"."session_status" ADD VALUE 'paused' BEFORE 'settling';--> statement-breakpoint
CREATE TABLE "attendee_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"actor_external_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"request_id" text,
	"outcome" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caption_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"source_text" text NOT NULL,
	"translations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"corrected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caption_segments_sequence_positive" CHECK ("caption_segments"."sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"reserved_credits" integer NOT NULL,
	"consumed_credits" integer DEFAULT 0 NOT NULL,
	"released_credits" integer DEFAULT 0 NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_reservations_reserved_positive" CHECK ("credit_reservations"."reserved_credits" > 0),
	CONSTRAINT "credit_reservations_settlement_valid" CHECK ("credit_reservations"."consumed_credits" >= 0 and "credit_reservations"."released_credits" >= 0 and "credit_reservations"."consumed_credits" + "credit_reservations"."released_credits" <= "credit_reservations"."reserved_credits")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_order_id" text NOT NULL,
	"receipt" text NOT NULL,
	"credits" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"provider_payment_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_orders_credits_positive" CHECK ("payment_orders"."credits" > 0),
	CONSTRAINT "payment_orders_amount_positive" CHECK ("payment_orders"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "presentation_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"scan_status" text DEFAULT 'pending' NOT NULL,
	"extraction_status" text DEFAULT 'pending' NOT NULL,
	"extracted_text" text,
	"delete_after" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presentation_assets_size_positive" CHECK ("presentation_assets"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error_code" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text,
	"content" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"workflow_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "external_id" text;--> statement-breakpoint
UPDATE "organizations" SET "external_id" = 'legacy:' || "id"::text WHERE "external_id" IS NULL;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "external_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "organizer_external_id" text;--> statement-breakpoint
UPDATE "sessions" SET "organizer_external_id" = 'legacy' WHERE "organizer_external_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "organizer_external_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "expected_minutes" integer;--> statement-breakpoint
UPDATE "sessions" SET "expected_minutes" = 60 WHERE "expected_minutes" IS NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "expected_minutes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "translated_audio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "join_code" text;--> statement-breakpoint
UPDATE "sessions" SET "join_code" = upper(substr(replace("id"::text, '-', ''), 1, 8)) WHERE "join_code" IS NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "join_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "attendee_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "context" jsonb DEFAULT '{"glossary":[],"notes":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendee_sessions" ADD CONSTRAINT "attendee_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caption_segments" ADD CONSTRAINT "caption_segments_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_lot_id_credit_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."credit_lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_assets" ADD CONSTRAINT "presentation_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_assets" ADD CONSTRAINT "presentation_assets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_artifacts" ADD CONSTRAINT "session_artifacts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendee_sessions_token_hash_uidx" ON "attendee_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "attendee_sessions_session_idx" ON "attendee_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "audit_events_org_created_idx" ON "audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "caption_segments_session_sequence_uidx" ON "caption_segments" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_reservations_session_lot_uidx" ON "credit_reservations" USING btree ("session_id","lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_uidx" ON "organization_members" USING btree ("organization_id","external_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_provider_order_uidx" ON "payment_orders" USING btree ("provider","provider_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_receipt_uidx" ON "payment_orders" USING btree ("receipt");--> statement-breakpoint
CREATE UNIQUE INDEX "presentation_assets_storage_key_uidx" ON "presentation_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "presentation_assets_retention_idx" ON "presentation_assets" USING btree ("delete_after","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_events_provider_event_uidx" ON "provider_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_artifacts_session_kind_uidx" ON "session_artifacts" USING btree ("session_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_join_code_uidx" ON "sessions" USING btree ("join_code");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_external_id_unique" UNIQUE("external_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expected_minutes_valid" CHECK ("sessions"."expected_minutes" between 1 and 480);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_attendee_count_nonnegative" CHECK ("sessions"."attendee_count" >= 0);--> statement-breakpoint
CREATE OR REPLACE FUNCTION reserve_prastuti_credits(
  p_session_id uuid,
  p_organization_id uuid,
  p_credits integer
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_status session_status;
  v_remaining integer := p_credits;
  v_take integer;
  v_lot record;
BEGIN
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'Reservation must be positive';
  END IF;

  SELECT status INTO v_session_status
  FROM sessions
  WHERE id = p_session_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_session_status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft session can be started';
  END IF;

  IF (
    SELECT coalesce(sum(remaining_credits), 0)
    FROM credit_lots
    WHERE organization_id = p_organization_id
      AND expires_at > now()
  ) < p_credits THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  FOR v_lot IN
    SELECT id, remaining_credits
    FROM credit_lots
    WHERE organization_id = p_organization_id
      AND expires_at > now()
      AND remaining_credits > 0
    ORDER BY expires_at, loaded_at, id
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining = 0;
    v_take := least(v_lot.remaining_credits, v_remaining);

    UPDATE credit_lots
    SET remaining_credits = remaining_credits - v_take
    WHERE id = v_lot.id;

    INSERT INTO credit_reservations (
      session_id,
      lot_id,
      reserved_credits
    ) VALUES (
      p_session_id,
      v_lot.id,
      v_take
    );

    INSERT INTO credit_ledger_entries (
      organization_id,
      lot_id,
      session_id,
      type,
      credits,
      reason
    ) VALUES (
      p_organization_id,
      v_lot.id,
      p_session_id,
      'reserve',
      -v_take,
      'Session credit reservation'
    );

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  UPDATE sessions
  SET status = 'live',
      reserved_credits = p_credits,
      started_at = now()
  WHERE id = p_session_id;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION settle_prastuti_credits(
  p_session_id uuid,
  p_organization_id uuid,
  p_consumed_credits integer
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_status session_status;
  v_reserved integer;
  v_remaining integer;
  v_consume integer;
  v_release integer;
  v_reservation record;
BEGIN
  SELECT status, reserved_credits
  INTO v_session_status, v_reserved
  FROM sessions
  WHERE id = p_session_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_session_status NOT IN ('live', 'paused') THEN
    RAISE EXCEPTION 'Only an active session can be stopped';
  END IF;

  v_remaining := greatest(0, least(p_consumed_credits, v_reserved));

  FOR v_reservation IN
    SELECT id, lot_id, reserved_credits
    FROM credit_reservations
    WHERE session_id = p_session_id AND settled_at IS NULL
    ORDER BY created_at, id
    FOR UPDATE
  LOOP
    v_consume := least(v_reservation.reserved_credits, v_remaining);
    v_release := v_reservation.reserved_credits - v_consume;

    UPDATE credit_reservations
    SET consumed_credits = v_consume,
        released_credits = v_release,
        settled_at = now()
    WHERE id = v_reservation.id;

    IF v_release > 0 THEN
      UPDATE credit_lots
      SET remaining_credits = remaining_credits + v_release
      WHERE id = v_reservation.lot_id;
    END IF;

    IF v_consume > 0 THEN
      INSERT INTO credit_ledger_entries (
        organization_id,
        lot_id,
        session_id,
        type,
        credits,
        reason
      ) VALUES (
        p_organization_id,
        v_reservation.lot_id,
        p_session_id,
        'consume',
        -v_consume,
        'Settled session usage'
      );
    END IF;

    IF v_release > 0 THEN
      INSERT INTO credit_ledger_entries (
        organization_id,
        lot_id,
        session_id,
        type,
        credits,
        reason
      ) VALUES (
        p_organization_id,
        v_reservation.lot_id,
        p_session_id,
        'release',
        v_release,
        'Unused reservation returned'
      );
    END IF;

    v_remaining := v_remaining - v_consume;
  END LOOP;

  UPDATE sessions
  SET status = 'completed',
      consumed_credits = greatest(0, least(p_consumed_credits, v_reserved)),
      ended_at = now()
  WHERE id = p_session_id;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION process_razorpay_order_paid(
  p_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_order_id text,
  p_payment_id text,
  p_amount_minor integer,
  p_currency text
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_order payment_orders%ROWTYPE;
  v_lot_id uuid;
BEGIN
  INSERT INTO provider_events (
    provider,
    provider_event_id,
    event_type,
    payload_hash,
    status
  ) VALUES (
    'razorpay',
    p_event_id,
    p_event_type,
    p_payload_hash,
    'received'
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT * INTO v_order
  FROM payment_orders
  WHERE provider = 'razorpay' AND provider_order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;
  IF v_order.amount_minor <> p_amount_minor OR v_order.currency <> p_currency THEN
    RAISE EXCEPTION 'Payment amount or currency mismatch';
  END IF;
  IF v_order.status = 'paid' THEN
    UPDATE provider_events
    SET status = 'processed', processed_at = now()
    WHERE provider = 'razorpay' AND provider_event_id = p_event_id;
    RETURN true;
  END IF;

  UPDATE payment_orders
  SET status = 'paid',
      provider_payment_id = p_payment_id,
      paid_at = now()
  WHERE id = v_order.id;

  INSERT INTO credit_lots (
    organization_id,
    payment_reference,
    original_credits,
    remaining_credits,
    loaded_at,
    expires_at
  ) VALUES (
    v_order.organization_id,
    'razorpay:' || p_payment_id,
    v_order.credits,
    v_order.credits,
    now(),
    now() + interval '365 days'
  )
  RETURNING id INTO v_lot_id;

  INSERT INTO credit_ledger_entries (
    organization_id,
    lot_id,
    provider_event_id,
    type,
    credits,
    reason,
    metadata
  ) VALUES (
    v_order.organization_id,
    v_lot_id,
    p_event_id,
    'load',
    v_order.credits,
    'Razorpay payment confirmed',
    jsonb_build_object(
      'provider_order_id', p_order_id,
      'provider_payment_id', p_payment_id
    )
  );

  UPDATE provider_events
  SET status = 'processed', processed_at = now()
  WHERE provider = 'razorpay' AND provider_event_id = p_event_id;

  RETURN true;
END;
$$;
