# JoeKnock Project Foundation Specification

Status: Planned
Purpose: Define the implementation foundation required before US-001, US-002, US-003, and all subsequent application tickets.
Scope: Planning and documentation only. No application code, dependency installation, or environment provisioning is performed by this document.

---

# 1. Foundation Objectives

## 1.1 What the Foundation Must Provide

The project foundation must establish:

1. A concrete and minimal full-stack technology baseline for JoeKnock MVP.
2. A production-grade repository structure under ddd with explicit file paths and responsibilities.
3. A repeatable backend/frontend development workflow.
4. Shared conventions for API behavior, validation, auth context, authorization, and organization isolation.
5. A serious automated test architecture with npm test as the primary suite command.
6. Database migration and test-database patterns required for safe iterative development.
7. Clear implementation guardrails for Copilot and human contributors.

## 1.2 What the Foundation Explicitly Does Not Implement

This foundation specification does not implement:

1. Any MVP business feature endpoint or UI behavior from user-story tickets.
2. Any schema redesign beyond docs/table_Schema_decisions.md.
3. Any contract redesign beyond docs/api_endpoints.md.
4. Any post-MVP infrastructure (token blacklisting, distributed session systems, queue workers, etc.).
5. Any package installation or code scaffolding in the repository.

---

# 2. Technology Stack Decisions

This section turns current architecture intent into actionable implementation decisions. Where decisions are already fixed in source-of-truth docs, they are marked Established. Where not fixed by source docs, this foundation selects a final MVP implementation choice.

## 2.1 Summary

1. Frontend framework: React (Established by ADR/design docs)
2. Frontend language: TypeScript (Final foundation choice)
3. Frontend build tool: Vite (Final foundation choice)
4. Backend runtime: Node.js LTS (Final foundation choice)
5. Backend language: TypeScript (Final foundation choice)
6. Backend framework: Express (Established by design snapshot)
7. Database: PostgreSQL (Established by ADR-004)
8. DB access: Prisma ORM with explicit transactional usage (Final foundation choice)
9. Authentication: JWT bearer auth with stateless logout (Established by API docs)
10. API architecture: REST JSON over /api (Established by API docs)
11. Validation library: Zod (Final foundation choice)
12. Unit/API test framework: Vitest (Final foundation choice)
13. API/integration test transport: Supertest (Final foundation choice)
14. End-to-end test framework: Playwright (Final foundation choice)
15. Linting: ESLint (Final foundation choice)
16. Formatting: Prettier (Final foundation choice)
17. Environment/configuration: dotenv + typed config module (Final foundation choice)

## 2.1.1 Foundation Decision Rationale for Finalized Choices

TypeScript:

1. Improves correctness for auth context, organization scoping, and API contract mapping.
2. Reduces runtime class of errors for solo development.
3. Adds moderate setup complexity but improves long-term maintainability.

Prisma:

1. Best productivity/safety tradeoff for a solo MVP using PostgreSQL.
2. Strong migration workflow and typed DB access.
3. Acceptable lock-in risk for capstone scope.

Testing stack (Vitest + Supertest + Playwright):

1. Covers unit, API integration, and end-to-end needs with minimal tool fragmentation.
2. Supports required npm test behavior and strong local feedback loops.

JWT client storage:

1. localStorage is selected for MVP simplicity and session persistence.
2. Security guardrails are required: strict input validation, no dangerous HTML injection patterns, minimal token payload, and immediate clear on logout.
3. In-memory-only tokens are more secure for XSS but create weaker practical UX for MVP session continuity.

## 2.2 Recommendation Details

### Frontend Framework: React (Established)

What it is:

- Component-based frontend library.

Why it fits JoeKnock:

- Already aligned with product and architecture documentation.
- Strong ecosystem for map UI integration and route-guard patterns.

Why appropriate for MVP:

- Fast iteration and strong educational value for a capstone.

Alternatives considered:

- Vue, Svelte.

Why preferred:

- Existing project documentation repeatedly references React.

Migration risk:

- Low immediate risk; medium long-term switching cost if changed later.

### Frontend Build Tool: Vite (Recommended)

What it is:

- Lightweight dev server and build tool for modern frontend apps.

Why it fits JoeKnock:

- Fast startup and rebuild speed supports solo-developer productivity.

Why appropriate for MVP:

- Minimal config burden and straightforward testing integration.

Alternatives considered:

