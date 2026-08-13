# JoeKnock Project Foundation Specification

**Status:** Planned
**Purpose:** Define the implementation foundation required before US-001, US-002, US-003, and all subsequent application tickets.
**Scope:** Planning and documentation only. No application code, dependency installation, or environment provisioning is performed by this document.

---

# 1. Foundation Objectives

## 1.1 What the Foundation Must Provide

The project foundation must establish:

1. A concrete and minimal full-stack technology baseline for JoeKnock MVP.
2. A production-respectful repository structure under `ddd` with explicit file paths and responsibilities.
3. A repeatable backend/frontend development workflow.
4. Shared conventions for API behavior, validation, authentication context, authorization, and organization isolation.
5. A practical automated test architecture using Vitest, Supertest, and Playwright.
6. Database migration and test-database patterns required for safe iterative development.
7. Basic application security appropriate for an MVP.
8. Clear implementation guardrails for GitHub Copilot and human contributors.

## 1.2 What the Foundation Explicitly Does Not Implement

This foundation specification does not implement:

1. Any MVP business feature endpoint or UI behavior from user-story tickets.
2. Any schema redesign beyond `docs/table_Schema_decisions.md`.
3. Any contract redesign beyond `docs/api_endpoints.md`.
4. Any post-MVP infrastructure such as token blacklisting, refresh-token rotation, distributed sessions, Redis, queues, or external observability platforms.
5. CSRF protection for the MVP JWT bearer-token architecture.
6. Any package installation or application code scaffolding in the repository.

---

# 2. Technology Stack Decisions

This section defines the finalized MVP implementation baseline.

## 2.1 Summary

1. Frontend framework: **React**
2. Frontend language: **JavaScript**
3. Frontend build tool: **Vite**
4. Backend runtime: **Node.js LTS**
5. Backend language: **JavaScript**
6. Backend framework: **Express**
7. Database: **PostgreSQL**
8. Database access: **`pg` / node-postgres**
9. Database migrations: **node-pg-migrate**
10. Authentication: **JWT bearer authentication**
11. MVP client token storage: **localStorage**
12. API architecture: **REST JSON under `/api`**
13. API validation: **express-validator**
14. Frontend HTTP client: **native `fetch`**
15. Frontend authentication state: **React Context**
16. Unit/component testing: **Vitest**
17. API/integration testing: **Supertest**
18. End-to-end testing: **Playwright**
19. Linting: **ESLint**
20. Formatting: **Prettier**
21. Environment/configuration: **dotenv + typed configuration module**
22. Password hashing: **Argon2id**
23. Security middleware: **Helmet, CORS configuration, express-rate-limit**
24. Logging: **lightweight application logger**
25. Request tracing: **request IDs**
26. Maps: **Leaflet**
27. Geocoding: **OpenStreetMap/Nominatim through the JoeKnock backend**

## 2.1.1 Finalized Foundation Rationale

### JavaScript

JavaScript is used for both frontend and backend.

Reasons:

1. It matches the user's existing course/project experience.
2. It reduces language-switching overhead for a solo capstone.
3. It keeps the implementation approachable and easy to defend during project review.
4. The project does not require TypeScript-specific complexity to achieve the MVP's goals.

TypeScript is explicitly **not** part of the MVP foundation.

### PostgreSQL + `pg`

PostgreSQL remains the authoritative database.

Database access uses `pg` rather than an ORM.

Reasons:

1. JoeKnock has a strongly relational data model.
2. Explicit SQL keeps database behavior visible and understandable.
3. The user already has SQL experience.
4. Parameterized SQL provides strong protection against SQL injection.
5. It avoids unnecessary ORM abstraction and lock-in.
6. It makes the database layer straightforward to explain and test.

### node-pg-migrate

Database schema changes are managed through source-controlled migrations using `node-pg-migrate`.

### JWT + localStorage

JWT bearer authentication is retained for MVP.

Tokens are stored in `localStorage` for MVP session persistence.

Security guardrails include:

1. Minimal JWT payload.
2. Short, intentional token lifetime.
3. No sensitive information in the token.
4. Immediate client-side token removal on logout.
5. Strict backend authentication and authorization.
6. Input validation.
7. Security headers.
8. Rate limiting.
9. Safe error handling.
10. No dangerous HTML injection patterns.

CSRF protection is deferred because the MVP sends JWTs explicitly through the `Authorization` header rather than relying on authentication cookies.

If authentication changes to cookie-based credentials in the future, CSRF protection must be reconsidered.

### Validation

`express-validator` is the finalized API validation library.

Frontend validation remains UX-focused and is never considered a security boundary.

### Testing

The finalized testing stack is:

- Vitest
- Supertest
- Playwright

Each tool has a distinct responsibility rather than trying to use one tool for everything.

---

# 2.2 Recommendation Details

## Frontend Framework: React

**Status:** Established

React provides the component-based frontend architecture for JoeKnock.

Why it fits:

- Already established through the project and coursework.
- Strong ecosystem for map interfaces.
- Familiar development model.
- Appropriate for the capstone's scope.

Alternatives considered:

- Vue
- Svelte

Decision:

- React remains the frontend framework.

---

## Frontend Language: JavaScript

**Status:** Finalized

JoeKnock uses JavaScript rather than TypeScript.

File extensions include:

```text
.js
.jsx
```

Reasons:

1. Matches existing coursework and project experience.
2. Reduces setup and configuration overhead.
3. Keeps the stack consistent with the user's current skill set.
4. Makes the implementation easier to explain and defend.

TypeScript is deferred rather than prohibited from future versions.

---

## Frontend Build Tool: Vite

