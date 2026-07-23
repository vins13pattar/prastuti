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

## Required before making the repository public

- [ ] Select and add a source license
- [ ] Confirm the copyright holder text
- [ ] Enable GitHub private vulnerability reporting
- [ ] Confirm repository description, topics, social preview, and public contact path
- [ ] Confirm branch protection and required CI checks on `main`
- [ ] Make the GitHub repository public only after all blockers above are resolved

## License decision

No `LICENSE` file is present. Until the maintainer selects a license, source availability does not grant open-source reuse rights.

Two common choices for this product are:

- Apache License 2.0: permissive reuse with an explicit patent grant.
- GNU Affero General Public License v3.0: reciprocal source-sharing obligations, including modified network services.

This document records options but does not choose on behalf of the copyright holder.

## Release evidence

Before public release, record:

- the exact commit reviewed;
- test, typecheck, lint, migration, build, and local smoke results;
- dependency-audit results and any accepted exceptions;
- secret-scan version, scope, and redacted finding disposition;
- document metadata and binary review results;
- the selected license and copyright holder.

Current evidence was collected on 24 July 2026. Gitleaks v8.30.1 scanned the
complete reachable history and the intended publishable working tree without
findings. The PRD passed accessibility, heading, section, metadata, and
17-page visual checks. The exact release commit and hosted CI result are
recorded after the prepared changes are pushed.
