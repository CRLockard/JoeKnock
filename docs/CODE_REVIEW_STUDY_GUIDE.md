# JoeKnock Code Review Study Guide

## Purpose

This guide is for code-review preparation on the current implementation.

Use it to answer, quickly and accurately:

- What this system does
- How requests flow through the stack
- Where auth/authz and organization isolation are enforced
- How map, interaction snapshots, reporting, and export behavior work
- Which tests prove each claim

Source of truth rule:

- Runtime behavior is defined by code in ddd/frontend and ddd/backend.
- Project docs are useful context, but if a doc and code disagree, explain the current code first.

## 5-Minute Architecture Snapshot

JoeKnock is a map-first, tenant-scoped field workflow app.

Runtime flow:

Browser -> React + Router -> AuthProvider + ProtectedRoute -> frontend API wrappers -> Express routes -> validators + auth middleware -> services -> SQL repositories -> PostgreSQL

Current stack facts:

- Frontend: React + Vite + JavaScript
- Backend: Express + pg
- Migrations: node-pg-migrate
- Auth: JWT bearer token
- Tests: Vitest + Supertest + Playwright

High-value anchors:

- Router root and protected routes: ddd/frontend/src/app/router.jsx:11
- Route guard component: ddd/frontend/src/auth/ProtectedRoute.jsx:4
- API fetch wrapper: ddd/frontend/src/api/client.js:40
- API route composition: ddd/backend/src/routes/apiRoutes.js:26
- Auth middleware and claim validation: ddd/backend/src/middleware/authMiddleware.js:10
- Report date conversion utility: ddd/backend/src/reports/reportDateRange.js:127

## How to Navigate the Codebase

Use this order during live review demos.

1. Entry and composition
- Frontend bootstrap: ddd/frontend/src/main.jsx
- Router: ddd/frontend/src/app/router.jsx
- Backend app wiring: ddd/backend/src/app.js
- API mount graph: ddd/backend/src/routes/apiRoutes.js:26

2. Security boundary
- JWT sign/verify: ddd/backend/src/auth/jwt.js
- Auth middleware: ddd/backend/src/middleware/authMiddleware.js
- Validation normalizer: ddd/backend/src/validation/validate.js
- Error envelope: ddd/backend/src/middleware/errorMiddleware.js

3. One vertical feature slice
- Start in route file
- Then service file
- Then repository SQL file
- Then one integration test proving behavior

4. Complex behavior hotspots
- Interaction snapshot revisions: ddd/backend/src/interactions/interactionsService.js:269
- Current-pointer flips: ddd/backend/src/interactions/interactionsRepository.js:455
- Visibility CTE for reports: ddd/backend/src/reports/reportsRepository.js:15
- Visibility CTE for exports: ddd/backend/src/exports/exportsRepository.js:8
- Property dedupe on normalized address: ddd/backend/src/properties/propertiesService.js:228

## Feature Review Template

Use this template for any feature walkthrough.

- What it does
- Workflow
- Primary files
- Key functions and anchors
- Data model touchpoints
- Security and permissions
- Important decisions and why
- Tests that prove it
- Likely reviewer questions

## Feature Packet: Authentication and Session

What it does:

- Registers organizations and first admin
- Logs users in with JWT
- Protects routes and recovers from stale auth on frontend

Workflow:

- Login page submits credentials
- Frontend calls auth API
- Backend validates user/password
- Backend signs JWT with userId subject + organizationId + role
- Frontend stores token and user, ProtectedRoute unlocks app routes

Primary files:

- ddd/frontend/src/pages/LoginPage.jsx
- ddd/frontend/src/auth/AuthProvider.jsx
- ddd/frontend/src/auth/authStorage.js
- ddd/frontend/src/auth/ProtectedRoute.jsx
- ddd/frontend/src/api/authApi.js
- ddd/backend/src/auth/authRoutes.js
- ddd/backend/src/auth/authService.js
- ddd/backend/src/auth/jwt.js

Key functions and anchors:

- Auth failure handler registration: ddd/frontend/src/auth/AuthProvider.jsx:16
- Frontend fetch wrapper: ddd/frontend/src/api/client.js:40
- JWT signer: ddd/backend/src/auth/jwt.js:4
- Auth middleware claim validation: ddd/backend/src/middleware/authMiddleware.js:10

Data model touchpoints:

- organizations
- organization_settings
- users

Security and permissions:

- Backend verifies JWT and derives req.auth
- Routes trust req.auth, not client-submitted org/user ids
- Stale/invalid JWT leads to UNAUTHENTICATED handling

