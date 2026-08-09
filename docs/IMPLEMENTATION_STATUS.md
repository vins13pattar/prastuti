# Implementation status

This document separates locally verifiable product behavior from production
provider work. It is intentionally evidence-oriented: an item is complete only
when its UI, API, state transition, and automated check exist.

## Implemented and locally verified

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
- managed Clerk identity with organization membership synchronization;
- Postgres repositories and atomic functions for payment reconciliation,
  earliest-expiry reservation, concurrent wallet protection, usage meters,
  settlement, and unused-credit release;
- private presentation uploads with size, extension, MIME, magic-byte, malware,
  PDF/PPTX/TXT/CSV extraction, and 30-day retention controls;
- Azure speech recognition token brokerage, translation, and shared
  per-language synthesized audio;
- Ably presenter/attendee tokens scoped to one session plus server-side publish;
- Razorpay order creation, client signature verification, raw-body webhook
  verification, event idempotency, and amount/currency matching;
- Upstash-backed managed rate limiting that fails closed;
- durable finalization workflow with persisted artifacts, retry API, and
  retention step;
- durable organizer, attendee, payment, session, and workflow audit records;
- OpenTelemetry initialization plus request-correlated, redacted operational
  events for audit writes, rate-limit denial, payment webhooks, and realtime
  provider failures;
- Docker-backed persistent smoke and invariant tests covering exact 365-day
  expiry, webhook replay, payment mismatch, concurrent reservation,
  insufficient balance, usage metering, and settlement.

## External production gates

- supply real provider credentials and complete end-to-end acceptance against
  Clerk, Neon, Upstash, Blob, Cloudmersive, Azure, Ably, Razorpay, and Workflow;
- approve `CREDIT_PRICE_PAISE`, GST/tax receipts, credit-expiry disclosures,
  refund policy, and chargeback operations before accepting money;
- automate or formally staff refund/dispute handling; those webhook events are
  currently persisted for manual review rather than mutating credit balances;
- connect the implemented traces and structured logs to the selected production
  backend, then configure dashboards, alerts, SLOs, retention, and cost
  guardrails;
- run provider-specific load, latency, failure, browser/device, accessibility,
  data-residency, privacy, and security acceptance tests;
- deployment of the authenticated product application.

The public GitHub Pages site is a project website, not the authenticated
product runtime.