- CRA, Next.js, Parcel.

Why preferred:

- Simpler than Next.js for this API-separated architecture.
- Faster and more current than CRA for new projects.

Migration risk:

- Low. Vite is ecosystem-standard and easy to migrate from if needed.

### Backend Runtime: Node.js LTS (Recommended)

What it is:

- JavaScript runtime for server applications.

Why it fits JoeKnock:

- Single-language stack with React reduces cognitive overhead.

Why appropriate for MVP:

- Broad tooling support, low friction for a solo capstone.

Alternatives considered:

- Python/FastAPI, .NET, Go.

Why preferred:

- Best fit with existing React/Express documentation direction.

Migration risk:

- Low for MVP; language migration later is possible but non-trivial.

### Backend Framework: Express (Established)

What it is:

- Minimal web framework for Node.js APIs.

Why it fits JoeKnock:

- Direct mapping to current REST routes and middleware pipeline needs.

Why appropriate for MVP:

- Minimal abstraction and high learning value for backend fundamentals.

Alternatives considered:

- Fastify, NestJS.

Why preferred:

- Explicitly referenced in design snapshot and consistent with MVP simplicity.

Migration risk:

- Low-medium. Migration to Fastify/Nest later is feasible if scale requires.

### Database: PostgreSQL (Established)

What it is:

- Relational ACID database.

Why it fits JoeKnock:

- Strongly relational domain with strict ownership and historical constraints.

Why appropriate for MVP:

- Reliable transactions and SQL power for reporting and isolation tests.

Alternatives considered:

- MongoDB/document DB.

Why preferred:

- ADR-004 explicitly selects PostgreSQL for this domain.

Migration risk:

- Low; this is already foundationally established.

### Database Access Layer: Prisma ORM (Final Foundation Choice)

What it is:

- Type-safe ORM and migration tooling for Node + PostgreSQL.

Why it fits JoeKnock:

- Reduces boilerplate while keeping transactional operations explicit.
- Good fit for complex relationship traversal and typed query usage.

Why appropriate for MVP:

- Speeds safe development for one developer while preserving correctness.

Alternatives considered:

- Drizzle ORM, Knex + SQL, Sequelize, TypeORM.

Why preferred:

- Best balance of productivity, ecosystem maturity, and migration tooling.

Migration risk:

- Medium. ORM lock-in exists, but schema and SQL remain portable.

### Authentication: JWT Bearer, Stateless Logout (Established)

What it is:

- Signed token used on Authorization: Bearer headers.

Why it fits JoeKnock:

- Matches existing API contracts for login and logout.

Why appropriate for MVP:

- Keeps operational complexity low.

Alternatives considered:

- Server sessions, refresh-token rotation system, OAuth provider integration.

Why preferred:

- Existing contracts already define stateless logout and no required server mutation.

Migration risk:

- Medium if advanced auth requirements later emerge.

### API Architecture: REST JSON under /api (Established)

What it is:

- Resource/operation endpoints with JSON payloads and HTTP statuses.

Why it fits JoeKnock:

- Already fully documented with endpoint matrix.

Why appropriate for MVP:

- Transparent, easy to test, and understandable for capstone review.

Alternatives considered:

- GraphQL, gRPC.

Why preferred:

- Existing source-of-truth is REST.

Migration risk:

- Low-medium depending on future API consumption patterns.

### Validation Library: Zod (Final Foundation Choice)

What it is:

- Runtime schema validation with TypeScript inference.

Why it fits JoeKnock:

- Single-source validation models for request boundaries.

Why appropriate for MVP:

- Keeps validation explicit without heavy framework coupling.

Alternatives considered:

- Joi, Yup, express-validator, class-validator.

Why preferred:

- Strong type ergonomics and clean integration with both backend and frontend forms.

Migration risk:

- Low.

### Testing Framework: Vitest (Final Foundation Choice)

What it is:

- Fast test runner compatible with modern TS/JS stacks.

Why it fits JoeKnock:

- Works well for frontend unit tests and backend unit/integration tests in one ecosystem.

Why appropriate for MVP:

- Reduces tool fragmentation.

Alternatives considered:

- Jest + ts-jest.

Why preferred:

- Faster local feedback and strong Vite alignment.

Migration risk:

- Low.

### API/Integration Testing: Supertest (Final Foundation Choice)

What it is:

- HTTP assertions for Node server handlers.

Why it fits JoeKnock:

- Direct route-level testing for auth, isolation, and error contracts.

Why appropriate for MVP:

- Minimal setup, battle-tested.

Alternatives considered:

- Pactum, Frisby.

Why preferred:

- Simplicity and standard Express testing pattern.

Migration risk:

- Low.

### End-to-End Testing: Playwright (Final Foundation Choice)

What it is:

- Browser automation and end-to-end testing framework.

Why it fits JoeKnock:

- Supports critical map and auth workflow checks.

Why appropriate for MVP:

- Reliable cross-browser capability with strong debugging.

Alternatives considered:

- Cypress.

Why preferred:

- Better multi-browser parity and robust modern tooling.

Migration risk:

- Low-medium.

### Linting: ESLint (Final Foundation Choice)

What it is:

- Static analysis for code quality issues.

Why it fits JoeKnock:

- Enforces consistency and catches common defects early.

Why appropriate for MVP:

- Low-cost quality guardrail.

Alternatives considered:

- Biome-only linting.

Why preferred:

- Broad rule ecosystem and familiarity.

Migration risk:

- Low.

### Formatting: Prettier (Final Foundation Choice)

What it is:

- Automated code formatting.

Why it fits JoeKnock:

- Prevents style churn and review noise.

Why appropriate for MVP:

- Very low overhead, high consistency.

Alternatives considered:

- ESLint format-only, Biome formatter.

Why preferred:

- Established default and editor support.

Migration risk:

- Low.

### Environment/Config Management: dotenv + typed config module (Final Foundation Choice)

What it is:

- Environment variable loading and runtime config validation.

Why it fits JoeKnock:

- Clean separation of dev/test/prod behavior and secrets.

Why appropriate for MVP:

- Simple, familiar, and enough for single-developer operations.

Alternatives considered:

- dotenv-flow, external secret managers only.

Why preferred:

- Lowest complexity while still production-respectful.

Migration risk:

- Low.

---

# 3. Repository Structure (Production Proposal)

Current state: ddd is empty. This section defines the intended structure with explicit file extensions and responsibilities.

## 3.1 Top-Level

1. ddd/frontend
2. ddd/backend
3. docs
4. .github

## 3.2 Proposed Structure

```text
ddd/
	frontend/
		package.json
		tsconfig.json
		vite.config.ts
		index.html
		src/
			main.tsx
			app/
				App.tsx
				router.tsx
			auth/
				AuthProvider.tsx
				authStorage.ts
				useAuth.ts
				ProtectedRoute.tsx
			api/
				client.ts
				authApi.ts
			pages/
				LoginPage.tsx
				MapPage.tsx
				ProfilePage.tsx
			components/
			features/
			styles/
		tests/
			unit/
			integration/
		e2e/
			specs/
			fixtures/

	backend/
		package.json
		tsconfig.json
		src/
			server.ts
			app.ts
			config/
				env.ts
			common/
				errors.ts
				response.ts
				logger.ts
			middleware/
				authMiddleware.ts
				roleMiddleware.ts
				errorMiddleware.ts
				requestIdMiddleware.ts
			auth/
				authRoutes.ts
				authController.ts
				authService.ts
				jwt.ts
				password.ts
				authTypes.ts
			organization/
			users/
			teams/
			statuses/
			properties/
			interactions/
			map/
			reports/
			validation/
				schemas/
			db/
				client.ts
				transaction.ts
		prisma/
			schema.prisma
			migrations/
			seeds/
		tests/
			unit/
			integration/
			helpers/

	package.json
	.editorconfig
	.gitignore
	.env.example
```

## 3.3 Directory Responsibilities

1. frontend/src/auth
   - Client auth state lifecycle, token persistence, route guards.
2. frontend/src/api
   - HTTP client wrappers and endpoint modules.
3. backend/src/middleware
   - Authentication, authorization, request IDs, centralized errors.
4. backend/src/auth
   - Password hashing, JWT issue/verify, auth endpoints.
5. backend/src/validation
   - API boundary schemas and parse helpers.
6. backend/src/db
   - DB client ownership and transaction helpers.
7. backend/prisma
   - Source-controlled schema and migrations.
8. backend/tests
   - Unit and integration test suites.

Design constraint:

- Avoid introducing extra layers that add indirection without domain value.
- Route -> controller -> service -> db access is sufficient.

---

# 4. Package and Dependency Strategy