**Status:** Finalized

Vite provides the frontend development server and production build tooling.

Why it fits:

- Fast startup.
- Fast rebuilds.
- Minimal configuration.
- Good React integration.
- Straightforward testing integration.

Alternatives considered:

- Create React App
- Next.js
- Parcel

Decision:

- Vite.

---

## Backend Runtime: Node.js LTS

**Status:** Finalized

Node.js LTS provides the backend runtime.

Why it fits:

- Consistent language across the application.
- Strong Express ecosystem.
- Familiar JavaScript environment.
- Appropriate for the scale of the MVP.

---

## Backend Framework: Express

**Status:** Established

Express provides the REST API and middleware pipeline.

Why it fits:

- Explicit routing and middleware.
- Easy to understand.
- Strong ecosystem.
- Appropriate abstraction level for the capstone.

Alternatives considered:

- Fastify
- NestJS

Decision:

- Express.

---

## Database: PostgreSQL

**Status:** Established

PostgreSQL is the authoritative JoeKnock database.

Why it fits:

- Strong relational model.
- ACID transactions.
- Foreign-key support.
- Constraints and indexes.
- Appropriate for historical interaction records.
- Good support for organization isolation.

---

## Database Access: `pg`

**Status:** Finalized

JoeKnock uses the `pg` Node.js PostgreSQL client.

The architecture is:

```text
Service
  ↓
Repository
  ↓
pg
  ↓
PostgreSQL
```

Queries use parameterized values:

```js
pool.query(
  `
    SELECT *
    FROM properties
    WHERE id = $1
  `,
  [propertyId],
);
```

String interpolation of user-controlled values into SQL is prohibited.

There is no ORM in the MVP.

---

## Database Migrations: node-pg-migrate

**Status:** Finalized

Database schema changes are represented by source-controlled migration files.

Migration history is part of the repository and is used to reproduce database structure in development and test environments.

---

## Authentication: JWT Bearer Authentication

**Status:** Established

JoeKnock uses signed JWT bearer tokens.

Protected requests use:

```text
Authorization: Bearer <token>
```

JWT verification occurs in backend authentication middleware.

---

## Password Hashing: Argon2id

**Status:** Finalized

Passwords are hashed using Argon2id.

Passwords are never stored in plaintext.

Password hashes are never returned through API responses.

---

## API Architecture: REST JSON under `/api`

**Status:** Established

JoeKnock exposes a REST-style JSON API under:

```text
/api/...
```

The endpoint contract is authoritative in:

```text
docs/api_endpoints.md
```

The Foundation Specification must not create a competing endpoint contract.

Alternatives considered:

- GraphQL
- gRPC

Decision:

- REST JSON.

---

## API Validation: express-validator

**Status:** Finalized

`express-validator` validates incoming request data at the API boundary.

Validation applies to:

- request bodies
- route parameters
- query parameters

Business rules remain in the service layer.

Database constraints remain the final integrity boundary.

---

## Frontend HTTP Client: Native `fetch`

**Status:** Finalized

The frontend uses the browser's native `fetch` API.

JoeKnock may provide a lightweight API client wrapper around `fetch` for shared concerns such as:

- API base URL
- authorization headers
- JSON parsing
- common error handling

No Axios dependency is required.

---

## Frontend Authentication State: React Context

**Status:** Finalized

Authentication state is managed with React Context.

The authentication provider is responsible for:

- current authenticated user
- token lifecycle
- login state
- logout state
- persistence/recovery from localStorage

Redux or another global-state framework is not required for MVP.

---

## Testing Framework: Vitest

**Status:** Finalized

Vitest is used for unit and component tests.

Appropriate targets include:

- utility functions
- validation helpers
- business-rule logic
- permission calculations
- React components
- React hooks
- authentication state behavior

---

## API/Integration Testing: Supertest

**Status:** Finalized

Supertest is used to exercise the Express API through HTTP-style requests.

It should cover:

- status codes
- request validation
- authentication
- authorization
- organization isolation
- response contracts
- important database-backed API behavior

Supertest is particularly valuable because it tests the actual Express middleware and route pipeline rather than only isolated functions.

---

## End-to-End Testing: Playwright

**Status:** Finalized

Playwright provides browser-level end-to-end testing.

MVP E2E coverage should focus on critical workflows rather than attempting to test every UI detail.

Examples include:

- registration
- login
- logout
- authenticated map access
- property resolution
- recording an interaction
- viewing current interaction state

---

## Linting: ESLint

**Status:** Finalized

ESLint provides static code-quality checks.

---

## Formatting: Prettier

**Status:** Finalized

Prettier provides consistent formatting.

ESLint and Prettier have separate responsibilities:

```text
ESLint   → code quality
Prettier → formatting
```

---

## Environment/Configuration: dotenv + Config Module

**Status:** Finalized

Environment variables are loaded through `dotenv` and accessed through a typed configuration module.

Environment values are validated when the application starts.

Secrets are never committed to source control.

---

# 3. Repository Structure

Current state: `ddd` is empty.

This section defines the intended structure.

## 3.1 Top-Level

```text
ddd/
frontend/
backend/
docs/
.github/
```

The actual application code lives under `ddd`.

---

## 3.2 Proposed Structure

