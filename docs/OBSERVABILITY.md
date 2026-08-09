# Observability

Prastuti initializes OpenTelemetry in `apps/web/src/instrumentation.ts` with the
service name `prastuti-web`. Next.js request spans and propagated trace context
remain no-op or locally scoped when no collector is configured, so local
development still requires no external infrastructure.

## Export boundary

- Vercel deployments use the platform's automatically configured OpenTelemetry
  collector.
- Other managed deployments may set an approved
  `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Structured JSON events are written to the runtime log stream and require a
  production log drain for retention, search, dashboards, and alerts.
- `/api/system/health` reports `vercel-collector`, `otlp`, or `console-only`
  without returning endpoint values or credentials.

Configuring a collector or endpoint does not by itself complete production
observability. The operator must verify trace and log delivery, retention,
access control, regional handling, alert routing, and cost limits in the
selected backend.

## Event catalog

| Event | Level | Meaning |
| --- | --- | --- |
| `audit.recorded` | info | A durable Postgres audit write or local structured audit event completed |
| `audit.write_failed` | error | The durable audit write failed |
| `rate_limit.denied` | warn | A configured rate limit rejected a request |
| `rate_limit.unavailable` | error | Managed rate limiting was not configured and failed closed |
| `payment.webhook.accepted` | info | A signed Razorpay event was reconciled or accepted for manual review |
| `payment.webhook.rejected` | warn | Required headers or signature verification failed |
| `payment.webhook.failed` | error | A verified webhook could not be reconciled |
| `provider.request_failed` | error | A managed provider call failed after the durable local write |

Events include bounded operational dimensions such as provider, capability,
operation, status code, outcome, and duration. They may include the generated
request ID plus an active trace/span ID. They do not include raw webhook bodies,
provider signatures or event IDs, access tokens, cookies, captions, actor IDs,
organization IDs, session IDs, or segment IDs.

## Redaction contract

Telemetry attributes accept at most 32 primitive values. Attribute names that
indicate authorization, cookies, credentials, passwords, raw bodies, secrets,
signatures, tokens, or API keys are replaced with `[REDACTED]`. Structured
objects are omitted, strings are stripped of control characters and limited to
256 characters, and non-finite numbers are omitted.

The sanitizer is a final guardrail, not permission to pass sensitive values to
the telemetry API. Callers must use low-cardinality operational dimensions and
must never attach request bodies, provider responses, presentation content, or
personal data.

## Production acceptance

Before enabling general traffic:

1. Verify one trace and its correlated structured events reach the approved
   backend from the deployed commit.
2. Confirm secret, payload, caption, and direct-identifier fields are absent.
3. Restrict backend access and approve retention and regional processing.
4. Alert on managed health failure, audit write failure, webhook failure or
   rejection spikes, rate-limiter unavailability, workflow retries, provider
   error rates, latency, and unexpected spend.
5. Exercise alert delivery and record the responsible responder and runbook.

These acceptance steps require the deployed environment and remain external
production gates until evidence is recorded.