## 4.1 Package Manifests

Recommendation:

1. Keep a lightweight workspace root package.json for orchestration scripts.
2. Maintain separate package manifests at ddd/frontend and ddd/backend.

Why:

1. Clear runtime boundaries.
2. Isolated production dependencies per deployment target.
3. Easier dependency hygiene and faster installs for focused work.

Alternative:

- Single combined package.json.

Why not preferred:

- Blurs runtime boundaries and inflates install scope.

## 4.2 Dependency Boundaries

1. Frontend production deps: React, router, map UI libs, HTTP client.
2. Backend production deps: Express, JWT library, password hashing library, DB client/ORM, validation.
3. Shared dev tooling may live at root if it only orchestrates scripts.

## 4.3 Script Organization

1. Root scripts delegate to frontend/backend scripts.
2. Each package owns its own build/test/lint scripts.

---

# 5. Database Foundation

Database design is authoritative in docs/table_Schema_decisions.md and must not be redefined here.

## 5.1 Connection Strategy

1. One backend DB client initialized from environment config.
2. Per-request DB usage via service calls, not global mutable transaction state.
3. Separate DATABASE_URL values for dev and test.

## 5.2 Migration Strategy

1. Migrations are source-controlled under backend/prisma/migrations.
2. Schema changes are made only by migration files.
3. No direct manual table edits in shared environments.

## 5.3 Development Database Setup

1. Local PostgreSQL instance/database for development.
2. Migration command applied before app startup in new environments.

## 5.4 Test Database Strategy

1. Dedicated test database isolated from dev/prod.
2. Test run starts from migrated schema.
3. Test data generated per test/suite.

## 5.5 Transaction Handling

1. Multi-write operations such as registration must run in a single DB transaction.
2. Failures must rollback fully.

## 5.6 Seed Data Strategy

1. Minimal seed data for local manual testing only.
2. Automated tests should not depend on shared seed assumptions.

## 5.7 Schema Change Process

1. Update schema definition.
2. Generate migration.
3. Run migration on dev DB.
4. Add/adjust tests.
5. Commit migration and related code together.

## 5.8 Test Isolation and Corruption Prevention

Recommended pattern:

1. Wrap each integration test in DB transaction with rollback when feasible.
2. Where multi-connection behavior prevents per-test rollback, truncate/reset all tables between tests in dependency-safe order.
3. Never reuse mutable cross-test fixtures.

Alternatives:

1. Fresh database per test file.
2. Docker snapshot restore per suite.

Preferred for MVP:

- Transaction rollback + deterministic cleanup hybrid, due to simplicity and speed.

Migration risk:

- Low. Can evolve to container-per-suite if parallelism needs grow.

---

# 6. Authentication Foundation

Must support US-001, US-002, US-003 exactly as documented.

## 6.1 Password Hashing

Recommendation:

1. Use bcrypt with cost factor set via config.

Rationale:

1. Mature and widely understood for MVP auth.

## 6.2 JWT Creation and Validation

1. JWT issued on successful register/login.
2. JWT verification middleware required on protected routes.
3. Token contains user id, organization id, role, and standard claims.
4. Do not include sensitive fields.

## 6.3 Authentication Middleware

1. Parse bearer token.
2. Verify signature and expiry.
3. Attach authenticated context to request object.
4. Reject missing/invalid token with 401 structured error.

## 6.4 Authenticated Request Context

Standard request context:

1. userId
2. organizationId
3. role
4. team membership may be loaded lazily by service when needed

## 6.5 Organization and Role Context

1. Organization context is server-owned from JWT/user record.
2. Client never supplies authoritative organization ownership for protected operations.

## 6.6 Client-Side Auth State

1. Auth provider stores token and basic user context.
2. Token storage mechanism for MVP is localStorage.
3. Protected route component enforces auth before page render.
4. Logout clears persisted and in-memory auth state.

## 6.7 Logout Behavior

1. API endpoint is authenticated and returns success message.
2. No server-side token blacklist/session invalidation for MVP.
3. Client removal of token is authoritative logout behavior for MVP.

---

# 7. Organization Isolation Foundation

Organization isolation is a critical security boundary.

## 7.1 Identity Source

1. organizationId comes from authenticated user context.
2. It is never trusted from incoming body/query/path as ownership authority.

## 7.2 Backend Query Scope Pattern

Required reusable pattern:

