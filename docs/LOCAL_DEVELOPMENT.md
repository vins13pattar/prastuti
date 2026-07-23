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

When `PRASTUTI_RUNTIME_MODE` is unset outside production, Prastuti selects `mock`. The runtime uses deterministic provider boundaries, sample product data, simulated top-ups, and no external credentials.

Verify the complete local surface:

```bash
pnpm local:smoke
```

The smoke test starts an isolated development server, checks the homepage, dashboard, credits page, health endpoint, credit quote, and simulated top-up, then shuts the server down.

## Mode 2: Docker-backed integration mode

Use this mode when changing schemas, migrations, persistence, or coordination behavior.

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
| PostgreSQL | `54329` | Durable product data and credit-ledger integration |
| Valkey | `63799` | Redis-compatible coordination integration |

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

This runs unit tests, TypeScript checks, linting, migration validation, a production build, and the infrastructure-free product smoke test.

## Local media testing

The current build represents speech and realtime systems through mock provider boundaries. It does not claim locally generated translation audio. When the realtime adapter is implemented, LiveKit can run locally in development mode; provider-specific setup will be added with that adapter rather than introducing an unused always-on service now.

## Troubleshooting

- Port in use: set `PRASTUTI_POSTGRES_PORT` or `PRASTUTI_VALKEY_PORT` before starting Compose, then update `.env.local`.
- Database connection failure: run `docker compose -f ../../docker-compose.yml ps` from `apps/web` and confirm PostgreSQL is healthy.
- Managed-mode health failure: compare `/api/system/health` with `.env.example`; do not paste credential values into issues.
- Stale local data: use `pnpm local:infra:reset`, then recreate and migrate the containers.
