# Local development

Prastuti supports two local development modes. The default mode is intentionally infrastructure-free so contributors can evaluate the product before creating any cloud accounts.

## Mode 1: infrastructure-free product mode

Use this mode for product development, UI work, credit-domain changes, and most pull requests.

Prerequisites:

- Node.js 24
- pnpm 11

Start the application:

```bash
cd apps/web
pnpm install
pnpm dev
```

When `PRASTUTI_RUNTIME_MODE` is unset outside production, Prastuti selects
`mock`. The runtime uses a process-local repository, opaque local organizer
sessions, deterministic translation, browser media APIs, simulated top-ups,
and no external credentials. State resets when the Next.js process restarts.

Verify the complete local surface:

```bash
pnpm local:smoke
```

The smoke test starts an isolated development server and verifies security
headers, organizer identity, credit loading, session creation, context,
reservation, attendee joining, caption delivery, correction, settlement, and
post-session artifacts before shutting the server down.

## Mode 2: Docker-backed integration mode

Use this mode when changing schemas, migrations, persistence, payment
reconciliation, or credit consistency.

Prerequisites:

- The Mode 1 prerequisites
- Docker Desktop or another Docker Compose-compatible runtime

Start PostgreSQL and Valkey:

```bash
cd apps/web
pnpm local:infra:up
cp local.env.example .env.local
pnpm local:db:migrate
pnpm dev
```

Services bind only to local development ports by default:

| Service | Host port | Purpose |
| --- | ---: | --- |
| PostgreSQL | `54329` | Schema and migration integration |
| Valkey | `63799` | Local compatibility service for future coordination tests |

Run the persistent product path and database invariants:

```bash
pnpm local:persistent:smoke
pnpm local:postgres:verify
```

The persistent smoke uses the real Postgres repository while retaining
deterministic local identity, payment, speech, and realtime providers. The
invariant verifier directly tests webhook replay, amount mismatch, exact
expiry, concurrent reservation, insufficient balance, usage meters, and
settlement.

Stop the containers while retaining PostgreSQL data:

```bash
pnpm local:infra:down
```

Delete the local PostgreSQL volume and return to a clean state:

```bash
pnpm local:infra:reset
```

The reset command deletes only Docker resources defined by this repository's Compose project. The database can be recreated by running the migration command again.

## Managed-provider acceptance mode

Production-provider testing is separate from local product verification. Set `PRASTUTI_RUNTIME_MODE=managed` and configure the variables in `.env.example` only when testing managed database, storage, speech, realtime, or payment adapters.

Managed mode fails its health check when required configuration is missing. The health and architecture endpoints return environment variable names that are missing, never their values.

## Full verification

Run every local gate with:

```bash
cd apps/web
pnpm verify
```

This runs unit tests, TypeScript checks, linting, migration validation, a
production build, and the infrastructure-free product smoke test. When Docker
is available, also run the two persistent commands above; CI runs them against
PostgreSQL 17.

## Local media testing

Open a created session and select **Check microphone** to validate browser
capture and input level. Chromium-based browsers may expose **Use browser
captions**; availability and processing behavior depend on the browser.
Deterministic and manual caption controls always work without media access.

Open the attendee link or scan its QR code in another browser tab. Select
**Enable audio** to synthesize each new translated caption with the browser's
speech synthesis engine. This explicit gesture satisfies browser autoplay
rules. No audio or transcript is sent to a Prastuti-managed external provider
in mock mode.

## Troubleshooting

- Port in use: set `PRASTUTI_POSTGRES_PORT` or `PRASTUTI_VALKEY_PORT` before starting Compose, then update `.env.local`.
- Database connection failure: run `docker compose -f ../../docker-compose.yml ps` from `apps/web` and confirm PostgreSQL is healthy.
- Managed-mode health failure: compare `/api/system/health` with `.env.example`; do not paste credential values into issues.
- Stale local data: use `pnpm local:infra:reset`, then recreate and migrate the containers.
