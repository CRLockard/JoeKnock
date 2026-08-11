# 1. Ticket Information

GitHub Issue: #3

Title: US-003 - Log Out

Status: Planned

Priority: P0

MVP: Yes

Dependencies:

- #2 for authenticated login flow and client auth-state handling
- Foundation work for backend/frontend scaffold and route wiring (no ticket currently scoped in backlog)

Related Documentation:

- docs/Architecture_Decision_Record.md
- docs/api_endpoints.md
- docs/table_Schema_decisions.md
- docs/testing/testing-strategy.md
- docs/testing/test-matrix.md
- .github/copilot-instructions.md

# 2. User Story

As a JoeKnock user,
I want to log out,
so that my account cannot be accessed from the current session.

# 3. Objective

Implement logout behavior that clears client authentication state and prevents access to protected application areas after logout, while keeping backend behavior consistent with stateless JWT MVP architecture.

# 4. Scope

## 4.1 Included

- Implement authenticated POST /api/auth/logout endpoint contract
- Return success confirmation response for logout request
- Clear client-side auth information on logout
- Redirect user to login screen after logout
- Ensure protected pages are inaccessible after logout

## 4.2 Explicitly Not Included

- Server-side token blacklist/revocation infrastructure
- Session store design
- Cross-device session management
- Account deactivation logic
- Any delete behavior

# 5. Existing Architecture

Relevant architectural decisions and impacts:

- API docs define logout as authenticated endpoint with no required database writes in MVP.
- Stateless JWT model in API docs means logout is primarily client auth-state removal.
- Organization isolation remains critical for protected endpoints; post-logout requests should fail without auth.
- No-delete MVP policy remains unchanged.

# 6. Technical Design

## 6.1 Backend

Components required (framework-agnostic):

- Auth route for POST /api/auth/logout
- Authentication middleware guard (endpoint requires auth)
- Controller handler that returns success message
- Consistent error response for unauthenticated requests

Behavior summary:

1. Require valid authentication.
2. If valid, return logout success response.
3. No database mutation required in MVP.

## 6.2 Frontend

- Logout action from authenticated UI
- Remove stored JWT/auth state from client storage/context
- Clear in-memory authenticated user context
- Navigate to login screen
- Ensure protected routes redirect/deny after logout

## 6.3 Database

No database table writes are required for MVP logout.

Reads/writes:

- None required by contract

No migration changes required.

# 7. API Contract

## Endpoint

POST /api/auth/logout

## Authentication

Required.

## Authorization

Any authenticated user may log out their current client session.

## Request

No body required.

## Response

{
"message": "Logged out successfully."
}

## Error Responses

Expected relevant statuses:

- 401 - Missing or invalid authentication
- 500 - Unexpected server error

# 8. Data Flow

Authenticated user clicks logout
-> frontend logout action
-> POST /api/auth/logout with auth token
-> auth middleware validates token
-> endpoint returns success message
-> frontend clears auth storage/context
-> frontend routes user to login
-> protected pages now blocked without auth

# 9. Business Rules

- User can trigger logout from authenticated session.
- Client auth information is removed on logout.
- Protected routes are inaccessible after logout.
- User is returned to login screen.
- Logout does not delete user/account/session records in MVP.

# 10. Security Requirements

- Endpoint must reject unauthenticated calls.
- Client-side token/state removal must be reliable.
- Post-logout route guards must prevent stale access.
- Do not expose sensitive authentication internals in logout response.

# 11. Error Handling

| Condition                     | Expected Behavior                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Missing required input        | Not applicable                                                                     |
| Invalid input                 | Not applicable                                                                     |
| Unauthenticated request       | 401 structured auth error                                                          |
| Unauthorized request          | Not applicable for valid authenticated users                                       |
| Resource not found            | Not applicable                                                                     |
| Duplicate/conflicting request | Idempotent-style success or consistent handled response for repeated logout action |
| Database failure              | Not applicable by default contract                                                 |
| External service failure      | Not applicable                                                                     |

# 12. Test Requirements

## Existing Tests

- TEST-011 Invalid Authentication Token (protected endpoint rejection)
- TEST-012 Missing Authentication (protected endpoint rejection)
- Manual QA matrix includes Login/logout UX checks

## New Tests

- TEST-092 (proposed) Valid Logout Returns Success
- TEST-093 (proposed) Logout Requires Authentication
- TEST-094 (proposed) Protected Routes Blocked After Logout

Planning-only identifiers. Do not edit test-matrix.md in this task.

## Unit Tests

- Frontend logout state-clear utility behavior
- Route guard transition behavior after logout state clear

## Integration/API Tests

- Authenticated logout request returns success message
- Missing/invalid token rejected

## Frontend Tests

- Logout action clears persisted auth storage/context
- User redirected to login after logout
- Protected route access after logout is denied/redirected

## End-to-End Tests

- Extend organization setup/representative workflow to include login -> logout -> protected route rejection

# 13. Test Scenarios

## Scenario 1 - Happy Path

Given:

- Authenticated user session exists

When:

- User triggers logout

Then:

