# 1. Ticket Information

GitHub Issue: #1

Title: US-001 - Register Organization

Status: Planned

Priority: P0

MVP: Yes

Dependencies:

- Foundation work for backend app structure and database migration pipeline (no ticket currently scoped in backlog)
- #35 for full organization-isolation enforcement hardening across all protected endpoints

Related Documentation:

- docs/Architecture_Decision_Record.md
- docs/api_endpoints.md
- docs/table_Schema_decisions.md
- docs/testing/testing-strategy.md
- docs/testing/test-matrix.md
- .github/copilot-instructions.md

# 2. User Story

As a new organization administrator,
I want to create my organization and administrator account,
so that I can begin using JoeKnock.

# 3. Objective

Implement initial organization onboarding through POST /api/auth/register so a valid request atomically creates:

- One organization
- One organization_settings record linked to that organization
- One administrator user linked to that organization with a securely hashed password
- Authentication response data for immediate signed-in context

When complete, the system can create a brand-new tenant boundary safely and consistently from one request.

# 4. Scope

## 4.1 Included

- Public registration endpoint implementation for POST /api/auth/register
- Request validation for required registration fields
- Password hashing before persistence
- Atomic database write of organizations + organization_settings + users
- Duplicate email rejection behavior
- Authentication payload returned on successful registration
- Error handling with consistent API error structure

## 4.2 Explicitly Not Included