```text
ddd/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── app/
│       │   ├── App.jsx
│       │   └── router.jsx
│       ├── auth/
│       │   ├── AuthProvider.jsx
│       │   ├── authStorage.js
│       │   ├── useAuth.js
│       │   └── ProtectedRoute.jsx
│       ├── api/
│       │   ├── client.js
│       │   └── authApi.js
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── MapPage.jsx
│       │   └── ProfilePage.jsx
│       ├── components/
│       ├── features/
│       └── styles/
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── server.js
│   │   ├── app.js
│   │   ├── config/
│   │   │   └── env.js
│   │   ├── common/
│   │   │   ├── errors.js
│   │   │   ├── response.js
│   │   │   └── logger.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   ├── roleMiddleware.js
│   │   │   ├── errorMiddleware.js
│   │   │   ├── requestIdMiddleware.js
│   │   │   └── rateLimitMiddleware.js
│   │   ├── auth/
│   │   │   ├── authRoutes.js
│   │   │   ├── authController.js
│   │   │   ├── authService.js
│   │   │   ├── jwt.js
│   │   │   ├── password.js
│   │   │   └── authTypes.js
│   │   ├── organization/
│   │   ├── users/
│   │   ├── teams/
│   │   ├── statuses/
│   │   ├── properties/
│   │   ├── interactions/
│   │   ├── map/
│   │   ├── reports/
│   │   ├── geocoding/
│   │   ├── validation/
│   │   │   └── schemas/
│   │   └── db/
│   │       ├── client.js
│   │       └── transaction.js
│   ├── migrations/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── helpers/
│
├── package.json
├── .editorconfig
├── .gitignore
└── .env.example
```

## 3.3 Directory Responsibilities

### `frontend/src/auth`

Client-side authentication state and route protection.

### `frontend/src/api`

HTTP client and endpoint-specific API modules using native `fetch`.

### `backend/src/middleware`

Cross-cutting HTTP concerns including:

- authentication
- authorization
- request IDs
- rate limiting
- centralized error handling

### `backend/src/auth`

Authentication-specific implementation including:

- password hashing
- JWT creation/verification
- authentication routes
- authentication services

### `backend/src/validation`

API boundary validation using `express-validator`.

### `backend/src/db`

Database client ownership and transaction helpers.

### `backend/migrations`

Source-controlled PostgreSQL migrations managed by `node-pg-migrate`.

### `backend/tests`

Backend unit and integration tests.

### Domain directories

Domain-specific code should follow:

```text
routes
  ↓
controllers
  ↓
services
  ↓
repositories
```

where the repository layer owns database access.

Design constraint:

- Do not introduce unnecessary architectural layers.
- Keep controllers thin.
- Keep business logic in services.
- Keep SQL/database access in repositories.

---

# 4. Package and Dependency Strategy

## 4.1 Package Manifests

Use:

1. One lightweight root `package.json` for orchestration.
2. One package manifest under `ddd/frontend`.
3. One package manifest under `ddd/backend`.

Reasons:

1. Clear runtime boundaries.
2. Separate frontend/backend dependencies.
3. Straightforward development commands.
4. Easier dependency management.

---

## 4.2 Dependency Boundaries

### Frontend production dependencies

Examples:

- React
- React Router
- Leaflet/map libraries

The frontend uses native `fetch` rather than Axios.

### Backend production dependencies

Examples:

- Express
- `pg`
- `node-pg-migrate`
- JWT library
- Argon2 library
- express-validator
- Helmet
- CORS middleware
- express-rate-limit
- dotenv

### Development dependencies

Examples:

- Vitest
- Supertest
- Playwright
- ESLint
- Prettier

Dependencies should only be added when they provide clear value.

---

## 4.3 Script Organization

Root scripts delegate to frontend/backend scripts where appropriate.

Expected commands include:

```text
npm run dev
npm run build
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:watch
npm run test:coverage
npm run lint
npm run format
```

Exact implementation may evolve as the workspace is built.

---

# 5. Database Foundation

Database design is authoritative in:

```text
docs/table_Schema_decisions.md
```

This Foundation Specification does not redefine the schema.

## 5.1 Connection Strategy

1. One application-level `pg.Pool`.
2. Database configuration comes from environment variables.
3. Normal queries use the shared pool.
4. Transactions check out a dedicated client from the pool.
5. Transaction clients are always released.

---

## 5.2 Migration Strategy

1. Migrations are source-controlled under `backend/migrations`.
2. Migrations are managed with `node-pg-migrate`.
3. Shared database schemas are changed through migrations rather than manual edits.
4. Migration files are committed with the application changes that require them.

---

## 5.3 Development Database Setup

1. Local PostgreSQL database for development.
2. Development database URL is separate from test and production environments.
3. Migrations must be applied before the application depends on newly introduced schema.

---

## 5.4 Test Database Strategy

1. Dedicated test database.
2. Test database is never the development or production database.
3. Test schema is created through migrations.
4. Test data is created through deterministic test factories/helpers.
5. Tests must not depend on persistent shared seed data.

---

## 5.5 Transaction Handling

Multi-write operations that must succeed or fail together use PostgreSQL transactions.

Example:

```text
BEGIN
  ↓
operation 1
  ↓
operation 2
  ↓
COMMIT
```

On failure:

```text
ROLLBACK
```

Transaction clients must always be released.

---

## 5.6 Seed Data Strategy

1. Minimal seed data may be provided for local manual development.
2. Automated tests must not depend on shared seed assumptions.
3. Tests should create the data they require.

---

## 5.7 Schema Change Process

1. Modify the approved schema design.
2. Create a migration.
3. Run migration against development database.
4. Update affected application code.
5. Add/adjust tests.
6. Commit migration, code, and tests together.

---

## 5.8 Immutable Interaction Snapshots

Interactions are immutable historical snapshots.

When an interaction changes:

```text
Existing snapshot
       ↓
never modified

New snapshot
       ↓
created
```

Historical interaction records remain intact.

A separate interaction activity-log table is **not required for MVP** because immutable interaction snapshots already provide the historical interaction record.