1. Every organization-owned query includes organization_id filter.
2. Any lookup by id must include both id and organization_id.

## 7.3 Interaction With Authorization

1. Isolation applies first as hard boundary.
2. Role/visibility checks apply within organization scope.

## 7.4 Cross-Organization Prevention

This pattern prevents:

1. UUID guessing access.
2. Cross-org joins exposing unauthorized resources.
3. Foreign key association across organizations.

## 7.5 Testing

Minimum repeated pattern in integration tests:

1. Create Organization A and B.
2. Authenticate user from A.
3. Attempt access to B resources.
4. Expect denial/not-found per endpoint policy.

---

# 8. Authorization Foundation

Authorization must follow finalized MVP role and interaction-editing rules.

## 8.1 Roles

1. rep
2. manager
3. admin

Roles are stored on users and used by policy guards.

## 8.2 Policy Structure

Recommendation:

1. Route-level role requirements for broad access.
2. Service-level resource ownership checks for nuanced rules.

## 8.3 Interaction Edit Rule

Critical rule:

1. Managers/admins do not automatically gain edit authority over another representative interaction.
2. They remain view-only for other representatives unless an explicit future rule changes this.

## 8.4 Visibility Integration

1. Representative visibility self/team/organization controls readable interaction set.
2. Visibility and edit authority are separate decisions.

---

# 9. API Foundation

Endpoint contracts remain authoritative in docs/api_endpoints.md.

## 9.1 Routing Structure

Suggested backend route modules:

1. /auth
2. /me
3. /organization
4. /users
5. /teams
6. /statuses
7. /properties
8. /interactions
9. /map
10. /reports

## 9.2 Request/Response Conventions

