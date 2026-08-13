# 1. Ticket Information

GitHub Issue: #39

Title: US-039 Î“Ã‡Ã¶ View Activity by Representative

Status: Planned

Priority: P2

MVP: Yes

Dependencies:

- #46 foundation scaffold and test harness.
- Practical dependency on authentication flow readiness (#1/#2/#3).
- Practical dependency on property/interaction domain readiness (#23/#26/#28/#29 as applicable).

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
- Preserve immutable interaction snapshot model with current-state retrieval semantics.
- Preserve locked interaction semantics: `interaction_group_id` relationship identity, stable `initial_interaction_at`, and revision `changed_at` behavior.
- Preserve reporting/export timezone model: UTC storage plus organization-timezone interpretation.

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

- interactions
- properties
- users
- teams
- statuses

# 7. API Contract

Endpoint implications from GitHub issue:

- GET /api/reports/activity

Final contract must align with docs/api_endpoints.md.

# 8. Data Flow

1. Frontend/user action triggers story workflow.
2. API request(s) execute within authenticated org context where protected.
3. Backend validates, authorizes, applies business rules, and persists/retrieves state.
4. API response updates client state.
5. UI renders finalized MVP behavior.

# 9. Business Rules

- Do not introduce behavior that conflicts with the finalized MVP scope or deferred boundaries.
- Revisions do not create additional knocks; snapshot count is not knock count.
- MVP does not rely on an `interaction_at` field.
- `dateFrom`/`dateTo` are inclusive organization-local calendar dates converted to UTC query boundaries.

# 10. Security Requirements

- Validate all external input on the backend boundary.
- Do not trust client-supplied organization ownership identifiers.
- Preserve no-delete/deactivation semantics where applicable.
- Preserve UTC storage and organization-timezone interpretation for reporting/export date semantics.

# 11. Error Handling

| Condition                     | Expected Behavior                                    |
| ----------------------------- | ---------------------------------------------------- |
| Validation failure            | Consistent 400-style validation error behavior       |
| Missing/invalid auth          | Protected endpoints reject unauthorized access       |
| Cross-organization access     | Deny access per organization isolation               |
| Unexpected backend failure    | Controlled error response without partial corruption |

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
- Practical dependency on property/interaction domain readiness (#23/#26/#28/#29 as applicable).

## Required Architecture

- ADR-008: Immutable Interaction Snapshots With Controlled Current-State Flag
- ADR-009: Current State Is Derived From the Latest Accessible Snapshot
- Organization isolation is defined by API/schema contracts (`docs/api_endpoints.md`, `docs/table_Schema_decisions.md`).

## Required API

- GET /api/reports/activity

## Required Database

- interactions
- properties
- users
- teams
- statuses

## Required Frontend

- Story-specific UI workflow integration where applicable.

# 17. Implementation Constraints

- Do not introduce delete behavior unless explicitly documented (MVP generally uses deactivation/no-delete semantics).
- Do not trust client-supplied organization ownership identifiers.
- Do not introduce unapproved schema/API/architecture changes.
- Preserve deferred/post-MVP boundaries.

# 18. Definition of Done

- [ ] Acceptance criteria are implemented and verified.
- [ ] Report output follows finalized representative/group counting rules.
- [ ] Automated tests are added or updated where appropriate.

- [ ] Behavior aligns with docs/MASTER_PROJECT_SPEC.md.
- [ ] Organization isolation and authorization requirements are verified.
- [ ] No unrelated scope changes introduced.

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

- [to be filled during implementation]

Files Changed

- [to be filled during implementation]

Tests Added

- [to be filled during implementation]

Tests Run

npm test

Result:

PASS / FAIL

Manual QA Required

- [to be filled during implementation]

Documentation Updated

- None required unless approved contracts change

Known Limitations

- [to be filled during implementation]

Remaining Issues

- [to be filled during implementation]