- API returns logout success
- Client auth state is removed
- User is returned to login
- Protected pages are blocked

## Scenario 2 - Validation Failure

Given:

- Logout endpoint has no required body

When:

- Request body is absent

Then:

- Request is still valid if auth is present

## Scenario 3 - Unauthorized Access

Given:

- No token or invalid token

When:

- Client calls POST /api/auth/logout

Then:

- API rejects request with 401

## Scenario 4 - Organization Isolation

Given:

- User logged out from Organization A context

When:

- User attempts protected Organization A routes without auth

Then:

- Access is denied due to missing auth context

# 14. Implementation Sequence

1. Confirm auth middleware and protected route pattern from #2 implementation.
2. Implement POST /api/auth/logout backend handler.
3. Implement frontend logout action and auth-state clearing.
4. Implement navigation redirect to login.
5. Verify protected route behavior after logout.
6. Add API and frontend tests (existing + proposed IDs).
7. Run targeted tests, then npm test.

# 15. Expected Files

Repository currently has no application code scaffold in ddd.

## Expected New Files

- ddd/backend/src/auth/logout.route.[ext]
- ddd/backend/tests/integration/auth/logout.[ext]
- ddd/frontend/src/auth/logout-action.[ext]
- ddd/frontend/tests/auth/logout.[ext]

## Expected Modified Files

- ddd/backend/src/app.[ext] (auth route registration)
- ddd/frontend/src/auth/context.[ext] (clear auth state)
- ddd/frontend/src/routes/protected.[ext] (redirect behavior)
- ddd/frontend/src/layout/user-menu.[ext] (logout trigger)

## Potential Files

- ddd/frontend/src/navigation/router.[ext]

# 16. Dependencies

## Required Previous Tickets

- #2 (login/auth-state infrastructure)

## Required Architecture

- Stateless JWT logout behavior per docs/api_endpoints.md

## Required API

- POST /api/auth/logout

## Required Database

- None specific for logout endpoint

## Required Frontend

- Existing auth context/storage and protected-route handling

# 17. Implementation Constraints

- Do not add server-side session blacklist/revocation architecture.
- Do not introduce deletion behavior.
- Do not bypass auth middleware on logout endpoint.
- Do not add post-MVP session-management features.

# 18. Definition of Done

Functionality

- [ ] Logout endpoint implemented per contract.
- [ ] Acceptance criteria satisfied.
- [ ] Out-of-scope functionality not implemented.

Architecture

- [ ] Stateless JWT logout behavior preserved.
- [ ] API behavior matches docs/api_endpoints.md.
- [ ] No unapproved architecture introduced.

Security

- [ ] Unauthenticated logout attempts are rejected.
- [ ] Client auth state is reliably cleared.
- [ ] Protected routes are blocked after logout.

Testing

- [ ] TEST-011/012 behavior covered for logout endpoint protection.
- [ ] Proposed TEST-092/093/094 implemented or explicitly tracked.
- [ ] npm test passes.

Documentation

- [ ] Spec remains aligned with source-of-truth docs.

Review

- [ ] No unrelated files modified.
- [ ] Manual QA requirements identified.

# 19. Manual QA

- Login, then logout from primary navigation.
- Verify redirect to login screen.
- Attempt browser back navigation to protected pages after logout.
- Verify token/session artifacts are removed from client storage/context.
- Repeat logout action to verify consistent behavior.

# 20. Known Risks

Risk:

- Frontend clears only part of auth state, leaving stale protected access in memory.

Impact:

- User appears logged out but can still see protected UI temporarily.

Mitigation:

- Centralized auth-state clear path plus protected-route regression tests.

Risk:

- Team introduces server-side session assumptions inconsistent with stateless MVP logout.

Impact:

- Architecture drift and unnecessary complexity.

Mitigation:

- Keep endpoint contract minimal and enforce implementation constraints.

# 21. Open Questions / Blocking Decisions

1. Foundation gap: repository currently has no backend/frontend scaffold in ddd.
   Impact:

- Exact file paths and test framework details cannot be finalized.
  Blocking status:
- Implementation-blocking until foundation scaffold exists.

2. Repeated logout request behavior detail is not explicitly specified (for example already-cleared client state calling endpoint again).
   Impact:

- Potential inconsistency in UX unless team standardizes behavior.
  Blocking status:
- Not blocking; can be handled with consistent auth-middleware + frontend behavior.

# 22. Copilot Implementation Notes

- Keep logout ticket minimal and architecture-compliant.
- Prefer existing auth context utilities once scaffold exists.
- Verify post-logout route protection with automated tests.
- Avoid introducing server-side session architecture.

# 23. Completion Report Template

Implemented

- Logout endpoint and frontend auth-state clear flow

Files Changed

- [to be filled during implementation]

Tests Added

- [to be filled during implementation]

Tests Run

npm test

Result:

PASS / FAIL

Manual QA Required

- Logout UX, redirect, and post-logout protection checks

Documentation Updated

- None required unless approved contracts change

Known Limitations

- [to be filled during implementation]

Remaining Issues

- Foundation scaffolding and final repeated-logout behavior standardization
