# 1. Ticket Information

GitHub Issue: #2

Title: US-002 - Log In

Status: Planned

Priority: P0

MVP: Yes

Dependencies:

- Practical data dependency: at least one active user account must exist (can be from #1 or seeded test data)
- Foundation work for backend/frontend scaffolding and test harness (no ticket currently scoped in backlog)

Related Documentation:

- docs/Architecture_Decision_Record.md
- docs/api_endpoints.md
- docs/table_Schema_decisions.md
- docs/testing/testing-strategy.md
- docs/testing/test-matrix.md
- .github/copilot-instructions.md

# 2. User Story

As a JoeKnock user,
I want to securely log into my account,
so that I can access my organization's data.

# 3. Objective

Implement secure authentication through POST /api/auth/login that validates credentials, rejects inactive accounts, and returns a valid JWT plus authenticated user context used by downstream authorization and organization isolation.

# 4. Scope

## 4.1 Included

- Public login endpoint implementation for POST /api/auth/login
- Input validation for email and password
- Credential verification against stored password hash
- Active-user check (inactive users cannot log in)
- JWT issuance on successful authentication
- Auth response containing authenticated user information including organization context
- Frontend auth state storage and protected-route gating behavior for logged-in users

## 4.2 Explicitly Not Included

- User registration flow internals (covered by #1)
- Authorization rules for protected resource actions (covered primarily by #35 and #36)
- Role-management UI and user management CRUD
- Interaction, map, property, reporting logic
- Any delete behavior

# 5. Existing Architecture

Relevant architectural decisions and impacts:

- ADR-004 PostgreSQL Relational Database
  - Login uses persisted user and organization relationships as authoritative identity sources.
- ADR-006 Roles Control Access, Not Field Capability
  - Login establishes identity; role is part of user context and later authorization.
- ADR-011 Interaction Visibility Is Permission-Based
  - Auth identity must carry enough context to apply visibility decisions downstream.
- Organization-isolation and server-owned context rules in API and copilot instructions
  - Auth context must derive organization from persisted user/org relationship, not client input.
- No-delete MVP policy
  - Inactive users are denied login; user deletion is out of scope.

# 6. Technical Design

## 6.1 Backend

Components required (framework-agnostic):

- Auth route for POST /api/auth/login
- Request validator for email/password
- Auth service for lookup and credential verification
- Password hash compare utility
- JWT token generation utility
- Consistent error response mapping

Behavior summary:

1. Validate request payload.
2. Lookup user by email.
3. Verify user exists and is active.
4. Verify password hash match.
5. Load organization context for authenticated user.
6. Issue JWT.
7. Return JWT plus authenticated user information.

## 6.2 Frontend

- Login form and submission handling
- Store auth information on success
- Redirect/navigation to authenticated area
- Display error for invalid credentials and inactive account
- Ensure protected pages are inaccessible without valid auth state

## 6.3 Database

Tables affected (read-only for login):

- users
- organizations

Columns/constraints used:

- users.email (lookup)
- users.password_hash (verification)
- users.is_active (login gate)
- users.organization_id and organization relation for auth context

No schema or migration change required specifically for login.

# 7. API Contract

## Endpoint

POST /api/auth/login

## Authentication

Not required (public endpoint).

## Authorization

Not applicable for anonymous login request.

## Request

{
"email": "john@example.com",
"password": "password"
}

## Response

API docs require successful response to include:

- A valid JWT
- Authenticated user information

The authenticated identity must include organization context used by protected operations.

## Error Responses

Expected relevant statuses:

- 400 - Validation failure
- 401 - Invalid credentials
- 403 - Inactive/disabled account (or equivalent denied-auth response per project error convention)
- 500 - Unexpected server error

# 8. Data Flow

User enters credentials
-> frontend login form
-> POST /api/auth/login
-> validate payload
-> lookup user by email
-> verify active account
-> verify password hash
-> issue JWT
-> return token + user context
-> frontend stores auth state
-> protected routes enabled

# 9. Business Rules

- Email and password are required.
- Invalid credentials are rejected.
- Inactive users cannot authenticate.
- Successful login returns valid JWT.
- Authenticated user organization context is available for downstream authorization/isolation.
- Client does not provide organization identity in login request.

# 10. Security Requirements

- Use secure password hash comparison, never plaintext checks.
- Do not leak whether email exists beyond approved error behavior.
- Ensure token payload and response do not expose sensitive data.
- Ensure inactive-user check occurs before successful token issuance.
- Enforce consistent error structure for security-related failures.

# 11. Error Handling

| Condition                     | Expected Behavior                |
| ----------------------------- | -------------------------------- |
| Missing required input        | 400 validation error             |
| Invalid input format          | 400 validation error             |
| Unauthenticated request       | Not applicable (public endpoint) |
| Unauthorized request          | Not applicable                   |
| Resource not found            | Not applicable                   |
| Duplicate/conflicting request | Not applicable                   |
| Database failure              | 500 server error                 |
| External service failure      | Not applicable                   |

# 12. Test Requirements

## Existing Tests

- TEST-007 Valid Login
- TEST-008 Invalid Login
- TEST-009 Missing Login Credentials
- TEST-010 Password Security
- TEST-011 Invalid Authentication Token (downstream protected endpoint behavior)
- TEST-012 Missing Authentication (downstream protected endpoint behavior)
- TEST-090 Cross-Organization Security Workflow (depends on valid auth)

## New Tests

- TEST-091 Login Auth Context Includes Organization
  - Planning-only identifier. Do not edit test-matrix.md in this task.

## Unit Tests

- Login payload validation
- Password verification logic
- Auth token generation utility behavior

## Integration/API Tests

- Successful login with active user returns JWT + user context
- Invalid credentials return expected auth failure
- Inactive user denied authentication
- Error response format consistency

## Frontend Tests

- Login form submit and success auth-state persistence
- Invalid credential and inactive-user error rendering
- Protected route gating based on auth state

## End-to-End Tests

- Contributes to TEST-087 and TEST-088 flows

# 13. Test Scenarios

## Scenario 1 - Happy Path

Given:

- Active user exists with valid password

When:

- User submits valid login credentials

Then:

- API returns JWT + authenticated user context
- Frontend stores auth and grants protected-route access

## Scenario 2 - Validation Failure

Given:

- Missing email or password

When:

- User submits invalid payload

Then:

- API returns 400 structured validation error

## Scenario 3 - Unauthorized Access

Given:

- Inactive account

When:

- User attempts login

Then:

- Authentication is rejected
- No JWT is issued

## Scenario 4 - Organization Isolation

Given:

- User belongs to Organization A

When:

- Login succeeds

Then:

- Authenticated context identifies Organization A only
- No Organization B context is attached

# 14. Implementation Sequence

1. Confirm foundation scaffold and auth route wiring exists.
2. Implement login request validation.
3. Implement user lookup + active-user checks.
4. Implement password hash compare path.
5. Implement JWT issuance and response shaping.
6. Wire frontend login state handling.
7. Add/execute TEST-007/008/009/010 and TEST-091.
8. Run broader auth-related tests and npm test.

# 15. Expected Files

Repository currently has no application code scaffold in ddd.

## Expected New Files

- ddd/backend/src/auth/authRoutes.js
- ddd/backend/src/auth/authController.js
- ddd/backend/src/auth/authService.js
- ddd/backend/src/auth/jwt.js
- ddd/backend/src/validation/schemas/login.js
- ddd/backend/tests/integration/auth/login.test.js
- ddd/frontend/src/api/authApi.js
- ddd/frontend/src/pages/LoginPage.jsx
- ddd/frontend/tests/auth/login.test.js

## Expected Modified Files

- ddd/backend/src/app.js (auth route registration)
- ddd/frontend/src/auth/AuthProvider.jsx (auth storage/session state)
- ddd/frontend/src/auth/authStorage.js (localStorage token handling)
- ddd/frontend/src/auth/ProtectedRoute.jsx (auth gate)

## Potential Files

- ddd/backend/src/common/errors.js
- ddd/backend/src/common/response.js

# 16. Dependencies

## Required Previous Tickets

- No strict sequence requirement on issue number, but implementation is easier after #1 because a real account exists to authenticate.

## Required Architecture

- Organization-isolated auth context and role model from architecture docs

## Required API

- POST /api/auth/login

## Required Database

- users and organizations data with valid hashed credentials

## Required Frontend

- Auth state container and protected-route pattern (once scaffold exists)

# 17. Implementation Constraints

- Do not introduce alternative auth mechanism.
- Do not trust client-supplied organization identity.
- Do not expose password or password hash data.
- Do not add post-MVP auth features.
- Do not implement deletion behavior.

# 18. Definition of Done

Functionality

- [ ] Login endpoint implemented per contract.
- [ ] Acceptance criteria satisfied.
- [ ] Out-of-scope functionality not implemented.

Architecture

- [ ] Implementation matches approved architecture.
- [ ] API behavior matches docs/api_endpoints.md.
- [ ] No unapproved architecture introduced.

Security

- [ ] Credential verification secure.
- [ ] Inactive users denied authentication.
- [ ] Organization context derived from persisted identity.

Testing

- [ ] TEST-007/008/009/010 implemented and passing.
- [ ] TEST-011/012 coverage validated for protected-route behavior.
- [ ] TEST-091 implemented.
- [ ] npm test passes.

Documentation

- [ ] Spec remains aligned with source-of-truth docs.

Review

- [ ] No unrelated files modified.
- [ ] Manual QA requirements identified.

# 19. Manual QA

- Login with valid credentials and verify protected pages load.
- Login with invalid credentials and verify error behavior.
- Attempt login with inactive account and verify denial.
- Browser refresh/session persistence behavior verification per chosen auth storage approach.

# 20. Known Risks

Risk:

- Token issuance and storage flow implemented inconsistently between backend response and frontend auth state.

Impact:

- Users appear logged in/out incorrectly or protected routes misbehave.

Mitigation:

- Frontend auth integration tests and manual login/logout route checks.

Risk:

- Credential failure messages leak too much account-state detail.

Impact:

- Information disclosure risk.

Mitigation:

- Standardized auth failure responses reviewed for security.

# 21. Open Questions / Blocking Decisions

1. Foundation gap: repository currently has no backend/frontend scaffold in ddd.
   Impact:

- Implementation cannot begin until the planned foundation scaffold is created.
  Blocking status:
- Implementation-blocking until foundation exists.

2. Response contract detail: API docs specify JWT + authenticated user information but do not yet define exact response field schema.
   Impact:

- Frontend/backend contract may drift without explicit response shape.
  Blocking status:
- Not fully blocking if team establishes one consistent response schema before coding begins.

# 22. Copilot Implementation Notes

- Keep #2 scope focused on authentication only.
- Reuse shared validation and error formats once scaffold exists.
- Ensure tests verify behavior, not framework internals.
- Do not add architecture or feature scope beyond docs.

# 23. Completion Report Template

Implemented

- Login endpoint and frontend auth state integration

Files Changed

- [to be filled during implementation]

Tests Added

- [to be filled during implementation]

Tests Run

npm test

Result:

PASS / FAIL

Manual QA Required

- Login success/failure/inactive-account checks

Documentation Updated

- None required unless approved contracts change

Known Limitations

- [to be filled during implementation]

Remaining Issues

- Foundation scaffolding and explicit response-shape standardization
