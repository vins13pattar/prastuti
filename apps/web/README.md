# Prastuti web

Prastuti is an India-first live presentation translation product. This
vertical slice includes local organizer identity, session creation, presenter
preflight, live captions, attendee joining, prepaid credit settlement, and
post-session outputs.

## Run locally without infrastructure

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Development defaults to `PRASTUTI_RUNTIME_MODE=mock`. Enter the local workspace,
create a session, start it, open the QR attendee view in another tab, and add a
deterministic or manual caption. Optional microphone preflight and Chromium's
browser speech-recognition API can provide local presenter input.

Local workspace data is intentionally process-local and resets when the
development server restarts. It needs no cloud accounts or Docker services.

Run the automated local product check:

```bash
pnpm local:smoke
```

For persistence integration, use the optional Docker-backed PostgreSQL and Valkey profile described in [local development](../../docs/LOCAL_DEVELOPMENT.md).

## Quality checks

```bash
pnpm verify
```

## Current product behavior

- No subscription plans or tiers.
- Credits are prepaid in independent lots.
- Each lot expires 365 days after its confirmed loading timestamp.
- Reservations draw from the earliest-expiring eligible lot first.
- Sessions reserve an estimate, meter actual usage, and return unused credits to the original lots.
- Local organizer sessions use bounded opaque HttpOnly cookies and CSRF
  protection; attendee sessions are anonymous and scoped to a join code.
- Session creation, context import, start/pause/resume/stop, QR join, caption
  delivery, correction, and artifact download use real Route Handlers.
- Starting reserves the estimate from the earliest-expiring lots. Stopping
  consumes actual local usage and releases the remainder.
- The local speech path supports microphone preflight, optional browser speech
  recognition, deterministic translation, and browser speech synthesis.
- Managed mode connects Clerk identity, durable Postgres repositories, Upstash
  rate limiting, private Vercel Blob assets, Cloudmersive malware scanning,
  Azure speech/translation/audio, scoped Ably realtime, signed Razorpay
  checkout/webhooks, and Vercel Workflow finalization.
- Managed mode fails closed when a required provider or security setting is
  absent. Mock behavior is never substituted in production.

The sample rate card supports product evaluation. It is not approved public pricing.

## TypeScript architecture

All authored product code can remain in TypeScript:

- Next.js 16, React, Tailwind CSS, and shadcn/ui for the control plane and attendee experience.
- Vercel Functions for stateless token, segment, wallet, webhook, and settlement APIs.
- Neon Postgres through its HTTP driver, with Drizzle ORM and checked-in migrations.
- Upstash Redis for ephemeral coordination and rate limiting.
- Azure Speech and Translator for recognition, translation, and audio.
- Ably for persistent, scoped realtime connections.
- Razorpay for prepaid checkout and idempotent webhook reconciliation.
- Durable TypeScript workflows for uploads, summaries, reconciliation, and post-session jobs.
- Typed adapters for speech, translation, media, payments, object storage, and identity.

No Prastuti-owned application server or queue worker needs to remain active while there are no sessions. Idle compute can therefore approach zero, although persistent storage, domains, observability retention, and provider minimum charges can remain.

## Database schema

```bash
pnpm db:generate
pnpm db:check
pnpm local:infra:up
cp local.env.example .env.local
pnpm local:db:migrate
```

The checked-in migrations define organizations and memberships, sessions,
caption/audio records, credit lots, immutable ledger entries, reservations,
usage meters, payment events, private presentation assets, artifacts, and
audit events. Atomic database functions protect top-up reconciliation,
earliest-expiry reservation, and metered settlement. Managed mode uses the
Neon HTTP driver; local persistence tests use PostgreSQL through `postgres-js`.

Run the durable integration checks with:

```bash
pnpm local:infra:up
pnpm local:db:migrate
pnpm local:persistent:smoke
pnpm local:postgres:verify
```

## Deployment readiness

Copy `.env.example` to `.env.local`, select managed runtime mode, and configure
providers. The read-only `/api/system/architecture` and `/api/system/health`
endpoints report adapter status and missing environment variable names without
exposing secret values. Follow
[production operations](../../docs/PRODUCTION_OPERATIONS.md) before deploying.