1. JSON request/response.
2. Success uses endpoint-specific payload shape.
3. Errors follow consistent structure:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message"
  }
}
```

## 9.3 HTTP Status Conventions

1. 200 for successful reads/operations.
2. 201 for created resources when appropriate.
3. 400 for validation errors.
4. 401 for missing/invalid auth.
5. 403 for authenticated but disallowed actions when applicable.
6. 404 where resource should be hidden or absent per policy.
7. 409 for duplicate/conflict.
8. 500 for unexpected server errors.

## 9.4 Error Handling Boundaries

1. Validation layer maps known parse errors to 400.
2. Auth middleware maps token issues to 401.
3. Authorization checks map to 403/404 per endpoint policy.
4. DB known conflicts map to 409 where contractually expected.
5. Unhandled exceptions map to 500 with safe generic messages.

## 9.5 Logging Boundaries

1. Log request method/path/status/timing.
2. Log correlation/request id.
3. Do not log passwords, tokens, or sensitive PII fields in full.

---

# 10. Validation Foundation

Validation responsibilities should be layered without contradiction.

## 10.1 Frontend

1. UX-focused validation for fast feedback.
2. Never treated as security boundary.

## 10.2 API Boundary

1. Full schema validation of input payloads and params.
2. Required canonical guardrail before service logic.

## 10.3 Business Layer

1. Domain rules requiring data/context checks (ownership, state transitions).
2. Not duplicated as simple field-level type checks.

## 10.4 Database Layer

1. Final integrity enforcement through constraints and transaction boundaries.

---

# 11. Testing Architecture

Testing must match docs/testing/testing-strategy.md and docs/testing/test-matrix.md.

## 11.1 Unit Tests

Belongs here:

1. Pure business-rule utilities.
2. Validation helpers.
3. Permission and visibility computation logic.
4. JWT/password utility wrappers.

Does not belong here:

1. Database behavior validation.
2. Full route and middleware integration.

## 11.2 Integration/API Tests

Must cover:

1. Route behavior and status codes.
2. Authentication and authorization failures.
3. Organization isolation boundaries.
4. Transaction behavior for multi-write operations.
5. API error contract shape.

## 11.3 Frontend Tests

Must cover:

1. Critical components and hooks.
2. Auth state lifecycle.
3. Protected route gating.
4. Important user interactions in auth and map workflow surfaces.

## 11.4 End-to-End Tests

Critical workflow coverage target:

1. Register organization.
2. Login.
3. Logout.
4. Authenticated map access.
5. Property resolution flow.
6. Record interaction.
7. Edit interaction snapshot.
8. Organization isolation checks.
9. Reporting access and filtering safety.

---

# 12. Test Database Strategy

## 12.1 Goals

1. Deterministic repeatability.
2. No test-order dependency.
3. Isolation across suites.
4. Safe parallel runs when enabled.

## 12.2 Recommended Approach

1. Dedicated test database URL.
2. Migrations applied before test suite.
3. Factory-based test data creation per test.
4. Per-test transaction rollback where practical.
5. Table cleanup fallback where transaction boundaries do not fit.

## 12.3 Isolation Testing Patterns

1. Always create at least two organizations in isolation suites.
2. Verify same endpoint with same resource type across org boundary.

## 12.4 Immutable Snapshot Testing Support

1. Seed one interaction group with multiple snapshots.
2. Assert is_current transition and unchanged historical snapshot payloads.

## 12.5 Alternatives Considered

1. Full DB recreate per test file.
2. Container-per-test-suite orchestration.

Why recommended option is preferable for MVP:

1. Lower operational burden and faster local iteration.

Migration risk:

1. Low; strategy can evolve with project scale.

---

# 13. Test Scripts

Intended scripts (not implemented yet):

1. npm test
   - Runs backend and frontend automated suites required for baseline confidence.
2. npm run test:unit
3. npm run test:integration
4. npm run test:e2e
5. npm run test:watch
6. npm run test:coverage
7. npm run lint
8. npm run format
9. npm run build
10. npm run dev

Root-level orchestration scripts should proxy into frontend/backend package scripts.

---

# 14. Code Quality Standards

Practical standards:

1. ESLint required in CI/local pre-merge checks.
2. Prettier formatting required for consistency.
3. Clear, domain-explicit naming over short ambiguous names.
4. Async errors must be centrally handled; avoid unhandled promise rejection patterns.
5. Environment variables must be validated on startup.
6. Secrets never committed.
7. Structured logs with request IDs.
8. New dependencies require explicit justification in PR/ticket notes.
9. Comments should explain why, not restate obvious code behavior.

---

# 15. Environment Configuration

## 15.1 Environments

1. Development
2. Test
3. Production

## 15.2 Required Environment Variables (Initial)

Backend:

1. NODE_ENV
2. PORT
3. DATABASE_URL
4. JWT_SECRET
5. JWT_EXPIRES_IN
6. CORS_ORIGIN
7. LOG_LEVEL

Frontend:

1. VITE_API_BASE_URL

Optional geocoding configuration keys may be added once provider call strategy is finalized in foundation implementation.

## 15.3 Secret Classification

Secrets:

1. JWT_SECRET
2. Any DB credential in DATABASE_URL
3. Any future provider API keys

Non-secret examples:

1. PORT
2. LOG_LEVEL
3. public API base URL

## 15.4 Env File Handling

1. Commit .env.example with placeholders only.
2. Do not commit real .env files.
3. Use separate local files for dev and test values.

---

# 16. Security Baseline

Minimum required practices:

1. Passwords stored only as secure hashes.
2. JWT verification required on protected routes.
3. Strict authorization and organization isolation checks in backend.
4. Input validation at API boundary.
5. Parameterized ORM/query behavior to avoid injection risk.
6. Sensitive error details never returned to clients.
7. Secrets stored in environment only.
8. Dependency hygiene via periodic audit/update.
9. CORS restricted to intended frontend origins.
10. Basic rate limiting is recommended for public auth endpoints to reduce brute-force risk.

Rate limiting note:

- Keep implementation simple for MVP, route-specific on auth endpoints first.

---

# 17. Error and Logging Strategy

## 17.1 Development Logging

1. Human-readable logs with request ID and stack traces.
2. Helpful context for debugging validation and DB errors.

## 17.2 Production-Safe Logging

1. Structured JSON logs.
2. No password/token/secret values in logs.
3. No full sensitive payload dumping.

## 17.3 Structured API Errors

Use consistent response envelope for known and unknown errors.

## 17.4 Client Data Safety

Never return:

1. Password hashes.
2. JWT secrets.
3. Raw internal stack traces.
4. Detailed SQL/DB internal exceptions.

## 17.5 Unexpected Exception Handling

1. Global error middleware catches uncaught route/service errors.
2. Logs details server-side.
3. Returns generic 500 error response.

---

# 18. Development Workflow for Future Tickets

Standard ticket workflow:

1. Read ticket implementation spec in docs/implementation/tickets.
2. Read referenced architecture/API/schema/testing docs.
3. Confirm dependencies are complete.
4. Implement backend/API behavior.
5. Implement automated tests for changed behavior.
6. Implement frontend behavior.
7. Run targeted tests.
8. Run npm test.
9. Run lint and build scripts.
10. Verify against acceptance criteria and scope boundaries.
11. Perform manual QA checks relevant to ticket.
12. Document residual risks/open issues.

---

# 19. Copilot Implementation Rules

Copilot must:

1. Read the ticket spec first.
2. Read referenced source-of-truth documents.
3. Inspect existing code before creating new code.
4. Follow approved architecture and contracts.
5. Implement only the scoped ticket.
6. Add/update tests alongside implementation.
7. Run tests and report results honestly.
8. Stop and report conflicts rather than silently deciding architecture.
9. Avoid unrelated refactoring.
10. Avoid adding dependencies without clear justification.
11. Update docs only when implementation changes approved behavior/contracts.

---

# 20. Foundation Implementation Sequence

Foundation must be implemented before US-001.

## Step 1: Workspace and Package Skeleton

Objective:

1. Establish root + frontend + backend package boundaries and scripts.

Expected files:

1. ddd/frontend/package.json
2. ddd/backend/package.json
3. root package.json

Dependencies:

1. None.

Tests required:

1. TEST-001 baseline command existence.

Acceptance criteria:

1. Script placeholders exist for dev/build/test/lint.

Verification commands:

1. npm test (expected to run scaffold test command behavior once implemented)

## Step 2: Backend App Skeleton and Middleware Pipeline

Objective:

1. Establish Express app, route mounting, central error handling.

Expected files:

1. ddd/backend/src/app.ts
2. ddd/backend/src/server.ts
3. ddd/backend/src/middleware/errorMiddleware.ts

Dependencies:

1. Step 1.

Tests required:

1. Basic API responds test.

Acceptance criteria:

1. Health or baseline route returns successful response.

Verification commands:

1. npm run test:integration

## Step 3: Frontend App Skeleton and Routing

Objective:

1. Establish React app entry and protected route framework.

Expected files:

1. ddd/frontend/src/main.tsx
2. ddd/frontend/src/app/router.tsx
3. ddd/frontend/src/auth/ProtectedRoute.tsx

Dependencies:

1. Step 1.

Tests required:

1. Frontend smoke test.

Acceptance criteria:

1. App starts and route guard infra exists.

Verification commands:

1. npm run test:unit

## Step 4: Database and Migration Foundation

Objective:

1. Establish DB client, migration pipeline, and initial schema integration path.

Expected files:

1. ddd/backend/prisma/schema.prisma
2. ddd/backend/prisma/migrations/
3. ddd/backend/src/db/client.ts

Dependencies:

1. Step 2.

Tests required:

1. DB connectivity and migration execution checks.

Acceptance criteria:

1. Local dev DB migrates successfully via defined commands.

Verification commands:

1. npm run build
2. npm run test:integration

## Step 5: Auth Infrastructure Baseline

Objective:

1. Implement reusable password/JWT/auth middleware infrastructure only.

Expected files:

1. ddd/backend/src/auth/jwt.ts
2. ddd/backend/src/auth/password.ts
3. ddd/backend/src/middleware/authMiddleware.ts

Dependencies:

1. Steps 2 and 4.

Tests required:

1. Password hashing utility tests.
2. JWT verify/reject tests.

Acceptance criteria:

1. Protected test route can enforce valid auth.

Verification commands:

1. npm run test:unit
2. npm run test:integration

## Step 6: Validation and Error Contract Baseline

Objective:

1. Establish validation helpers and consistent API error shape.

Expected files:

1. ddd/backend/src/validation/schemas/
2. ddd/backend/src/common/errors.ts
3. ddd/backend/src/common/response.ts

Dependencies:

1. Step 2.

Tests required:

1. Validation failure and error-shape tests.

Acceptance criteria:

1. Invalid requests return expected 400 contract.

Verification commands:

1. npm run test:integration

## Step 7: Test Harness Foundation

Objective:

1. Finalize test runner wiring for unit, integration, frontend, e2e categories.

Expected files:

1. backend and frontend test configuration files.
2. shared test helper modules.

Dependencies:

1. Steps 1-6.

Tests required:

1. TEST-001 and TEST-002 core checks.

Acceptance criteria:

1. npm test runs and correctly reports pass/fail status.

Verification commands:

1. npm test
2. npm run test:coverage

## Step 8: Organization Isolation and Authorization Test Fixtures

Objective:

1. Build reusable fixture helpers for multi-organization and role scenarios.

Expected files:

1. ddd/backend/tests/helpers/authFactory.ts
2. ddd/backend/tests/helpers/orgFactory.ts

Dependencies:

1. Steps 4-7.

Tests required:

1. Cross-org denial baseline test.
2. Protected route role denial baseline test.

Acceptance criteria:

1. Foundation proves isolation and auth checks are testable prior to feature implementation.

Verification commands:

1. npm run test:integration

---

# 21. Foundation Testing Requirements

Before US-001 begins, foundation must prove:

1. Application processes start in dev mode (frontend and backend).
2. Backend can connect to database.
3. Migrations apply successfully in dev and test contexts.
4. Test database setup works repeatedly.
5. npm test runs and fails correctly on intentional failing test.
6. lint script runs.
7. build script runs.
8. API server responds to baseline request.
9. Frontend starts and renders baseline shell.
10. Frontend test infrastructure works.
11. Backend test infrastructure works.
12. A protected route can be tested for 401 and success.
13. Organization isolation can be tested with A/B org fixtures.
14. Test data can be reset/isolated between tests.

Related matrix anchors:

1. TEST-001
2. TEST-002

---

# 22. Foundation Definition of Done

Functionality:

1. Repository has explicit frontend/backend runnable skeleton.
2. Config and script strategy is documented and implemented.

Architecture alignment:

1. API foundation does not contradict docs/api_endpoints.md.
2. DB foundation does not contradict docs/table_Schema_decisions.md.
3. Auth/logout approach matches stateless MVP contracts.

Security:

1. Auth middleware baseline exists and is tested.
2. Organization isolation query pattern exists and is tested.
3. No secret leakage through config or error responses.

Testing:

1. npm test exists and executes automated suite.
2. Unit and integration layers are operational.
3. Initial e2e harness is operational.
4. TEST-001 and TEST-002 can pass.

Quality:

1. lint and format scripts exist and pass on scaffold.
2. build scripts exist and pass on scaffold.

Process:

1. Foundation implementation sequence steps are complete.
2. No application feature tickets are partially implemented as part of foundation.

---

# 23. Open Decisions

Only unresolved items that cannot be fully settled from current source-of-truth are listed.

Resolved by this foundation specification (no longer open):

1. TypeScript is selected for frontend and backend.
2. Prisma is selected as the PostgreSQL ORM/migration tooling.
3. JWT client storage is selected as localStorage for MVP.
4. Testing stack is selected as Vitest + Supertest + Playwright.

## Decision 1: Geocoding Contract Reconciliation Across Docs

Why it matters:

1. Impacts API contract authority, ticket implementation behavior, and regression risk.

Current contradiction:

1. ADR-016 describes public endpoints under /api/geocoding.
2. docs/api_endpoints.md and .github/copilot-instructions.md define geocoding as an internal backend detail behind POST /api/properties/resolve.

Recommended implementation choice for MVP:

1. Use docs/api_endpoints.md as operational contract for coding and testing.
2. Keep geocoding internal behind POST /api/properties/resolve.

Alternatives:

1. Adopt ADR-016 public geocoding endpoints and revise API/contracts accordingly.

Consequence of recommended choice:

1. Preserves current endpoint inventory and minimizes MVP complexity.
2. Keeps provider abstraction clean and avoids exposing unnecessary public geocoding surface.

What requires Corey decision:

1. Explicitly confirm which document is the long-term canonical geocoding contract.
2. Approve harmonization update so ADR/API/Copilot instructions all match one model.

Blocks implementation:

1. Does not block foundation scaffolding.
2. Should be resolved before geocoding-specific feature implementation to avoid contract drift.

---

# Self-Review Notes

This specification was reviewed against:

1. Finalized architecture, API, schema, and testing docs.
2. Existing implementation ticket constraints for US-001/US-002/US-003.
3. Copilot instruction guardrails for scope and architecture stability.

Review outcome:

1. No application behavior was added beyond documented MVP boundaries.
2. No schema or endpoint redesign was introduced.
3. TypeScript, Prisma, JWT client storage, and testing stack are now finalized foundation choices.
4. Geocoding contract contradiction remains the only documented open decision requiring Corey confirmation.
5. Foundation sequence is ordered to unblock US-001 dependency requirements.
