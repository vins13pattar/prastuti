# Prastuti

Prastuti is a startup product concept for real-time multilingual presentations and classrooms. A presenter speaks once, while attendees listen and read in a preferred language from their own phones.

The commercial model is prepaid usage credits, without subscription plans. Every credit load forms a separate lot that expires after 365 days.

## Workspace

- `Prastuti_PRD_v1.2.docx`: product requirements, credit lifecycle, startup assumptions, and serverless TypeScript architecture.
- `apps/web`: working Next.js and shadcn vertical slice.

## Architecture direction

All authored application code is TypeScript. The target runtime is serverless-first:

- Next.js and Vercel Functions for stateless product compute.
- Neon Postgres and Drizzle for the credit ledger.
- Upstash Redis for ephemeral coordination and rate limiting.
- Vercel Blob for uploaded presentation assets.
- Managed speech and WebRTC or realtime providers for persistent live connections.
- Durable TypeScript workflows for post-session work, subject to beta exit criteria.

See [the serverless architecture](docs/architecture/serverless.md) for runtime boundaries and cost guardrails.

## Current implementation boundary

The prototype demonstrates product experience and deterministic credit-domain behavior. It does not process real payments, capture live audio, or call external speech providers. Those integrations are deliberately represented as the next production layer behind typed provider interfaces.
