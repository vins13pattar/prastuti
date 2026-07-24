# Implementation status

This document separates locally verifiable product behavior from production
provider work. It is intentionally evidence-oriented: an item is complete only
when its UI, API, state transition, and automated check exist.

## Locally implemented

- bounded local organizer identity using an opaque HttpOnly cookie;
- CSRF and same-origin checks for cookie-authenticated mutations;
- session creation with Kannada, English, Hindi, and Telugu selection;
- TXT and CSV context import, glossary normalization, and session notes;
- credit estimation, independent 365-day lots, earliest-expiry reservation,
  settlement, and unused-credit release;
- presenter microphone permission and level preflight;
- deterministic/manual captions plus optional browser speech recognition;
- start, pause, resume, stop, and caption correction controls;
- attendee QR/join code, anonymous scoped session, language selection,
  source-caption toggle, font sizing, and reconnect polling;
- translated caption audio using browser speech synthesis after a user gesture;
- transcript, summary, key points, TXT, and WebVTT outputs;
- security headers, per-request correlation IDs, runtime validation, and
  no-store controls for authenticated data;
- automated UI-to-API smoke coverage for the canonical local flow.

## Production implementation still required

- managed identity-provider integration and account/workspace lifecycle;
- Postgres-backed repositories for every product entity and transactionally
  safe credit reservation/settlement;
- durable presentation upload, malware scanning, PDF/PPTX extraction, and
  deletion/retention workflows;
- managed streaming speech recognition, translation, and shared per-language
  audio generation;
- managed realtime fan-out with scoped, short-lived attendee/presenter tokens;
- payment checkout, signed webhook reconciliation, refunds, chargebacks, tax
  receipts, and idempotency;
- abuse controls backed by an edge/Redis rate limiter;
- production telemetry, redaction, alerts, SLOs, and cost guardrails;
- provider-specific load, failure, accessibility, privacy, and security
  acceptance tests;
- deployment of the authenticated product application.

The public GitHub Pages site is a project website, not the authenticated
product runtime.
