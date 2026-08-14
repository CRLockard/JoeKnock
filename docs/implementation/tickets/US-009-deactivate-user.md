# 1. Ticket Information

GitHub Issue: #9

Title: US-009 Î“Ã‡Ã¶ Deactivate User

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

- [x] Admin can deactivate users in their organization.
- [x] Managers/representatives cannot deactivate users.
- [x] Deactivation updates active state (no delete) and is reversible via same endpoint.
- [x] Cross-organization target IDs are inaccessible.
- [x] Deactivated users are blocked from login.

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

- No blocking contradictions remained after Phase 0 audit.
- Applied contract: implement `PATCH /api/users/:id/active` with admin-only access and boolean `isActive` payload per issue + API docs.
- Role-model redesign was explicitly deferred per user direction; no schema/architecture redesign introduced.

# 22. Copilot Implementation Notes

- Follow source-of-truth hierarchy in .github/copilot-instructions.md.
- Keep implementation constrained to this story.
- Preserve locked MVP rules from docs/MASTER_PROJECT_SPEC.md.
- Raise contradictions before coding.

# 23. Completion Report Template

Implemented

- Added `PATCH /api/users/:id/active` in users route -> validation -> service -> repository flow.
- Enforced admin-only authorization at route layer.
- Enforced organization isolation by scoping update to authenticated JWT organization context.
- Enforced strict payload contract: only `isActive` allowed, boolean required.
- Implemented idempotent deactivate/reactivate behavior using same endpoint.
- Preserved no-delete semantics (row remains, `is_active` toggles).
- Extended frontend users page with admin-only deactivate/reactivate controls, loading state, success, and error handling.
- Added backend and frontend tests for authorization, validation, isolation, persistence, and UX behavior.

Files Changed

- ddd/backend/src/users/usersValidation.js
- ddd/backend/src/users/usersRoutes.js
- ddd/backend/src/users/usersService.js
- ddd/backend/src/users/usersRepository.js
- ddd/backend/tests/integration/users-deactivate.test.js
- ddd/frontend/src/api/usersApi.js
- ddd/frontend/src/pages/UsersPage.jsx
- ddd/frontend/src/tests/users-page.test.jsx
- docs/implementation/tickets/US-009-deactivate-user.md

Tests Added

- Backend integration: ddd/backend/tests/integration/users-deactivate.test.js
- Frontend coverage additions in: ddd/frontend/src/tests/users-page.test.jsx

Tests Run

`npm run test:integration --prefix ddd/backend -- users-deactivate.test.js`

`npm test --prefix ddd/frontend -- src/tests/users-page.test.jsx`

`npm test`

`npm run lint`

`npm run build`

`npm run test:e2e`

`git diff --check`

Result:

PASS

Manual QA Required

- Log in as admin; open `/settings/users`; deactivate an active same-org user; verify row status changes to inactive and success message appears.
- Log in as admin; reactivate an inactive same-org user; verify row status and message update.
- Log in as manager; verify deactivate/reactivate buttons are not rendered.
- Attempt deactivation against cross-organization user ID; verify API returns not found.
- Attempt login for a deactivated user with valid credentials; verify forbidden response.

Documentation Updated

- Updated this ticket with implementation and validation evidence.

Known Limitations

- Endpoint currently permits admin self-deactivation because it is not explicitly prohibited in the approved API contract.
- No additional standalone e2e scenario was added beyond existing smoke suite for this ticket.

Remaining Issues

- None within US-009 scope.
