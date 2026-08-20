# 1. Ticket Information

GitHub Issue: #39

Title: US-039 - View Activity by Representative

Status: Planned

Priority: P2

MVP: Yes

Implementation Phase: Phase 5 - Activity Reporting

Dependencies:

- #37 view activity report.
- #10-#13 team membership foundation.

Related Documentation:

- docs/MASTER_PROJECT_SPEC.md
- docs/Architecture_Decision_Record.md
- docs/api_endpoints.md
- docs/table_Schema_decisions.md
- docs/testing/testing-strategy.md
- docs/testing/test-matrix.md
- .github/copilot-instructions.md

# 2. User Story

As a manager,
I want to see activity by representative,
so that I can understand team activity.

# 3. Objective

Deliver the approved user-story outcome for Issue #39 with endpoint, authorization, and data behavior aligned to the finalized MVP architecture. The completed implementation should satisfy the acceptance criteria without expanding scope beyond this story.

# 4. Scope

## 4.1 Included

- Report can group interactions by representative.
- Manager can filter by team.
- Counts use finalized interaction-group knock rules.
- Snapshot revisions in an existing interaction group are not counted as additional knocks.
- Stored timestamps remain UTC.
- Organization timezone is used to interpret report date ranges.
- `dateFrom` and `dateTo` are inclusive organization-local calendar dates.
- Report boundaries are converted using the organization's timezone before querying UTC timestamps.
- Results respect organization isolation and visibility rules.

## 4.2 Explicitly Not Included

- Changes to unrelated endpoints, tables, or user workflows outside this story.
- Post-MVP functionality not explicitly included in this issue.
- Unapproved schema, API, or architecture redesign.

# 5. Existing Architecture

- Node.js + Express backend with middleware/service/repository layering.
- PostgreSQL schema and constraints defined in docs/table_Schema_decisions.md.
- JWT-derived organization context for protected-resource ownership.
- Source-of-truth role and visibility rules from docs/MASTER_PROJECT_SPEC.md and docs/api_endpoints.md.
- Relevant ADRs:
- ADR-008: Immutable Interaction Snapshots With Controlled Current-State Flag
- ADR-009: Current State Is Derived From the Latest Accessible Snapshot
- Organization isolation is defined by API/schema contracts (`docs/api_endpoints.md`, `docs/table_Schema_decisions.md`).

# 6. Technical Design

## 6.1 Backend

- Implement or align route, validation, service, and repository behavior for the in-scope endpoint(s).
- Enforce authorization and organization isolation for every resource lookup.
- Apply request validation and return standardized API error envelopes.
- Preserve MVP no-delete and historical-integrity behavior where applicable.

## 6.2 Frontend

- Implement story-specific workflow UI and API client integration.
- Provide loading, success, and error feedback in the user flow.
- Preserve role-aware behavior for visible actions and responses.

## 6.3 Database

- interactions
- properties
- users
- teams
- statuses

- Use existing documented constraints and relationships; do not introduce unapproved schema changes.

# 7. API Contract

- GET /api/reports/activity

Authentication, authorization, request payload validation, and response/error behavior must match docs/api_endpoints.md for each listed endpoint.

# 8. Data Flow

1. User executes the in-scope workflow action.
2. Frontend invokes the relevant API endpoint(s) where applicable.
3. Backend validates/authenticates/authorizes and applies organization scope.
4. Backend reads/writes approved tables and returns contract response.
5. Frontend renders resulting state and user feedback.

# 9. Business Rules

- Report can group interactions by representative.
- Manager can filter by team.
- Counts use finalized interaction-group knock rules.
- Snapshot revisions in an existing interaction group are not counted as additional knocks.
- Stored timestamps remain UTC.
- Organization timezone is used to interpret report date ranges.
- `dateFrom` and `dateTo` are inclusive organization-local calendar dates.
- Report boundaries are converted using the organization's timezone before querying UTC timestamps.
- Results respect organization isolation and visibility rules.

- Organization isolation always applies.
- Role permissions and visibility behavior follow finalized MVP rules.

# 10. Security Requirements

- Enforce authentication and authorization according to endpoint contract.
- Enforce organization isolation using server-derived organization context.
- Do not expose sensitive/internal fields beyond approved response contract.
- Validate request input at backend boundary.

# 11. Error Handling

| Condition                  | Expected Behavior                                           |
| -------------------------- | ----------------------------------------------------------- |
| Validation failure         | 400 validation error envelope with actionable detail.       |
| Missing/invalid auth       | 401 unauthenticated error envelope for protected endpoints. |
| Unauthorized role          | 403 forbidden error envelope.                               |
| Cross-organization access  | Denied per contract (not-found/forbidden as documented).    |
| Unexpected backend failure | 500 internal error envelope without sensitive leakage.      |

# 12. Test Requirements