Important decisions and why:

- Stateless JWT logout in MVP keeps auth simple
- localStorage persistence supports session continuity in browser

Tests that prove it:

- ddd/frontend/src/tests/auth-recovery.test.jsx
- ddd/frontend/src/tests/login-flow.test.jsx
- ddd/backend/tests/integration/auth-login.test.js
- ddd/backend/tests/integration/current-user.test.js

Likely reviewer questions:

- Where are JWT claims validated?
- How do you prevent forged organizationId in requests?
- What happens on expired token?

## Feature Packet: Map and Property Resolution

What it does:

- Shows markers for visible current interactions in viewport
- Resolves clicked map location to a canonical property

Workflow:

- Frontend requests map markers for bounds
- Backend applies visibility/org filters and returns marker list
- Frontend click triggers property resolve
- Backend reverse-geocodes and normalizes address
- Existing property is reused or a new property is inserted

Primary files:

- ddd/frontend/src/pages/MapPage.jsx
- ddd/frontend/src/api/mapApi.js
- ddd/frontend/src/api/propertiesApi.js
- ddd/backend/src/map/mapRoutes.js
- ddd/backend/src/map/mapService.js
- ddd/backend/src/map/mapRepository.js
- ddd/backend/src/properties/propertiesService.js
- ddd/backend/src/properties/geocodingProvider.js
- ddd/backend/src/properties/addressNormalization.js

Key functions and anchors:

- Marker repository entry: ddd/backend/src/map/mapRepository.js:81
- Property resolve service: ddd/backend/src/properties/propertiesService.js:149
- Existing property lookup: ddd/backend/src/properties/propertiesService.js:228
- Property creation fallback: ddd/backend/src/properties/propertiesService.js:240

Data model touchpoints:

- properties
- interactions (current rows for marker visibility)

Security and permissions:

- Requests are authenticated
- org scope and rep_visibility are enforced in SQL

Important decisions and why:

- Geocoding is backend-only to protect provider usage and normalize behavior
- Property identity is canonicalized by normalized address to reduce duplicates

Tests that prove it:

- ddd/backend/tests/integration/map-properties.test.js
- ddd/backend/tests/integration/properties-resolve.test.js
- ddd/frontend/tests/e2e/map-interaction.spec.js

Likely reviewer questions:

- Why are properties without current interactions omitted from markers?
- How do you avoid duplicate properties from geocoder retries?

## Feature Packet: Interaction Snapshots (Immutable History)

What it does:

- Creates and revises interaction state as immutable snapshots
- Maintains one current row per interaction group

Workflow:

- Create flow inserts first snapshot with new group id
- Revise flow checks visibility/permissions
- Existing current row is cleared
- New snapshot inserted as current

Primary files:

- ddd/backend/src/interactions/interactionsService.js
- ddd/backend/src/interactions/interactionsRepository.js
- ddd/backend/src/interactions/interactionsValidation.js
- ddd/backend/src/properties/propertiesRoutes.js

Key functions and anchors:

- Service factory: ddd/backend/src/interactions/interactionsService.js:71
- Create snapshot flow: ddd/backend/src/interactions/interactionsService.js:76
- Revision flow: ddd/backend/src/interactions/interactionsService.js:269
- Clear current pointer: ddd/backend/src/interactions/interactionsRepository.js:455

Data model touchpoints:

- interactions
- statuses
- users
- properties

Security and permissions:

- Role/ownership/team rules checked in service
- org scoping enforced by repository filters and identifiers
- Optional idempotency via clientRequestId

Important decisions and why:

- Immutable snapshots preserve auditability
- Current-pointer model gives fast reads for active state

Tests that prove it:

- ddd/backend/tests/integration/interactions-phase3.test.js
- ddd/backend/tests/integration/properties-view.test.js

Likely reviewer questions:

- Why immutable snapshots instead of in-place updates?
- How do you enforce one current snapshot per group?

## Feature Packet: Reporting and CSV Export

What it does:

- Aggregates activity by status and representative
- Exports filtered activity to CSV

Workflow:

- Frontend sends date range and optional filters
- Backend validates query
- Service resolves org timezone and rep_visibility
- dateFrom/dateTo are converted from org-local day boundaries to UTC instants
- Repository SQL aggregates only authorized interactions
- Export path reuses visibility and date semantics

Primary files:

- ddd/frontend/src/pages/ActivityReportPage.jsx
- ddd/frontend/src/api/reportsApi.js
- ddd/frontend/src/api/exportsApi.js
- ddd/backend/src/reports/reportsRoutes.js
- ddd/backend/src/reports/reportsService.js
- ddd/backend/src/reports/reportsRepository.js
- ddd/backend/src/reports/reportDateRange.js
- ddd/backend/src/exports/exportsRoutes.js
- ddd/backend/src/exports/exportsService.js
- ddd/backend/src/exports/exportsRepository.js

Key functions and anchors:

- Reports route composition: ddd/backend/src/reports/reportsRoutes.js:27
- UTC range conversion utility: ddd/backend/src/reports/reportDateRange.js:127
- Report SQL root: ddd/backend/src/reports/reportsRepository.js:8
- Report visibility CTE: ddd/backend/src/reports/reportsRepository.js:15
- Export SQL root: ddd/backend/src/exports/exportsRepository.js:1
- Export visibility CTE: ddd/backend/src/exports/exportsRepository.js:8

Data model touchpoints:

- interactions
- users
- team_users
- statuses
- organization_settings
- properties

Security and permissions:

- reports/exports routes require manager/admin
- visibility logic still applies inside SQL for least privilege
- all queries parameterized

Important decisions and why:

- Shared semantics between report and export prevent policy drift
- org-local date interpretation avoids user-facing off-by-one-day confusion

Tests that prove it:

- ddd/backend/tests/integration/reports-activity.test.js
- ddd/backend/tests/integration/exports-properties.test.js
- ddd/backend/tests/unit/report-date-range.test.js
- ddd/frontend/tests/e2e/reports-export.spec.js

Likely reviewer questions:

- Why does UTC output differ by timezone for same calendar date?
- How do you guarantee export and report parity?

## Feature Packet: Organization, Users, Teams, Statuses

What it does:

- Maintains tenant settings, user lifecycle, team membership, and status catalog

Workflow:

- Route-level role checks gate management operations
- Validation enforces strict payload contracts
- Service layer applies domain constraints
- Repository layer executes org-scoped SQL updates and reads

Primary files:

- ddd/backend/src/organization/*
- ddd/backend/src/users/*
- ddd/backend/src/teams/*
- ddd/backend/src/statuses/*

Key functions and anchors:

- Organization settings update: ddd/backend/src/organization/organizationService.js:64
- User service factory: ddd/backend/src/users/usersService.js:43
- User activation path: ddd/backend/src/users/usersService.js:49
- Team service factory: ddd/backend/src/teams/teamsService.js:32
- Status service factory: ddd/backend/src/statuses/statusesService.js:30

Data model touchpoints:

- organization_settings
- users
- teams
- team_users
- statuses

Security and permissions:

- Admin-only for highest-impact changes (for example user activation)
- Manager/admin for team and status management
- strict org scoping in queries

Important decisions and why:

- Strict allow-list validation prevents silent payload drift
- Team membership is security-relevant because visibility can depend on team

Tests that prove it:

- ddd/backend/tests/integration/organization-settings.test.js
- ddd/backend/tests/integration/users-deactivate.test.js
- ddd/backend/tests/integration/teams-view.test.js
- ddd/backend/tests/integration/statuses-update.test.js

Likely reviewer questions:

- Why is teamId filter blocked on users list in current scope?
- Why are status mutations restricted to manager/admin?

## Code Review Cheat Sheet

Use these quick starts when a reviewer asks to "show me where".

| Topic | Open First | Then Open | Explain In One Sentence |
| --- | --- | --- | --- |
| Login | ddd/frontend/src/pages/LoginPage.jsx | ddd/backend/src/auth/authService.js | Password verify then JWT issuance with org/role claims. |
| Route guard | ddd/frontend/src/auth/ProtectedRoute.jsx | ddd/frontend/src/app/router.jsx | Private pages redirect to login when session is missing. |
| API auth context | ddd/backend/src/middleware/authMiddleware.js | ddd/backend/src/routes/apiRoutes.js | req.auth is canonical identity context for all protected routes. |
| Org isolation | ddd/backend/src/reports/reportsRoutes.js | ddd/backend/src/reports/reportsRepository.js | Route passes req.auth.organizationId and SQL enforces tenant scope. |
| Map markers | ddd/frontend/src/pages/MapPage.jsx | ddd/backend/src/map/mapRepository.js | Markers represent properties with visible current interactions in bounds. |
| Property resolve | ddd/frontend/src/api/propertiesApi.js | ddd/backend/src/properties/propertiesService.js | Reverse geocode + normalized-address dedupe creates canonical property identity. |
| Snapshot revise | ddd/backend/src/interactions/interactionsService.js | ddd/backend/src/interactions/interactionsRepository.js | Revisions create new immutable rows and move current pointer. |
| Reports | ddd/frontend/src/pages/ActivityReportPage.jsx | ddd/backend/src/reports/reportsService.js | Filters become org-timezone UTC window plus visibility-constrained aggregation. |
| CSV export | ddd/frontend/src/api/exportsApi.js | ddd/backend/src/exports/exportsService.js | Export reuses report semantics for permissions and date boundaries. |
| Validation | ddd/backend/src/validation/validate.js | domain *Validation.js files | express-validator errors are normalized into one response shape. |

## 20 Likely Reviewer Questions and Short Answers

1. What are your core architectural layers?
- React UI -> frontend API wrappers -> Express routes -> validation/auth middleware -> services -> repositories -> PostgreSQL.

2. Where is authentication enforced?
- In backend auth middleware that verifies JWT and validates required claims before protected handlers run.

3. Where is authorization enforced?
- Primarily at route level with role checks, plus service-level checks for interaction revision permissions.

4. How do you prevent cross-organization data leaks?
- req.auth.organizationId is propagated from verified JWT and every domain query applies organization_id filters.

5. Why is frontend-only authorization insufficient?
- Frontend can be bypassed; backend must remain the enforcement boundary.

6. What is in the JWT?
- subject userId, organizationId, and role, with expiration from environment config.

7. How are expired/invalid tokens handled?
- Backend returns unauthenticated errors; frontend centralized handler clears session and route guards redirect.

8. Why use immutable interaction snapshots?
- They preserve audit history while still allowing efficient current-state reads.

9. How do you enforce one current snapshot per group?
- Repository flow clears the old current row and inserts a new one as current; schema constraints back this model.

10. How do you avoid duplicate interaction creation from retries?
- Optional clientRequestId idempotency logic allows safe retry without duplicate snapshots.

11. Why are map markers not all properties?
- Marker feed intentionally represents actionable current interaction state, not every known property record.

12. How do you prevent duplicate properties from geocoding?
- Resolved address is normalized and checked before insert; existing property is reused within org.

13. How is rep_visibility applied?
- own/team/organization rules are encoded in SQL filters across map, property interaction reads, reports, and exports.

14. Why can manager/admin run reports but reps cannot?
- Reports aggregate cross-user activity and are restricted to elevated roles by policy.

15. How do date filters work for reports?
- dateFrom/dateTo are interpreted as local calendar days in the org timezone, then converted to UTC boundaries.

16. Why can the same date produce different UTC windows?
- Timezone offsets and DST shift the corresponding UTC instants for the same local day.

17. How do you guarantee report/export consistency?
- Export path reuses the same visibility and date-window semantics as reports.

18. How do you handle request validation consistently?
- Domain validators are centralized through one validate middleware that emits a uniform error envelope.

19. How do you reduce SQL injection risk?
- Queries are parameterized in repositories; values are never interpolated directly into SQL strings.

20. What are your strongest behavior-proof tests?
- Auth recovery, org isolation, interactions phase-3 snapshot tests, report timezone tests, and report/export e2e coverage.

## Implementation-Accurate Caveats to Mention Proactively

- Current app is JavaScript, not TypeScript.
- Current data access is pg SQL repositories, not Prisma.
- Some older docs still reference prior assumptions; code reflects the implemented decisions.

Primary context docs:

- docs/implementation/foundation/project-foundation-spec.md
- docs/Architecture_Decision_Record.md
- docs/api_endpoints.md

## 60-Second Pre-Review Drill

Before entering review, confirm you can quickly show:

1. Router and ProtectedRoute
- ddd/frontend/src/app/router.jsx
- ddd/frontend/src/auth/ProtectedRoute.jsx

2. Auth boundary and req.auth
- ddd/backend/src/middleware/authMiddleware.js

3. One route -> service -> repository chain
- ddd/backend/src/reports/reportsRoutes.js
- ddd/backend/src/reports/reportsService.js
- ddd/backend/src/reports/reportsRepository.js

4. Interaction snapshot immutability
- ddd/backend/src/interactions/interactionsService.js
- ddd/backend/src/interactions/interactionsRepository.js

5. Date-range conversion correctness evidence
- ddd/backend/src/reports/reportDateRange.js
- ddd/backend/tests/unit/report-date-range.test.js