---

# 6. Authentication Foundation

Authentication must support US-001, US-002, and US-003 according to the authoritative API contracts.

## 6.1 Password Hashing

Use **Argon2id**.

Requirements:

1. Passwords are never stored in plaintext.
2. Password hashes are never returned to clients.
3. Hash configuration is centralized.
4. Password verification uses the Argon2id library rather than custom cryptographic code.

---

## 6.2 JWT Creation and Validation

1. JWT is issued after successful registration/login.
2. JWT verification middleware protects authenticated routes.
3. JWT contains only the minimum required identity/authorization claims.
4. JWT does not contain passwords, password hashes, or other sensitive data.
5. JWT expiration is configured through environment configuration.

---

## 6.3 Authentication Middleware

Authentication middleware must:

1. Read the `Authorization` header.
2. Require the `Bearer` scheme.
3. Verify JWT signature.
4. Verify expiration and required claims.
5. Attach authenticated user context to the request.
6. Return a structured `401` response for missing/invalid authentication.

---

## 6.4 Authenticated Request Context

Authenticated request context includes:

1. `userId`
2. `organizationId`
3. `role`

Additional information may be loaded by services when required.

---

## 6.5 Organization and Role Context

1. Organization identity is server-owned.
2. The authenticated context determines organization ownership.
3. Clients cannot override authoritative organization ownership by submitting a different organization ID.

---

## 6.6 Client-Side Auth State

1. React Context manages authentication state.
2. JWT is stored in `localStorage` for MVP.
3. Protected routes require authenticated state.
4. Logout clears both persisted and in-memory authentication state.
5. The frontend never treats user-supplied organization information as authoritative.

---

## 6.7 Logout Behavior

1. Logout endpoint follows the established API contract.
2. MVP does not maintain a server-side token blacklist.
3. MVP does not implement refresh-token rotation.
4. Client token removal is the effective logout mechanism for the stateless JWT model.

---

# 7. Organization Isolation Foundation

Organization isolation is a critical security boundary.

## 7.1 Identity Source

`organizationId` comes from authenticated server-side context.

It is never trusted from:

- request body
- query parameters
- client-supplied ownership fields

as the authoritative organization identity.

---

## 7.2 Backend Query Scope Pattern

Organization-owned queries must include organization scope.

For example:

```sql
SELECT *
FROM properties
WHERE id = $1
  AND organization_id = $2;
```

A lookup by resource ID alone is insufficient when the resource is organization-owned.

---

## 7.3 Authorization Interaction

Authorization follows this order conceptually:

```text
Authenticate
    ↓
Determine organization
    ↓
Apply organization isolation
    ↓
Apply role/visibility rules
    ↓
Perform operation
```

---

## 7.4 Cross-Organization Prevention

The backend must prevent:

1. Access through guessed resource IDs.
2. Cross-organization resource retrieval.
3. Cross-organization modification.
4. Cross-organization associations.

---

## 7.5 Testing

Integration tests should repeatedly verify:

1. Organization A exists.
2. Organization B exists.
3. User from A authenticates.
4. User from A attempts to access B-owned resources.
5. The API denies access according to the endpoint's established policy.

---

# 8. Authorization Foundation

Authorization follows finalized MVP role and visibility rules.

## 8.1 Roles

MVP roles:

1. `rep`
2. `manager`
3. `admin`

---

## 8.2 Policy Structure

Use:

1. Middleware for broad route-level authorization where appropriate.
2. Service-level authorization for resource-specific rules.

---

## 8.3 Interaction Editing

Interaction history is immutable.

Therefore:

1. Existing interaction snapshots are never edited in place.
2. A meaningful change creates a new interaction snapshot.
3. Representatives may modify their own interactions.
4. Managers/admins may modify interactions they are authorized to see.
5. Viewing and editing are separate authorization decisions.

---

## 8.4 Visibility Integration

The finalized visibility model includes:

1. Only my interactions.
2. My team's interactions.
3. Organization-wide interactions.

Visibility controls what a user can read.

Edit authorization rules are:

1. Representatives edit only their own interactions.
2. Managers edit authorized team-member interactions within organization scope.
3. Administrators edit any interaction within organization scope.
4. Manager/admin edits do not transfer interaction ownership.

---

# 9. API Foundation

Endpoint contracts remain authoritative in:

```text
docs/api_endpoints.md
```

This document must not create a competing endpoint inventory.

## 9.1 Routing Structure

The backend may organize routes by domain, including:

1. `/auth`
2. `/me`
3. `/organization`
4. `/users`
5. `/teams`
6. `/statuses`
7. `/properties`
8. `/interactions`
9. `/map`
10. `/reports`
11. `/geocoding` where explicitly defined by the authoritative API contract

The exact endpoint paths and methods remain controlled by `docs/api_endpoints.md`.

---

## 9.2 Request/Response Conventions

