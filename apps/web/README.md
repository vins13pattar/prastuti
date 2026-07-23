# Prastuti web

Prastuti is an India-first live presentation translation product. This vertical slice includes the public launch page, organizer dashboard, prepaid credit wallet, session credit estimator, session builder, and demo live console.

## Run locally without infrastructure

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Development defaults to `PRASTUTI_RUNTIME_MODE=mock`. The product pages, deterministic credit behavior, and simulated top-up need no cloud accounts or Docker services.

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
- Credit quote and mock-only top-up endpoints are implemented as Route Handlers.
- Payment, speech, storage, authentication, and live media providers are not connected.

The sample rate card supports product evaluation. It is not approved public pricing.

## TypeScript architecture

All authored product code can remain in TypeScript:

- Next.js 16, React, Tailwind CSS, and shadcn/ui for the control plane and attendee experience.
- Vercel Functions for stateless token, segment, wallet, webhook, and settlement APIs.
- Neon Postgres through its HTTP driver, with Drizzle ORM and checked-in migrations.
- Upstash Redis for ephemeral coordination and rate limiting.
- Managed speech, WebRTC, and realtime providers for persistent live connections.
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

The initial migration defines organizations, sessions, credit lots, immutable ledger entries, and usage meters. Production uses the Neon HTTP driver; optional local integration uses PostgreSQL through `postgres-js`. Database initialization is lazy, so mock mode and builds do not require `DATABASE_URL`.

## Deployment readiness

Copy `.env.example` to `.env.local`, select managed runtime mode, and configure providers. The read-only `/api/system/architecture` and `/api/system/health` endpoints report adapter status and missing environment variable names without exposing secret values.
