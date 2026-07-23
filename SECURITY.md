# Security policy

## Supported versions

Prastuti is under active development. Security fixes are applied to the latest commit on `main`; no released version is currently supported.

## Report a vulnerability

Do not open a public issue for suspected vulnerabilities, exposed credentials, privacy incidents, or ways to access attendee or organizer data.

Use GitHub's private vulnerability reporting flow from the repository's **Security** tab. If that flow is unavailable, contact the repository owner through a private contact method listed on their GitHub profile.

Include:

- affected route, component, dependency, or commit;
- reproduction steps or a minimal proof of concept;
- expected and observed behavior;
- likely impact and affected users;
- any temporary mitigation already applied.

Do not include real customer data or credentials. Use synthetic test data and redact tokens from logs and screenshots.

The maintainer will acknowledge a complete report when practical, coordinate validation and remediation privately, and credit the reporter unless anonymity is requested. Public disclosure should wait until a fix or mitigation is available.

## Scope

High-priority reports include:

- authentication or authorization bypass;
- credit-ledger manipulation or payment-webhook forgery;
- cross-tenant or cross-session data exposure;
- provider credential exposure;
- stored or reflected cross-site scripting;
- server-side request forgery;
- unsafe handling of presentation assets, recordings, or transcripts;
- vulnerable dependencies with a demonstrated impact on Prastuti.

General support questions, product suggestions, and issues without security impact belong in the normal issue tracker.