## Existing Tests

- TEST-084 Representative Grouping
- TEST-085 Revision Does Not Double Count
- TEST-086 Organization Reporting Isolation

## Unit Tests

- Validate in-scope business-rule and permission branch behavior.

## Integration/API Tests

- Validate happy path, validation failures, authorization failures, and organization isolation.

## Frontend Tests

- Validate workflow rendering, loading states, error states, and role-aware UI behavior.

## End-to-End Tests

- Extend critical workflow coverage if this story changes end-to-end behavior.

# 13. Test Scenarios

## Scenario 1 - Happy Path

Given authorized context and valid input,
when the workflow is executed,
then behavior matches acceptance criteria.

## Scenario 2 - Validation Failure

Given invalid input,
when the request is submitted,
then validation fails safely with no invalid persistence.

## Scenario 3 - Unauthorized/Forbidden

Given missing auth or insufficient role,
when protected behavior is attempted,
then access is denied per contract.

## Scenario 4 - Organization Isolation

Given a cross-organization resource ID,
when access is attempted,
then cross-organization access is denied.

# 14. Implementation Sequence

1. Confirm endpoint, schema, and role requirements in source-of-truth docs.
2. Implement backend behavior for in-scope endpoint(s).
3. Implement frontend workflow behavior and API client updates.
4. Add/extend tests mapped to acceptance criteria.
5. Validate behavior against test-matrix and source-of-truth docs.

# 15. Expected Files

## Expected Modified Files

- ddd/backend/src/<domain>/\*
- ddd/frontend/src/pages/<feature>\*.jsx
- ddd/frontend/src/api/\*
- ddd/backend/tests/integration/\*
- ddd/frontend/src/tests/\*

## Potential New Files

- ddd/backend/src/<domain>/<feature>.js
- ddd/frontend/src/pages/<feature>Page.jsx
- ddd/backend/tests/integration/<feature>.test.js
- ddd/frontend/src/tests/<feature>.test.jsx

# 16. Dependencies

## Required Previous Tickets

- #37 view activity report.
- #10-#13 team membership foundation.

## Phase Dependency

- Phase 1 access policy completion (#34, #35, #36).
- Phase 3 interaction snapshot core (#29, #31, #32, #48).

## Required Architecture

- Source-of-truth behavior in docs/MASTER_PROJECT_SPEC.md and relevant ADRs.

## Required API

- Endpoint(s) listed in Section 7.

## Required Database

- Tables/constraints listed in Section 6.3.

## Required Frontend

- Workflow behavior listed in Section 6.2.

# 17. Implementation Constraints

- Do not add unapproved schema/API/architecture changes.
- Do not trust client-supplied organization ownership identifiers.
- Preserve MVP no-delete/historical-integrity rules where applicable.
- Keep scope limited to this issue's acceptance criteria.

# 18. Definition of Done

Functionality

- [ ] Acceptance criteria implemented and verified.
- [ ] Out-of-scope functionality not introduced.

Architecture

- [ ] Behavior matches docs/api_endpoints.md and docs/table_Schema_decisions.md.
- [ ] ADR constraints are respected.

Security

- [ ] Authentication, authorization, and organization isolation enforced for affected behavior.

Testing

- [ ] Relevant automated tests added/updated and passing.

Documentation

- [ ] GitHub issue and repository ticket remain aligned.

Review/Scope

- [ ] No unrelated files or features included.

# 19. Manual QA

- Execute authorized happy path end-to-end.
- Execute invalid-input flow and verify error messaging.
- Execute unauthorized role flow.
- Execute cross-organization access attempt.

# 20. Known Risks

Risk:

- Contract drift between implementation and documented endpoint behavior.

Impact:

- Security/behavior regressions and inconsistent UX.

Mitigation:

- Enforce endpoint contract checks and automated regression tests.

Risk:

- Scope creep into adjacent stories.

Impact:

- Delivery delays and increased defect surface.

Mitigation:

- Keep implementation and testing constrained to accepted story scope.

# 21. Open Questions / Blocking Decisions

- No blocking decisions identified from current source-of-truth docs.
- If contradictions arise during implementation, stop and escalate.

# 22. Copilot Implementation Notes

- Follow .github/copilot-instructions.md hierarchy.
- Keep scope strictly to this issue.
- Add tests with implementation; do not defer test coverage.

# 23. Completion Report Template

Implemented

- Summarize implemented behavior for this ticket.

Files Changed

- List modified files.

Tests Added/Updated

- List added/updated test coverage.

Tests Run

- List executed validation commands.

Result

- PASS / FAIL.

Manual QA Completed

- List executed manual QA checks and outcomes.

Documentation Updated

- Confirm issue body and repository ticket alignment.

Known Limitations

- List approved limitations remaining.

Remaining Issues

- List follow-up issues if any.
