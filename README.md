# Prastuti

Prastuti is a real-time multilingual presentation product for classrooms, conferences, and live events. A presenter speaks once, while attendees listen and read in a preferred language from their own phones.

Public website: [vinodspattar.in/prastuti-website](https://vinodspattar.in/prastuti-website/)

The commercial model is prepaid usage credits, without subscription plans. Every credit load forms a separate lot that expires after 365 days.

## Run the product locally

The default development mode uses deterministic mock providers and requires no database, Redis service, payment account, speech account, or media infrastructure.

```bash
cd apps/web
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Run the automated infrastructure-free product smoke test with:

```bash
pnpm local:smoke
```

For persistence and coordination integration work, start the optional PostgreSQL and Valkey containers:

```bash
cd apps/web
pnpm local:infra:up
cp local.env.example .env.local
pnpm local:db:migrate
```

See [local development](docs/LOCAL_DEVELOPMENT.md) for the supported modes and verification commands.

## Repository

- `Prastuti_PRD_v1.2.docx`: product requirements, credit lifecycle, and serverless TypeScript architecture.
- `apps/web`: working Next.js and shadcn vertical slice.
- `docs/architecture`: product architecture decisions.
- `docs/OPEN_SOURCE_READINESS.md`: public-release checklist and remaining gates.

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

The current build implements the product experience, deterministic credit-domain behavior, mock runtime, and local verification path. It does not process real payments, capture live audio, or call external speech providers. Those integrations remain behind typed provider boundaries and must pass provider-specific acceptance tests before production use.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) before opening a change.

Prastuti is available under the [MIT License](LICENSE).
