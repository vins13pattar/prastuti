# Open-source readiness

This checklist separates repository preparation from the irreversible public-release decision.

## Completed

- [x] Product-oriented README and local setup
- [x] Infrastructure-free local runtime and automated smoke test
- [x] Optional Docker-backed PostgreSQL and Valkey development profile
- [x] Contribution guide
- [x] Code of conduct
- [x] Security reporting policy
- [x] Maintainer-led governance model
- [x] Pull request template
- [x] Structured bug and feature issue templates
- [x] Reproducible pnpm install in CI
- [x] Dependency update configuration
- [x] Environment examples contain names and local-only placeholders, not deployed credentials
- [x] Redacted secret scan across all reachable Git history found no leaks
- [x] Intended publishable working tree secret scan found no leaks
- [x] Tracked PRD metadata was scrubbed and the rendered document was visually reviewed
- [x] MIT source license selected and added
- [x] Copyright holder text confirmed as `Prastuti contributors`
- [x] Managed integrations fail closed when required configuration is absent
- [x] Docker-backed persistent smoke and financial-invariant verification

## Live repository settings

- [x] GitHub private vulnerability reporting enabled
- [x] Repository description, topics, social preview, homepage, and public
  security contact path confirmed
- [x] `main` requires strict `web` and `secrets` checks, resolves review
  conversations, enforces protection for administrators, and rejects force
  pushes and deletion
- [x] GitHub repository published on 25 July 2026

## License decision

Prastuti is licensed under the MIT License with the copyright holder text
`Copyright (c) 2026 Prastuti contributors`.

## Release evidence

Before public release, record:

- the exact commit reviewed;
- test, typecheck, lint, migration, build, and local smoke results;
- dependency-audit results and any accepted exceptions;
- secret-scan version, scope, and redacted finding disposition;
- document metadata and binary review results;
- the MIT license and `Prastuti contributors` copyright holder text.

Current repository and document evidence was collected on 24 July 2026.
Production-path verification was refreshed on 25 July 2026. Gitleaks v8.30.1 scanned the
complete reachable history and the intended publishable working tree without
findings. The PRD passed accessibility, heading, section, metadata, and
17-page visual checks. Unit tests, typecheck, lint, migration validation,
production build, mock smoke, Postgres-backed smoke, and database invariants
are release gates.

The production dependency audit reports one ignored high-severity advisory in
Workflow's legacy build-only CLI dependency chain. Runtime-facing
`brace-expansion` is overridden to the patched release; Prastuti does not pass
request-controlled glob patterns to the affected tooling. Re-evaluate and
remove the exception when the upstream chain updates.

Implementation commit `601f3d6` passed both hosted checks in
[CI run 30142431772](https://github.com/vins13pattar/prastuti/actions/runs/30142431772):
the complete-history secret scan and the web job covering install, unit tests,
typecheck, lint, dependency audit, production build, migrations, Postgres
invariants, and both product smoke modes.