1. JSON request/response format.
2. Endpoint-specific success payloads.
3. Consistent error envelope.

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data."
  }
}
```

---

## 9.3 HTTP Status Conventions

1. `200` — successful read/update/operation.
2. `201` — resource successfully created.
3. `204` — successful operation with no response body.
4. `400` — invalid request.
5. `401` — missing/invalid authentication.
6. `403` — authenticated but not authorized.
7. `404` — resource not found or intentionally hidden according to endpoint policy.
8. `409` — resource/state conflict.
9. `429` — rate limit exceeded.
10. `500` — unexpected server error.

---

## 9.4 Error Handling Boundaries

1. `express-validator` handles request validation.
2. Authentication middleware handles authentication failures.
3. Authorization logic handles permission failures.
4. Repository/database errors are translated into safe application errors.
5. Known conflicts return `409` where appropriate.
6. Unexpected exceptions are handled by centralized error middleware.
7. Internal error details are logged server-side but not returned to clients.

---

## 9.5 Logging Boundaries

Logs may include:

- request ID
- HTTP method
- route/path
- response status
- duration
- safe application context
- server-side error information

Logs must not include:

- passwords
- password hashes
- JWTs
- authorization headers
- database credentials
- secrets
- unnecessary sensitive personal information

---

# 10. Validation Foundation

Validation is intentionally layered.

## 10.1 Frontend

Frontend validation exists for:

1. Immediate user feedback.
2. Better form UX.
3. Preventing obviously invalid submissions.

Frontend validation is never treated as a security boundary.

---

## 10.2 API Boundary

The backend performs authoritative input validation using `express-validator`.

Validation applies to:

- body fields
- route parameters
- query parameters

Invalid requests are rejected before business logic executes.

---

## 10.3 Business Layer

Services enforce rules requiring application state or context, including:

- ownership
- organization scope
- authorization
- state transitions
- domain-specific requirements

---

## 10.4 Database Layer

PostgreSQL provides final data-integrity enforcement through:

- primary keys
- foreign keys
- unique constraints
- not-null constraints
- check constraints where appropriate
- transactions

---

# 11. Testing Architecture

The testing strategy uses three primary layers.

## 11.1 Unit and Component Tests — Vitest

Appropriate targets:

1. Pure business-rule utilities.
2. Validation helpers.
3. Permission calculations.
4. Visibility calculations.
5. Authentication utilities.
6. React components.
7. React hooks.
8. Client-side state behavior.

Unit tests should focus on meaningful behavior rather than arbitrary coverage targets.

---

## 11.2 API/Integration Tests — Supertest

Integration/API tests should cover:

1. Route behavior.
2. Middleware behavior.
3. Status codes.
4. Authentication.
5. Authorization.
6. Organization isolation.
7. Database-backed behavior.
8. Transaction behavior.
9. API error contracts.
10. Immutable interaction behavior.

---

## 11.3 End-to-End Tests — Playwright

Playwright covers critical browser workflows.

MVP focus includes:

1. Registration.
2. Login.
3. Logout.
4. Authenticated map access.
5. Property resolution.
6. Recording an interaction.
7. Viewing current interaction state.
8. Critical authorization/visibility workflows.

E2E tests should remain intentionally limited to important user journeys.

---

# 12. Test Database Strategy

## 12.1 Goals

1. Deterministic tests.
2. No test-order dependency.
3. Isolation from development and production databases.
4. Repeatable local execution.
5. Support for future parallel execution.

---

## 12.2 Recommended Approach

Use a hybrid cleanup strategy:

1. Dedicated test database.
2. Migrations applied before testing.
3. Factory-based test data.
4. Transaction rollback where practical.
5. Deterministic table cleanup when transaction boundaries are unsuitable.

The exact cleanup implementation should be selected during test-harness implementation rather than introducing unnecessary infrastructure now.

---

## 12.3 Isolation Testing Patterns

Isolation tests should:

1. Create at least two organizations.
2. Create users/resources belonging to each.
3. Authenticate as one organization.
4. Attempt to access the other organization's resources.
5. Verify the expected denial behavior.

---

## 12.4 Immutable Snapshot Testing

Tests should verify that:

1. An original interaction snapshot remains unchanged.
2. A subsequent change creates a new snapshot.
3. Historical data remains available.
4. Current-state markers transition correctly according to the authoritative schema design.

---

# 13. Test Scripts

Intended scripts:

```text
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:watch
npm run test:coverage
npm run lint
npm run format
npm run build
npm run dev
```

`npm test` is the primary automated test command.

Root-level scripts should orchestrate frontend/backend test commands where necessary.

---

# 14. Code Quality Standards

Practical standards:

1. ESLint runs locally and in CI where configured.
2. Prettier provides consistent formatting.
3. Use clear domain-specific naming.
4. Avoid unnecessary abstraction.
5. Controllers remain thin.
6. Business rules belong in services.
7. Database access belongs in repositories.
8. Async errors must reach centralized error handling.
9. Environment variables are validated on startup.
10. Secrets are never committed.
11. Logs use request IDs.
12. New dependencies require explicit justification.
13. Comments should explain why rather than restate what code does.
14. Unrelated refactoring should not be included in feature tickets.

---

# 15. Environment Configuration

## 15.1 Environments

1. Development.
2. Test.
3. Production.

---

## 15.2 Required Environment Variables

Backend:

```text
NODE_ENV
PORT
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN
CORS_ORIGIN
LOG_LEVEL
```

Frontend:

```text
VITE_API_BASE_URL
```

Geocoding configuration may be added if required by the finalized provider integration.

---

## 15.3 Secret Classification

Secrets include:

1. `JWT_SECRET`
2. Database credentials contained in `DATABASE_URL`
3. Future private provider credentials

Non-secret configuration includes:

1. `PORT`
2. `LOG_LEVEL`
3. `CORS_ORIGIN`
4. Public frontend API base URL

---

## 15.4 Environment File Handling

1. Commit `.env.example` containing placeholders only.
2. Never commit real `.env` files.
3. Maintain separate development and test configuration.
4. Production secrets are provided by the deployment environment.

---

# 16. Security Baseline

JoeKnock uses a lightweight but meaningful MVP security baseline.

## 16.1 Required Security Controls

1. Argon2id password hashing.
2. JWT authentication.
3. Backend authorization.
4. Organization isolation.
5. API input validation.
6. Parameterized SQL.
7. Helmet security headers.
8. Explicit CORS configuration.
9. Rate limiting.
10. Request IDs.
11. Centralized error handling.
12. Safe logging.
13. Secrets stored outside source control.
14. Dependency auditing and updates.

---

## 16.2 Rate Limiting

Use `express-rate-limit`.

Initial focus should be public/authentication-sensitive endpoints such as:

- registration
- login

Rate limiting should remain simple for MVP.

Distributed rate limiting infrastructure is deferred.

---

## 16.3 CORS

CORS must be restricted to the intended frontend origin(s).

Wildcard production CORS configuration is not permitted.

---

## 16.4 Helmet

Helmet provides standard security-related HTTP headers.

No custom security-header framework is required for MVP.

---

## 16.5 CSRF

CSRF protection is **deferred for MVP**.

Reason:

The MVP authentication architecture uses JWT bearer tokens explicitly supplied through:

```text
Authorization: Bearer <token>
```

rather than authentication cookies.

If authentication later moves to cookies, CSRF protection must be reevaluated before that architecture is implemented.

---

## 16.6 Deferred Security Infrastructure

The following are intentionally outside MVP:

1. Token blacklisting.
2. Refresh-token rotation.
3. Distributed sessions.
4. Redis-backed rate limiting.
5. Advanced WAF infrastructure.
6. Distributed tracing.
7. External security/observability platforms.

These can be added when actual product requirements justify them.

---

# 17. Error and Logging Strategy

## 17.1 Centralized Error Handling

All unexpected route/service errors flow through centralized Express error middleware.

Controllers should not contain repetitive error-handling wrappers.

---

## 17.2 Application Errors

Application-level errors should represent known conditions such as:

- validation failure
- authentication failure
- authorization failure
- resource not found
- conflict

The centralized error middleware maps these to the appropriate HTTP response.

---

## 17.3 Development Logging

Development logs should provide enough information to debug:

- request flow
- validation failures
- database failures
- unexpected application errors

Stack traces may be available in development.

---

## 17.4 Production-Safe Logging

Production logs should:

1. Include request IDs.
2. Avoid secrets.
3. Avoid passwords and tokens.
4. Avoid unnecessary sensitive payloads.
5. Record useful error context.
6. Never expose internal stack traces through API responses.

---

## 17.5 Request IDs

Every API request should receive a request ID.

The request ID should be:

1. Available to request logging.
2. Included in relevant API responses/headers where appropriate.
3. Used to correlate frontend-visible failures with backend logs.

---

## 17.6 Health Endpoint

Provide:

```text
GET /health
```

The health endpoint should provide a minimal indication of application/database availability.

Expected statuses:

```text
200 → healthy
503 → unavailable
```

---

## 17.7 Graceful Shutdown

The backend must handle:

```text
SIGINT
SIGTERM
```

Shutdown sequence:

```text
Stop accepting new requests
        ↓
