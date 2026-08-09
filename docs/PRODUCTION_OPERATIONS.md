# Production operations

This runbook describes the managed Prastuti deployment. A successful local
build is not evidence that third-party providers, pricing, tax handling, or
public routing are production-ready.

## Required configuration

Start from `apps/web/.env.example`. Managed mode requires:

- canonical `APP_ORIGIN` and Clerk publishable/secret keys;
- Neon `DATABASE_URL` with `DATABASE_DRIVER=neon-http`;
- Upstash REST URL and token;
- private Vercel Blob read/write token;
- Cloudmersive malware scanning key;
- Ably API key;
- Azure Speech region/key and Translator endpoint, region, and key;
- Razorpay public key, secret, webhook secret, and an explicitly approved
  `CREDIT_PRICE_PAISE`.
- an OpenTelemetry export path: Vercel's collector or an approved
  `OTEL_EXPORTER_OTLP_ENDPOINT` outside Vercel.

Store secrets in the deployment platform. Never commit them, expose them in
client bundles, paste them into issues, or log their values.

## Deployment order

1. Provision a fresh database and run every checked-in Drizzle migration.
2. Configure secrets and provider allowlists for the production origin.
3. Configure the Razorpay webhook to
   `https://<product-origin>/api/webhooks/razorpay`.
4. Subscribe to captured-payment events and the supported refund/dispute
   events. Refund and dispute events enter manual review; they do not
   automatically change balances.
5. Deploy the application and Workflow endpoints from the same commit.
6. Confirm `/api/system/health` is healthy. Managed mode must remain
   unavailable if any required adapter is missing.
7. Run an authenticated low-value acceptance session: create, upload, start,
   join, caption, translate, play audio, stop, settle, and download artifacts.
8. Confirm the ledger, usage meters, webhook event, audit event, private asset,
   and workflow artifacts before increasing traffic.

## Operational invariants

- Credit loads expire exactly 365 days after confirmed payment.
- Provider event IDs are idempotency keys; webhook replay must not load twice.
- Paid amount and currency must match the stored order before loading credits.
- Reservations use the earliest-expiring eligible lots atomically.
- Settlement records itemized usage meters and releases unused reservations to
  their original lots.
- Payment, reservation, and settlement truth lives in Postgres, not Workflow.
- Uploaded presentation assets are private and scheduled for deletion after
  30 days.
- Attendee and presenter realtime credentials are short-lived and scoped to one
  session.

## Monitoring and response

Prastuti initializes OpenTelemetry as `prastuti-web` and emits redacted JSON
operational events with request and active trace correlation. Route traces
through Vercel's collector or an approved OTLP endpoint, and route runtime logs
through the selected log drain. Persisted audit records remain the durable
business trail; operational telemetry is not a financial source of truth.

Alert on unhealthy managed configuration, webhook signature or amount
failures, repeated workflow failures, rate-limiter unavailability, reservation
conflicts, provider error rates, latency, and unexpected spend. The event
catalog and redaction contract are documented in
[observability](OBSERVABILITY.md).

If finalization fails after financial settlement, retry with:

```text
POST /api/sessions/<session-id>/finalization
```

The organizer must be authenticated and send the same-origin CSRF headers used
by other mutations. Retrying finalization must not repeat financial
settlement.

Refund and dispute events require an operator to reconcile Razorpay state,
policy, tax documents, the credit ledger, and the audit trail. Do not edit
wallet totals directly.

## Rollback and recovery

- Roll application code back to a previously verified deployment without
  rolling the database schema backward.
- Prefer forward-only corrective migrations. Back up and test restoration
  before every destructive data migration.
- Rotate a provider secret immediately if exposure is suspected, then inspect
  audit and provider logs.
- Disable checkout if payment reconciliation is unhealthy; do not bypass
  signature, amount, currency, or idempotency checks.
- Keep managed health fail-closed until the affected provider and invariant
  checks recover.

Local recovery and verification commands are documented in
[local development](LOCAL_DEVELOPMENT.md).
