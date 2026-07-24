# Contributing to Prastuti

Thank you for improving Prastuti. Contributions should preserve the product's accessibility, language inclusion, credit-accounting integrity, privacy boundaries, and scale-to-zero architecture.

## Before contributing

1. Read the [code of conduct](CODE_OF_CONDUCT.md) and [security policy](SECURITY.md).
2. Search existing issues and pull requests before starting duplicate work.
3. Use an issue for substantial behavior, schema, provider, pricing, or architecture changes.
4. Never commit credentials, production identifiers, attendee data, or customer recordings.

## Development setup

The fastest path requires no external infrastructure:

```bash
cd apps/web
pnpm install
pnpm dev
```

See [local development](docs/LOCAL_DEVELOPMENT.md) for the mock runtime, Docker-backed PostgreSQL and Valkey, and managed-provider acceptance mode.

## Change expectations

- Keep authored product code in TypeScript.
- Use shadcn/ui primitives and maintain keyboard, contrast, and responsive behavior.
- Validate request data at runtime.
- Keep secrets and privileged provider operations on the server.
- Preserve immutable credit-ledger semantics and 365-day lot expiry.
- Do not add an always-on Prastuti application server or worker without an accepted architecture decision.
- Add or update tests for behavior changes.
- Update product and architecture documentation when contracts change.

## Verification

Run:

```bash
cd apps/web
pnpm verify
```

If Docker-backed behavior changes, also start the local services and apply migrations:

```bash
pnpm local:infra:up
cp local.env.example .env.local
pnpm local:db:migrate
```

## Pull requests

Keep pull requests focused and explain:

- what changed;
- why the product needs it;
- user, operator, and migration impact;
- tests and manual verification performed;
- any remaining provider or production gates.

By contributing to Prastuti, you agree that your contributions will be licensed under the [MIT License](LICENSE).
