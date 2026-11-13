# JoeKnock

JoeKnock is a map-first field-interaction app for organizations. It records
property visits and provides organization-scoped reporting and CSV export.

## Project specification

[`docs/JOEKNOCK_SPEC.md`](docs/JOEKNOCK_SPEC.md) is the maintained authority for
implemented behavior, approved V2 direction, undecided proposals, architecture,
data/API rules, test safety, and current follow-up status. Read it before
changing product behavior. Old overlapping specifications and ticket documents
were consolidated; their prior versions remain in Git history.

## Local development

Use Node.js 24 and PostgreSQL. Copy `.env.example` to `.env`, then set
`DATABASE_URL` to the intended development database (`joeknock_devclean` for
the current local setup). Keep `TEST_DATABASE_URL` separate and disposable.
Do not point development or tests at the preserved original demo database.
Never commit or print credentials.

Install the root, backend, and frontend dependencies:

```sh
npm ci
npm ci --prefix ddd/backend
npm ci --prefix ddd/frontend
```

Apply development migrations only after verifying the explicit
`DATABASE_URL` target:

```sh
npm run migrate:up --prefix ddd/backend
```

To start the app:

```sh
npm run dev
```

The backend defaults to port `3000`; Vite defaults to `5173`.

## Validation

```sh
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

Integration and browser tests require a disposable test database. PR #52 adds
a test-migration target guard, but it is open and not part of `main`; see the
specification for the required precautions. These commands are not claims that
the suites were run as part of this documentation change.

## Current follow-up

- [PR #52](https://github.com/CRLockard/JoeKnock/pull/52) is open; its required
  CI checks passed when last checked.
- [Issue #51](https://github.com/CRLockard/JoeKnock/issues/51) tracks remaining
  dependency advisories/upgrades. The dependency audit is not clean.
- There is no active public deployment.
