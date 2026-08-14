# 1. Ticket Information

GitHub Issue: #8

Title: US-008 - Update User

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

Implement this user story according to the finalized MVP source of truth and corrected GitHub issue requirements.

# 4. Scope

## 4.1 Included

- Implement behavior described in the corrected GitHub issue and finalized master spec.
- Enforce organization isolation, authorization, and API/schema contract consistency for this story.
- Add/update tests required to verify acceptance criteria and prevent regressions.

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

Endpoint implications from GitHub issue:

- See issue and docs/api_endpoints.md.

Final contract must align with docs/api_endpoints.md.

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

## Acceptance Criteria Status

- [x] Authorized users can update permitted user fields.
- [x] Name can be updated.
- [x] Role can be updated when authorized.
- [x] User cannot be moved between organizations.
- [x] Unauthorized users cannot modify other users.

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

- Documentation discrepancy noted:
  `docs/api_endpoints.md` and Issue #8 define Manager/Admin authorization for
  `PATCH /api/users/:id`, while ADR/wireframe language can be read as
  administrator-centric for user management.
- Applied resolution for this ticket: implement API contract and issue/user-story
  intent (Manager/Admin update authorization) without ADR redesign.

# 22. Copilot Implementation Notes

- Follow source-of-truth hierarchy in .github/copilot-instructions.md.
- Keep implementation constrained to this story.
- Preserve locked MVP rules from docs/MASTER_PROJECT_SPEC.md.
- Raise contradictions before coding.

# 23. Completion Report Template

Implemented

- Added `PATCH /api/users/:id` endpoint for user updates in the existing
  users route -> validation -> service -> repository architecture.
- Enforced manager/admin authorization and representative-forbidden behavior.
- Enforced organization isolation by scoping update lookup to authenticated
  `organizationId` from JWT context.
- Implemented permitted update fields: `firstName`, `lastName`, `role`.
- Rejected protected fields (email, password, activation, organization ownership,
  and other unsupported fields) with validation errors.
- Returned not-found behavior for inaccessible/nonexistent user IDs.
- Preserved sensitive-field protections in responses (no `password_hash`).
- Added frontend user-edit flow on `/settings/users` with saving/success/error
  states and role-gated UI.

Files Changed

- ddd/backend/src/users/usersValidation.js
- ddd/backend/src/users/usersRoutes.js
- ddd/backend/src/users/usersService.js
- ddd/backend/src/users/usersRepository.js
- ddd/backend/tests/integration/users-update.test.js
- ddd/frontend/src/api/usersApi.js
- ddd/frontend/src/pages/UsersPage.jsx
- ddd/frontend/src/tests/users-page.test.jsx
- docs/implementation/tickets/US-008-update-user.md

Tests Added

- Backend integration: ddd/backend/tests/integration/users-update.test.js
- Frontend coverage updates in: ddd/frontend/src/tests/users-page.test.jsx

Tests Run

`npm test --prefix ddd/backend -- users-update.test.js`

`npm test --prefix ddd/frontend -- users-page.test.jsx`

`npm run test:integration --prefix ddd/backend`

`npm test`

`npm run lint`

`npm run build`

`npm run test:e2e`

`git diff --check`

Result:

PASS

Manual QA Required

- Log in as manager; open `/settings/users`; edit another same-org user name and
  role; verify success message and updated list row.
- Log in as admin; repeat update flow for another same-org user.
- Log in as representative; verify user-management UI remains non-authorized.
- Attempt unsupported update payload fields (email/password/organizationId/
  isActive) and confirm API validation errors.
- Attempt cross-organization user ID update and confirm not-found response.

Documentation Updated

- Updated this ticket with implemented behavior, discrepancy resolution, and
  validation evidence.

Known Limitations

- This story intentionally does not support:
  - email changes,
  - password changes,
  - activation/deactivation,
  - organization reassignment,
  - team membership updates.
- Deactivation remains in US-009 via `PATCH /api/users/:id/active`.

Remaining Issues

- None within US-008 scope.
