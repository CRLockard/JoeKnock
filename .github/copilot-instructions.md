# JoeKnock Copilot Instructions

Read [`docs/JOEKNOCK_SPEC.md`](../docs/JOEKNOCK_SPEC.md) before changing
product behavior, permissions, data/API contracts, architecture, migrations,
or tests. It is the single maintained specification; this file is only an
entry point.

- Respect its labels: implemented on main, approved V1 contract, approved V2
  direction, known gap, undecided proposal, and historical/retired. Do not
  implement V2 direction or proposals unless the task explicitly authorizes it.
- Work only within the requested scope. Prefer focused changes and existing
  project patterns; avoid unrelated refactors, dependencies, and formatting.
- If an applicable requirement is unclear or conflicts with another, identify
  the conflict and ask before implementing that part.
- Enforce authentication, current authorization, and organization isolation on
  the backend. Do not trust frontend filtering, resource IDs, or user-supplied
  ownership fields.
- Never expose or commit credentials, tokens, database URLs, hashes, or user
  data. Do not change databases, run migrations, deploy, or perform destructive
  cleanup unless explicitly requested.
- Use disposable databases for tests and validate the target before migration.
  The test-migration guard in PR #52 is not in `main`; do not assume it protects
  test setup until merged.
- Add or update focused regression tests for behavior changes. Do not weaken
  tests to hide defects, and report only checks actually run.
- Update the specification when an approved requirement changes. Do not
  restore superseded rules from old tickets or retired documents.