- Login endpoint behavior beyond response compatibility (covered by #2)
- User/organization management screens and updates (covered by #4, #5, #6 and later)
- Team/status/property/interaction logic
- Any delete behavior
- Any post-MVP workflow

# 5. Existing Architecture

Relevant architectural decisions and impacts:

- ADR-004 PostgreSQL Relational Database
  - Registration must persist relational ownership links correctly across organizations, organization_settings, and users.
- ADR-006 Roles Control Access, Not Field Capability
  - Initial user role must be administrator; role remains a users-table concern.
- Architecture Summary Organization Isolation Rules
  - Registration establishes a new organization boundary; data must not cross tenants.
- ADR-014 MVP Scope Discipline
  - Keep implementation minimal: onboarding only, no extra lifecycle features.
- Copilot instructions sections on no-delete and source-of-truth hierarchy
  - No delete mechanics introduced; documentation conflicts must be flagged, not silently resolved.

# 6. Technical Design

## 6.1 Backend

Components required (framework-agnostic):

- Auth route registration for POST /api/auth/register
- Request validator for organizationName, firstName, lastName, email, password
- Auth service use case for registration transaction
- Password hashing utility integration
- Repository/data-access layer methods for organizations, organization_settings, users
- Transaction wrapper so partial writes cannot remain on failure
- Error mapping for validation, duplicate, and unexpected failures

Behavior summary:

1. Validate request body.
2. Normalize/validate email format.
3. Check duplicate conditions per API/schema rules.
4. Start transaction.
5. Insert organization.
6. Insert organization_settings linked to organization.
7. Hash password and insert administrator user linked to organization.
8. Commit transaction.
9. Return auth information + newly created user.

## 6.2 Frontend

Frontend impact is minimal for this ticket itself but expected integration points:

- Registration form submission payload matching API contract
- Success path stores auth context returned from registration
- Validation/error messages displayed from API responses

No map or post-auth management UI is in scope.

## 6.3 Database

Tables affected:

- organizations
- organization_settings
- users

Columns/constraints used:

- organizations.id, organizations.name
- organization_settings.organization_id unique ownership link
- users.organization_id, users.email (unique), users.password_hash, users.role, users.is_active

Transaction requirement:

- Registration must be atomic. If any insert fails, nothing persists.

# 7. API Contract

## Endpoint

POST /api/auth/register

## Authentication

Not required (public endpoint).

## Authorization

Not applicable for anonymous registration.

## Request

{
"organizationName": "Example Roofing",
"firstName": "John",
"lastName": "Smith",
"email": "john@example.com",
"password": "password"
}

## Response

API docs require successful response to include:

- Authentication information
- Newly created user information

Exact response fields should follow established project response conventions once backend scaffold exists.

## Error Responses

Expected relevant statuses:

- 400 - Validation failure
- 409 - Duplicate registration condition
- 500 - Unexpected server/database error

# 8. Data Flow

Registration form submit
-> frontend API client
-> POST /api/auth/register
-> request validation
-> duplicate checks
-> start transaction
-> insert organization
-> insert organization_settings
-> hash password and insert admin user
-> commit transaction
-> return auth + user payload
-> frontend stores auth context

# 9. Business Rules

- Organization registration creates a new organization boundary.
- Organization settings record is created with each new organization.
- Initial user is associated to the new organization.
- Initial user role is administrator.
- Password is stored only as hash.
- Duplicate email registrations are rejected.
- Registration failures do not leave partial records.
- No delete behavior is introduced.

# 10. Security Requirements

- Validate all public input server-side.
- Hash password before persistence.
- Do not expose password hash or sensitive internals in response.
- Prevent duplicate/abusive registration edge cases from causing inconsistent state.
- Ensure organization ownership is server-defined, never client-supplied.

# 11. Error Handling

| Condition                     | Expected Behavior                                                  |
| ----------------------------- | ------------------------------------------------------------------ |
| Missing required input        | 400 validation error with consistent error structure               |
| Invalid input format          | 400 validation error                                               |
| Unauthenticated request       | Not applicable (public endpoint)                                   |
| Unauthorized request          | Not applicable                                                     |
| Resource not found            | Not applicable                                                     |
| Duplicate/conflicting request | 409 conflict for duplicate email or equivalent duplicate condition |
| Database failure              | 500 and transaction rollback                                       |
| External service failure      | Not applicable                                                     |

# 12. Test Requirements

## Existing Tests

- TEST-003 Valid Organization Registration
- TEST-004 Registration Validation
- TEST-005 Duplicate Registration
- TEST-006 Registration Transaction Integrity
- TEST-010 Password Security
- TEST-087 Complete Organization Setup (E2E coverage linkage)

## New Tests

None required to add to matrix for this ticket if above tests are implemented.

## Unit Tests

- Password hashing utility usage and non-plaintext persistence behavior
- Registration validation logic
- Registration transaction orchestration logic

## Integration/API Tests

- Endpoint happy path creates all required records
- Duplicate email rejected
- Partial failure rolls back all writes
- Response includes auth info and user payload

## Frontend Tests

- Registration form request payload and success auth state storage
- Registration validation/error rendering

## End-to-End Tests

- Contribution to TEST-087 flow: register organization -> authenticated administrator context

# 13. Test Scenarios

## Scenario 1 - Happy Path

Given:

- No existing account for email john@example.com

When:

- Client posts valid registration payload

Then:

- Organization, organization_settings, and admin user are created atomically
- Password is hashed
- Success response includes auth information and user

## Scenario 2 - Validation Failure

Given:

- Request is missing required fields

When:

- Client posts invalid payload

Then:

- API returns 400 with structured validation error
- No records are created

## Scenario 3 - Unauthorized Access

Given:

- Anonymous user

When:

- Calls register endpoint

Then:

- Request is allowed (public endpoint)

## Scenario 4 - Organization Isolation

Given:

- Existing organization A and users

When:

- New registration creates organization B

Then:

- New admin user belongs only to organization B
- No cross-org references are created

# 14. Implementation Sequence

1. Confirm foundation: database migrations and backend app bootstrapped.
2. Implement request validation schema for register payload.
3. Implement password hashing integration.
4. Implement repository writes for organizations, organization_settings, users.
5. Implement registration service transaction.
6. Implement POST /api/auth/register controller/route.
7. Add API tests (TEST-003/004/005/006/010).
8. Add minimal frontend registration integration tests if frontend scaffold exists.
9. Run targeted tests, then npm test.

# 15. Expected Files

Repository currently has no application code scaffold in ddd.

## Expected New Files

- ddd/backend/src/auth/register.route.[ext]
- ddd/backend/src/auth/register.service.[ext]
- ddd/backend/src/auth/register.validation.[ext]
- ddd/backend/src/security/password-hash.[ext]
- ddd/backend/src/db/migrations/[timestamp]\_create_core_tables.[ext] (only if foundation has not already created these tables)
- ddd/backend/tests/integration/auth/register.[ext]

## Expected Modified Files

- ddd/backend/src/app.[ext] (route wiring)
- ddd/backend/src/db/index.[ext] (transaction wiring if needed)
- ddd/frontend/src/auth/register.[ext] (if frontend scaffold exists)

## Potential Files

- ddd/backend/src/common/errors.[ext]
- ddd/backend/src/common/response.[ext]

# 16. Dependencies

## Required Previous Tickets

- No strict ticket-number dependency, but practical dependency on foundation scaffolding

## Required Architecture

- ADR-004, ADR-006, ADR-014, plus organization-isolation rules documented in architecture summary and API docs

## Required API

- POST /api/auth/register

## Required Database

- organizations, organization_settings, users tables and constraints

## Required Frontend

- Registration form/client integration (if frontend exists at implementation time)

# 17. Implementation Constraints

- Do not introduce delete behavior.
- Do not trust client-supplied organization ownership identifiers.
- Do not introduce alternative onboarding architecture.
- Do not add non-MVP account lifecycle features.
- Do not bypass transaction safety for multi-table registration.

# 18. Definition of Done

Functionality

- [ ] Registration endpoint implemented per contract.
- [ ] Acceptance criteria satisfied.
- [ ] Out-of-scope features not implemented.

Architecture

- [ ] Behavior matches architecture docs.
- [ ] Database behavior matches schema docs.
- [ ] API behavior matches docs/api_endpoints.md.
- [ ] No unapproved architecture introduced.

Security

- [ ] Input validation implemented.
- [ ] Password hashing implemented.
- [ ] Organization ownership assigned server-side.

Testing

- [ ] TEST-003/004/005/006/010 implemented and passing.
- [ ] Relevant integration tests pass.
- [ ] npm test passes.

Documentation

- [ ] Spec remains aligned with source-of-truth docs.

Review

- [ ] No unrelated files modified.
- [ ] Manual QA requirements identified.

# 19. Manual QA

- Register with valid data and verify immediate signed-in behavior.
- Attempt duplicate email registration.
- Attempt registration with missing fields and invalid email format.
- Verify no partial records remain when simulating backend failure mid-registration.

# 20. Known Risks

Risk:

- Multi-record write may partially persist if transaction boundaries are misapplied.

Impact:

- Orphaned or inconsistent tenant setup.

Mitigation:

- Enforce transaction wrapper and integration test for rollback (TEST-006).

Risk:

- Password handling mistakes.

Impact:

- Security vulnerability.

Mitigation:

- Dedicated password security tests (TEST-010) and code review focus.

# 21. Open Questions / Blocking Decisions

1. Foundation gap: repository currently has no backend/frontend code scaffold under ddd.
   Impact:

- Exact file paths and implementation details depend on project foundation decisions.
  Blocking status:
- Not a product blocker, but implementation cannot start until foundation structure exists.

# 22. Copilot Implementation Notes

- Follow source-of-truth hierarchy in .github/copilot-instructions.md.
- Keep scope limited to registration.
- Implement tests with ticket, not after ticket.
- Do not create new architecture to compensate for missing scaffold.
- Raise contradictions before coding.

# 23. Completion Report Template

Implemented

- Registration endpoint and atomic onboarding flow

Files Changed

- [to be filled during implementation]

Tests Added

- [to be filled during implementation]

Tests Run

npm test

Result:

PASS / FAIL

Manual QA Required

- Registration happy path, validation, duplicate handling

Documentation Updated

- None required unless approved contracts change

Known Limitations

- [to be filled during implementation]

Remaining Issues

- Foundation scaffold availability for implementation
