# 1. Ticket Information

GitHub Issue: #4

Title: US-004 - View Current User

Status: Completed

Priority: P1

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

Deliver authenticated current-user retrieval for MVP via a protected `GET /api/me` endpoint and profile page integration, enforcing JWT-derived identity and organization isolation.

# 4. Scope

## 4.1 Included

- Backend `GET /api/me` endpoint protected by auth middleware.
- Service/repository logic for organization-scoped current-user lookup by authenticated claims.
- Frontend profile page data fetch/render for current authenticated user.
- Integration and frontend test coverage for success and failure paths.

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

- See issue and schema docs for table scope.

# 7. API Contract

Implemented endpoint:

- `GET /api/me`

Behavior:

- Requires valid bearer JWT.
- Uses server-validated JWT claims (`sub`, `organizationId`) as sole identity source.
- Ignores client-supplied identity overrides.
- Returns current-user profile fields for authenticated user.
- Returns `401 UNAUTHENTICATED` for missing/invalid/expired token, nonexistent user, or org mismatch.
- Returns `403 FORBIDDEN` for inactive user.

# 8. Data Flow

1. Frontend/user action triggers story workflow.
2. API request(s) execute within authenticated org context where protected.
3. Backend validates, authorizes, applies business rules, and persists/retrieves state.
4. API response updates client state.
5. UI renders finalized MVP behavior.

# 9. Business Rules

- Do not introduce behavior that conflicts with the finalized MVP scope or deferred boundaries.

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

- See master spec and architecture docs.

## Required API

- See issue and docs/api_endpoints.md.

## Required Database

- See issue and schema docs for table scope.

## Required Frontend

- Story-specific UI workflow integration where applicable.

# 17. Implementation Constraints

- Do not introduce delete behavior unless explicitly documented (MVP generally uses deactivation/no-delete semantics).
- Do not trust client-supplied organization ownership identifiers.
- Do not introduce unapproved schema/API/architecture changes.
- Preserve deferred/post-MVP boundaries.

# 18. Definition of Done

- [x] Acceptance criteria implemented and verified.

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

- Added protected backend endpoint `GET /api/me` in API router.
- Added auth service method for current-user retrieval with org-scoped lookup.
- Added auth repository query for `userId + organizationId` lookup.
- Added frontend API client method `getCurrentUser()`.
- Replaced placeholder profile page with API-backed loading/success/error rendering.
- Added backend integration test suite for `GET /api/me` happy/error/isolation scenarios.
- Added frontend tests for profile-page success and API-failure rendering.
- Stabilized backend integration execution by disabling Vitest file parallelism due shared DB reset races.

Files Changed

- ddd/backend/src/auth/authRepository.js
- ddd/backend/src/auth/authService.js
- ddd/backend/src/routes/apiRoutes.js
- ddd/backend/tests/integration/current-user.test.js
- ddd/backend/vitest.config.js
- ddd/frontend/src/api/authApi.js
- ddd/frontend/src/pages/ProfilePage.jsx
- ddd/frontend/src/tests/profile-page.test.jsx

Tests Added

- ddd/backend/tests/integration/current-user.test.js
- ddd/frontend/src/tests/profile-page.test.jsx

Tests Run

- npm run test --prefix ddd/backend -- tests/integration/current-user.test.js
- npm run test --prefix ddd/frontend -- src/tests/profile-page.test.jsx
- npm run test:integration --prefix ddd/backend
- npm test
- npm run lint
- npm run build
- npm run test:e2e

Result:

PASS

Manual QA Required

- Verify authenticated profile page displays current user in browser session.
- Verify unauthenticated navigation to profile path results in login flow.

Documentation Updated

- None required unless approved contracts change

Known Limitations

- `teams` is currently returned as an empty array placeholder pending team-management story implementation.

Remaining Issues

- None identified for US-004 scope.
