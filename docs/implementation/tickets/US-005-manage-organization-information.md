# 1. Ticket Information

GitHub Issue: #5

Title: US-005 - Manage Organization Information

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

Implement organization information management for MVP by allowing authenticated manager/admin read access and admin-only organization-name updates within the authenticated organization boundary.

# 4. Scope

## 4.1 Included

- Implement `GET /api/organization` for manager/admin read access.
- Implement `PATCH /api/organization` for admin-only organization-name updates.
- Enforce role authorization and organization isolation using authenticated JWT context.
- Add backend integration tests and frontend tests for happy/error/authorization paths.

## 4.2 Explicitly Not Included

- Deferred/Post-MVP functionality not explicitly included in this story.
- Unrelated feature implementation outside this story scope.
- Unapproved architecture/schema/API redesign.

# 5. Existing Architecture

Relevant architecture constraints for this story:

- Use `docs/MASTER_PROJECT_SPEC.md` as authoritative behavior source.
- Enforce organization isolation for all organization-owned resources.

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

Implemented endpoints:

- `GET /api/organization`
- `PATCH /api/organization`

Behavior:

- Authentication required for both endpoints.
- Organization identity is derived from validated JWT claims, never from client input.
- `GET /api/organization` allows `manager` and `admin` roles.
- `PATCH /api/organization` allows `admin` role only.
- `PATCH /api/organization` accepts `{ "name": "..." }` and validates string, trimmed, non-empty, max length 255.
- Errors follow the shared envelope (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`).

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

- Added backend organization module with route -> validation -> service -> repository flow for organization retrieval and update.
- Added role-based authorization guard for manager/admin read and admin-only update.
- Added frontend organization API client and settings page for viewing organization information and admin updates.
- Added frontend route `/settings` behind existing protected-route guard.
- Added backend integration and frontend test coverage for US-005 behavior.

Files Changed

- ddd/backend/src/app.js
- ddd/backend/src/routes/apiRoutes.js
- ddd/backend/src/organization/organizationRepository.js
- ddd/backend/src/organization/organizationRoutes.js
- ddd/backend/src/organization/organizationService.js
- ddd/backend/src/organization/organizationValidation.js
- ddd/backend/tests/integration/organization.test.js
- ddd/frontend/src/api/organizationApi.js
- ddd/frontend/src/app/router.jsx
- ddd/frontend/src/pages/SettingsPage.jsx
- ddd/frontend/src/tests/settings-page.test.jsx

Tests Added

- ddd/backend/tests/integration/organization.test.js
- ddd/frontend/src/tests/settings-page.test.jsx

Tests Run

- npm run test --prefix ddd/backend -- tests/integration/organization.test.js
- npm run test --prefix ddd/frontend -- src/tests/settings-page.test.jsx
- npm run test:integration --prefix ddd/backend
- npm test
- npm run lint
- npm run build
- npm run test:e2e

Result:

PASS

Manual QA Required

- Log in as admin and navigate to /settings.
- Verify organization name loads and can be updated.
- Log in as manager and verify organization data loads but update controls are unavailable.
- Verify logout/login preserves expected access behavior and organization name updates are reflected.

Documentation Updated

- None required unless approved contracts change

Known Limitations

- This story does not implement organization settings updates (`rep_visibility`, `timezone`); those remain scoped to separate settings endpoints/stories.

Remaining Issues

- None identified within US-005 scope.