Allow in-flight requests to complete
        ↓
Close HTTP server
        ↓
Close PostgreSQL pool
        ↓
Exit
```

A reasonable shutdown timeout should prevent indefinite hanging.

---

# 18. Development Workflow for Future Tickets

Standard workflow:

1. Read the ticket implementation specification.
2. Read referenced architecture/API/schema/testing documentation.
3. Confirm dependencies are complete.
4. Inspect existing implementation before making changes.
5. Implement backend behavior.
6. Add/update backend tests.
7. Implement frontend behavior.
8. Add/update frontend tests.
9. Run targeted tests.
10. Run `npm test`.
11. Run lint.
12. Run build.
13. Verify acceptance criteria.
14. Perform relevant manual QA.
15. Document residual risks or issues.
16. Review the final diff for unrelated changes.

---

# 19. Copilot Implementation Rules

GitHub Copilot is the implementation assistant, not the architecture owner.

Copilot must:

1. Read the ticket specification first.
2. Read referenced source-of-truth documents.
3. Inspect existing code before creating new code.
4. Follow approved architecture and contracts.
5. Implement only the scoped ticket.
6. Add/update tests alongside implementation.
7. Run tests and report results honestly.
8. Stop and report architectural conflicts rather than silently deciding them.
9. Avoid unrelated refactoring.
10. Avoid adding dependencies without justification.
11. Avoid replacing approved technologies with alternatives.
12. Update documentation only when approved implementation changes require it.

Architecture decisions remain owned by the project team.

If Copilot proposes a different framework, library, architectural layer, database strategy, or API contract, that proposal must be reviewed before implementation.

---

# 20. Foundation Implementation Sequence

Foundation must be implemented before US-001.

## Step 1: Workspace and Package Skeleton

Objective:

1. Establish root, frontend, and backend package boundaries and scripts.

Expected files:

1. `ddd/frontend/package.json`
2. `ddd/backend/package.json`
3. root `package.json`

Dependencies:

- None.

Tests required:

- TEST-001 baseline command existence.

Acceptance criteria:

1. Script structure exists for development, build, test, lint, and formatting.
2. Frontend and backend package boundaries are established.

---

## Step 2: Backend App Skeleton and Middleware Pipeline

Objective:

1. Establish Express application.
2. Establish route mounting.
3. Establish basic middleware pipeline.
4. Establish centralized error handling.
5. Establish request ID handling.
6. Establish basic security middleware.

Expected files:

```text
ddd/backend/src/app.js
ddd/backend/src/server.js
ddd/backend/src/middleware/errorMiddleware.js
ddd/backend/src/middleware/requestIdMiddleware.js
```

Dependencies:

- Step 1.

Tests required:

- Basic API response test.
- Health endpoint test.

Acceptance criteria:

1. Express starts.
2. `/health` responds.
3. Central error middleware is operational.
4. Request IDs are generated.
5. Baseline security middleware is configured.

---

## Step 3: Frontend App Skeleton and Routing

Objective:

1. Establish React application entry point.
2. Establish routing.
3. Establish authentication provider structure.
4. Establish protected-route framework.

Expected files:

```text
ddd/frontend/src/main.jsx
ddd/frontend/src/app/router.jsx
ddd/frontend/src/auth/AuthProvider.jsx
ddd/frontend/src/auth/ProtectedRoute.jsx
```

Dependencies:

- Step 1.

Tests required:

- Frontend smoke test.

Acceptance criteria:

1. Frontend starts.
2. Baseline shell renders.
3. Routing infrastructure exists.
4. Protected route infrastructure exists.

---

## Step 4: Database and Migration Foundation

Objective:

1. Establish PostgreSQL connection.
2. Establish `pg.Pool`.
3. Establish repository database access pattern.
4. Establish migration pipeline.
5. Establish development/test database configuration.

Expected files:

```text
ddd/backend/src/db/client.js
ddd/backend/src/db/transaction.js
ddd/backend/migrations/
```

Dependencies:

- Step 2.

Tests required:

1. Database connectivity test.
2. Migration execution test.

Acceptance criteria:

1. Development database connects successfully.
2. Test database connects successfully.
3. Migrations can be applied.
4. PostgreSQL queries use parameterized values.
5. Transaction helper works correctly.

---

## Step 5: Auth Infrastructure Baseline

Objective:

1. Establish reusable password hashing.
2. Establish JWT creation/verification.
3. Establish authentication middleware.

Expected files:

```text
ddd/backend/src/auth/jwt.js
ddd/backend/src/auth/password.js
ddd/backend/src/middleware/authMiddleware.js
```

Dependencies:

- Steps 2 and 4.

Tests required:

1. Argon2id password hashing tests.
2. Password verification tests.
3. JWT creation/verification tests.
4. JWT rejection tests.

Acceptance criteria:

1. Protected test route rejects missing authentication.
2. Protected test route rejects invalid authentication.
3. Protected test route accepts valid authentication.

---

## Step 6: Validation and Error Contract Baseline

Objective:

1. Establish `express-validator`.
2. Establish application error types.
3. Establish centralized API error formatting.

Expected files:

```text
ddd/backend/src/validation/
ddd/backend/src/common/errors.js
ddd/backend/src/common/response.js
```

Dependencies:

- Step 2.

Tests required:

1. Validation failure tests.
2. Error response contract tests.

Acceptance criteria:

1. Invalid requests return `400`.
2. Errors use the standard response envelope.
3. Internal error details are not exposed.

---

## Step 7: Test Harness Foundation

Objective:

1. Establish Vitest.
2. Establish Supertest.
3. Establish Playwright.
4. Establish test database configuration.
5. Establish test helper structure.

Expected files:

1. Frontend Vitest configuration.
2. Backend Vitest configuration.
3. Playwright configuration.
4. Test database helpers.
5. Shared test setup files.

Dependencies:

- Steps 1–6.

Tests required:

- TEST-001.
- TEST-002.

Acceptance criteria:

1. `npm test` executes automated tests.
2. Intentional test failures cause the command to fail.
3. Unit tests execute.
4. Integration tests execute.
5. E2E harness can execute.

---

## Step 8: Organization Isolation and Authorization Fixtures

Objective:

1. Establish reusable test factories for organizations, users, and authentication.
2. Prove organization isolation and basic authorization behavior.

Expected files may include:

```text
ddd/backend/tests/helpers/authFactory.js
ddd/backend/tests/helpers/orgFactory.js
ddd/backend/tests/helpers/userFactory.js
```

Dependencies:

- Steps 4–7.

Tests required:

1. Cross-organization denial test.
2. Protected route role denial test.

Acceptance criteria:

1. Organization A and B can be created independently.
2. Authenticated user A cannot access protected B resources.
3. Authorization behavior is testable before feature implementation begins.

---

# 21. Foundation Testing Requirements

Before US-001 begins, the foundation must prove:

1. Frontend starts in development mode.
2. Backend starts in development mode.
3. Backend can connect to PostgreSQL.
4. Development migrations apply successfully.
5. Test migrations apply successfully.
6. Test database setup is repeatable.
7. `npm test` runs successfully.
8. `npm test` fails on an intentional failing test.
9. Lint runs successfully.
10. Build runs successfully.
11. Backend baseline endpoint responds.
12. `/health` responds appropriately.
13. Frontend renders the baseline shell.
14. Frontend test infrastructure works.
15. Backend unit/integration test infrastructure works.
16. A protected route can be tested for `401` and successful authentication.
17. Organization isolation can be tested with A/B organization fixtures.
18. Test data can be isolated and cleaned between tests.
19. Argon2id password hashing is operational.
20. JWT authentication is operational.
21. Basic security middleware is operational.

Related matrix anchors:

1. TEST-001
2. TEST-002

---

# 22. Foundation Definition of Done

## Functionality

1. Repository has explicit frontend/backend runnable skeletons.
2. Configuration and script strategy is documented and implemented.
3. `/health` is operational.
4. Database connectivity is operational.
5. Database migrations are operational.

## Architecture Alignment

1. API foundation does not contradict `docs/api_endpoints.md`.
2. Database foundation does not contradict `docs/table_Schema_decisions.md`.
3. Authentication matches the finalized JWT bearer architecture.
4. Immutable interaction behavior matches the approved schema design.
5. Frontend uses native `fetch`.
6. Backend uses `pg` and PostgreSQL.
7. Controllers, services, and repositories follow the approved responsibilities.

## Security

1. Passwords use Argon2id.
2. JWT authentication is operational and tested.
3. Organization isolation is enforced and tested.
4. Authorization is enforced server-side.
5. SQL uses parameterized queries.
6. Helmet is configured.
7. CORS is restricted.
8. Rate limiting is configured.
9. Secrets are not committed.
10. Error responses do not expose sensitive implementation details.
11. Logs do not expose passwords, tokens, or secrets.

## Testing

1. Vitest is operational.
2. Supertest is operational.
3. Playwright is operational.
4. Dedicated test database is configured.
5. `npm test` executes automated tests.
6. Unit tests are operational.
7. Integration tests are operational.
8. Initial E2E harness is operational.
9. TEST-001 and TEST-002 can pass.

## Quality

1. ESLint is configured.
2. Prettier is configured.
3. Build scripts pass.
4. No unnecessary dependencies are introduced.

## Process

1. Foundation implementation sequence is complete.
2. No application feature tickets are partially implemented as part of foundation.
3. Copilot implementation rules are available to contributors.
4. Architecture decisions are treated as locked unless explicitly revisited.

---

# 23. Deferred Decisions and Future Infrastructure

The following are intentionally deferred from MVP.

## Authentication

1. Token blacklisting.
2. Refresh-token rotation.
3. Server-side session management.
4. OAuth/social login.

## Security

1. CSRF protection if authentication remains bearer-token based.
2. If authentication changes to cookies, CSRF protection must be added before that architecture is released.
3. Advanced WAF infrastructure.
4. Distributed rate limiting.

## Infrastructure

1. Redis.
2. Background job/queue systems.
3. Distributed tracing.
4. External observability platforms.
5. Kubernetes/container orchestration.

## Application Complexity

1. Advanced caching.
2. Sophisticated server-state management.
3. Advanced geocoding infrastructure.
4. Complex path optimization.
5. Gamification infrastructure.

These are not forgotten. They are deliberately excluded from the MVP foundation until product requirements justify them.

---

# 24. Geocoding Contract Reconciliation

Geocoding is intentionally kept behind the JoeKnock backend rather than making the frontend directly responsible for the provider integration.

Preferred flow:

```text
React
  ↓
