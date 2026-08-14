# 1. Ticket Information

GitHub Issue: #6

Title: US-006 - Create User

Status: Completed

Priority: P0

MVP: Yes

Dependencies:

- #46 foundation scaffold and test harness.
- Practical dependency on authentication flow readiness (#1/#2/#3).

Related Documentation:

- docs/MASTER_PROJECT_SPEC.md
- docs/Architecture_Decision_Record.md
- docs/api_endpoints.md
- docs/table_Schema_decisions.md
- docs/testing/testing-strategy.md
- docs/testing/test-matrix.md
- .github/copilot-instructions.md

# 2. User Story

Use the GitHub issue body as the approved user-story intent.

# 3. Objective

Implement organization-scoped user creation for MVP through `POST /api/users` with manager/admin authorization, secure password hashing, server-derived organization ownership, and safe response fields.

# 4. Scope

## 4.1 Included

- Implement backend `POST /api/users` endpoint using existing route -> validation -> service -> repository architecture.
- Enforce manager/admin authorization and authenticated organization scoping.
- Hash passwords using existing Argon2id utility and persist new users as active by default.
- Return only non-sensitive user fields (never password hash).
- Add frontend user-creation workflow at `/settings/users` and associated tests.
- Add backend integration tests covering authorization, validation, uniqueness, and organization isolation.

## 4.2 Explicitly Not Included

- Deferred/Post-MVP functionality not explicitly included in this story.
- Unrelated feature implementation outside this story scope.
- Unapproved architecture/schema/API redesign.

# 5. Existing Architecture

Relevant architecture constraints for this story:

- Use `docs/MASTER_PROJECT_SPEC.md` as authoritative behavior source.
- Enforce organization isolation for all organization-owned resources.
- Apply JWT-authenticated organization context for protected endpoints; never trust client-supplied organization ownership identifiers.

# 6. Technical Design

## 6.1 Backend

- Implement endpoint/service/repository behavior needed for this story per API contract and master spec.
- Enforce backend authorization and organization isolation checks.
- Preserve immutable/historical data semantics where applicable.

## 6.2 Frontend

- Implement only story-required UI/workflow behavior.
- Preserve map-first workflow and finalized MVP scope constraints where applicable.
- Handle loading, error, and validation feedback paths.

## 6.3 Database

Tables implicated by GitHub issue:

- users

# 7. API Contract

Implemented endpoint:

- `POST /api/users`

Behavior:

- Authentication required.
- Authorization: `manager` and `admin` allowed; `rep` denied.
- Organization ownership comes from authenticated JWT context and cannot be selected by client payload.
- Request fields: `firstName`, `lastName`, `email`, `password`, `role`.
- `role` accepted values: `admin`, `manager`, `rep`.
- New users are created with `isActive = true`.
- Duplicate email in same organization returns `409 CONFLICT`.
- Same email across different organizations is allowed.
- Response excludes password hash and returns safe public fields.

# 8. Data Flow

1. Frontend/user action triggers story workflow.
2. API request(s) execute within authenticated org context where protected.
3. Backend validates, authorizes, applies business rules, and persists/retrieves state.
4. API response updates client state.
5. UI renders finalized MVP behavior.

# 9. Business Rules

- Do not introduce behavior that conflicts with the finalized MVP scope or deferred boundaries.
- Email uniqueness is organization-scoped; the same email may exist in different organizations.

# 10. Security Requirements

- Validate all external input on the backend boundary.
- Do not trust client-supplied organization ownership identifiers.
- Preserve no-delete/deactivation semantics where applicable.

# 11. Error Handling

| Condition                  | Expected Behavior                                    |
| -------------------------- | ---------------------------------------------------- |
| Validation failure         | Consistent 400-style validation error behavior       |
| Missing/invalid auth       | Protected endpoints reject unauthorized access       |
| Cross-organization access  | Deny access per organization isolation               |
| Unexpected backend failure | Controlled error response without partial corruption |

# 12. Test Requirements

## Existing Tests

- Align with relevant entries in docs/testing/test-matrix.md.

## New Tests

- Add targeted tests required to prove this story's acceptance criteria.

## Unit Tests

- Validate core business logic branches and authorization gates.

## Integration/API Tests

- Validate endpoint behavior, org isolation, and persistence side effects.

## Frontend Tests

- Validate story workflow, validation, and error rendering.

## End-to-End Tests

- Add/extend scenario coverage where this story impacts critical workflow.

# 13. Test Scenarios

## Scenario 1 - Happy Path

Given valid input and authorized context,
when story workflow is executed,
then expected behavior is produced according to acceptance criteria.

## Scenario 2 - Validation Failure

Given invalid input,
when request/action is attempted,
then validation is rejected with safe, consistent error behavior.

## Scenario 3 - Unauthorized/Forbidden

Given missing or unauthorized context,
when protected behavior is attempted,
then access is denied according to finalized authorization rules.

## Scenario 4 - Organization Isolation

Given cross-organization resource identifiers,
when access is attempted,
then cross-organization access is denied.

# 14. Implementation Sequence

1. Confirm dependency readiness and existing contracts.
2. Implement backend/frontend behavior required by scope.
3. Implement authorization/isolation and business-rule checks.
4. Add/extend tests for acceptance criteria and regression protection.
5. Validate against docs/MASTER_PROJECT_SPEC.md and API/schema docs.

# 15. Expected Files

Repository currently has partial/no app scaffold assumptions depending on ticket sequence.

## Expected New Files

- Determined by implementation phase and scaffold maturity.

## Expected Modified Files

- Determined by story scope in backend/frontend layers.

## Potential Files

- Tests and shared validation/util modules required by story behavior.

# 16. Dependencies

## Required Previous Tickets

- #46 foundation scaffold and test harness.
- Practical dependency on authentication flow readiness (#1/#2/#3).

## Required Architecture

- ADR-004: PostgreSQL Relational Database
- ADR-006: Roles Control Access, Not Field Capability
- Organization isolation is defined by API/schema contracts (`docs/api_endpoints.md`, `docs/table_Schema_decisions.md`).

## Required API

- POST /api/users

## Required Database

- users

## Required Frontend

- Story-specific UI workflow integration where applicable.

# 17. Implementation Constraints

- Do not introduce delete behavior unless explicitly documented (MVP generally uses deactivation/no-delete semantics).
- Do not trust client-supplied organization ownership identifiers.
- Do not introduce unapproved schema/API/architecture changes.
- Preserve deferred/post-MVP boundaries.

# 18. Definition of Done

- [x] Acceptance criteria are implemented and verified.
- [x] Frontend behavior is validated for the intended field workflow and error states.
- [x] API behavior matches the documented contract and authorization rules.
- [x] Persistence changes align with the documented MVP schema and preserve historical integrity.
- [x] Automated tests are added or updated where appropriate for the changed behavior.

- [x] Behavior aligns with docs/MASTER_PROJECT_SPEC.md.
- [x] Organization isolation and authorization requirements are verified.
- [x] No unrelated scope changes introduced.

# 19. Manual QA

- Execute representative happy-path workflow.
- Execute negative validation path.
- Execute unauthorized/cross-org access checks.
- Verify behavior against finalized MVP expectations in master spec.

# 20. Known Risks

Risk:

- Scope drift away from finalized MVP behavior.

Impact:

- Implementation inconsistency across API/UI/data layers.

Mitigation:

- Enforce source-of-truth hierarchy and test coverage mapped to acceptance criteria.

# 21. Open Questions / Blocking Decisions

- No new product/architecture decisions are introduced by this ticket.
- If contradiction with source-of-truth docs is discovered during implementation, stop and escalate.

# 22. Copilot Implementation Notes

- Follow source-of-truth hierarchy in .github/copilot-instructions.md.
- Keep implementation constrained to this story.
- Preserve locked MVP rules from docs/MASTER_PROJECT_SPEC.md.
- Raise contradictions before coding.

# 23. Completion Report Template

Implemented

- Added backend users module for `POST /api/users`:
  - `usersRoutes` for endpoint + role guard + validation wiring.
  - `usersValidation` for request-shape rules.
  - `usersService` for organization-scoped creation, hashing, and conflict mapping.
  - `usersRepository` for users table insert.
- Wired `/api/users` into API routing behind existing auth middleware.
- Added frontend API client `createUser()`.
- Added protected frontend page `/settings/users` with create-user form, loading/submission states, and error/success feedback.
- Added backend integration tests and frontend tests for US-006 acceptance criteria.

Files Changed

- ddd/backend/src/app.js
- ddd/backend/src/routes/apiRoutes.js
- ddd/backend/src/users/usersRepository.js
- ddd/backend/src/users/usersRoutes.js
- ddd/backend/src/users/usersService.js
- ddd/backend/src/users/usersValidation.js
- ddd/backend/tests/integration/users-create.test.js
- ddd/frontend/src/api/usersApi.js
- ddd/frontend/src/app/router.jsx
- ddd/frontend/src/pages/UsersPage.jsx
- ddd/frontend/src/tests/users-page.test.jsx

Tests Added

- ddd/backend/tests/integration/users-create.test.js
- ddd/frontend/src/tests/users-page.test.jsx

Tests Run

- npm run test --prefix ddd/backend -- tests/integration/users-create.test.js
- npm run test --prefix ddd/frontend -- src/tests/users-page.test.jsx
- npm run test:integration --prefix ddd/backend
- npm test
- npm run lint
- npm run build
- npm run test:e2e

Result:

PASS

Manual QA Required

- Log in as manager and create a representative user from `/settings/users`.
- Log in as admin and create a manager/admin user from `/settings/users`.
- Confirm duplicate email in same organization is rejected with error feedback.
- Confirm representative accounts cannot create users.
- Confirm created users can log in and are active by default.

Documentation Updated

- None required unless approved contracts change

Known Limitations

- This ticket only implements create-user behavior (`POST /api/users`) and does not implement user listing/editing/deactivation flows from later stories.

Remaining Issues

- None identified for US-006 scope.