JoeKnock API
  ↓
Geocoding service
  ↓
Nominatim / OpenStreetMap
```

The backend is responsible for:

1. Provider request formatting.
2. Provider response normalization.
3. Provider-specific implementation details.
4. Rate limiting where appropriate.
5. Preventing unnecessary frontend coupling to the provider.

The exact public API contract remains controlled by:

```text
docs/api_endpoints.md
```

Any conflicting ADR or Copilot instruction must be reconciled against that authoritative API contract before geocoding-specific implementation begins.

This does not block the general foundation.

---

# 25. Source-of-Truth Hierarchy

When project documents disagree, implementation should not silently choose one.

The following hierarchy applies for technical implementation conflicts:

1. `docs/api_endpoints.md` and `docs/table_Schema_decisions.md` as technical contracts.
2. This foundation specification for implementation baseline and conventions.
3. ADRs for architectural rationale and historical decisions.
4. Ticket-specific implementation requirements.
5. GitHub issue text as work-tracking context.

Product requirements remain authoritative for intended product behavior and scope.

If two authoritative documents conflict, stop and reconcile them before implementing the affected behavior.

---

# 26. Self-Review

This specification has been reconciled against the finalized MVP architecture.

## Finalized

1. React.
2. JavaScript frontend.
3. JavaScript backend.
4. Vite.
5. Node.js LTS.
6. Express.
7. PostgreSQL.
8. `pg`.
9. node-pg-migrate.
10. JWT bearer authentication.
11. localStorage token persistence for MVP.
12. React Context authentication state.
13. native `fetch`.
14. express-validator.
15. Argon2id.
16. Helmet.
17. CORS configuration.
18. express-rate-limit.
19. request IDs.
20. centralized error handling.
21. Vitest.
22. Supertest.
23. Playwright.
24. ESLint.
25. Prettier.
26. dotenv/config module.
27. Leaflet.
28. OpenStreetMap/Nominatim through the backend.
29. immutable interaction snapshots.
30. organization isolation.
31. role/visibility authorization model.
32. lightweight operational health/shutdown behavior.

## Explicitly Removed From MVP

1. TypeScript.
2. Prisma.
3. Zod.
4. Axios.
5. Redux/global-state framework.
6. CSRF middleware for the current bearer-token architecture.
7. Interaction activity-log table.
8. Refresh-token infrastructure.
9. Token blacklisting.
10. Redis/distributed infrastructure.

## Remaining Documentation Work

Before implementation of affected features, reconcile any remaining contradictions in:

1. ADRs that still reference Prisma.
2. ADRs that still reference TypeScript.
3. ADRs that still reference Zod.
4. Copilot instructions that reference superseded technologies.
5. Geocoding documentation that conflicts with `docs/api_endpoints.md`.

These are **documentation reconciliation tasks**, not new architecture decisions.

---

# Foundation Status

**Architecture: LOCKED**

**Technology stack: LOCKED**

**Database approach: LOCKED**

**Authentication approach: LOCKED**

**Security baseline: LOCKED**

**Testing stack: LOCKED**

**Repository architecture: LOCKED**

**Implementation workflow: LOCKED**

The foundation is now ready to serve as the implementation baseline for JoeKnock MVP.

No additional architecture decisions should be introduced unless implementation reveals a genuine requirement that is not addressed by this specification.
