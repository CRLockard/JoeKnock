# JoeKnock Implementation Specification Template

> **Status:** Template
> **Purpose:** Standard structure for implementation specifications for JoeKnock GitHub issues.

---

# 1. Ticket Information

**GitHub Issue:** `#XX`

**Title:** `US-XXX — [Title]`

**Status:** Planned

**Priority:** P0 / P1 / P2

**MVP:** Yes / No

**Dependencies:**

- `#XX`
- `#XX`

**Related Documentation:**

- `docs/Architecture_Decision_Record.md`
- `docs/api_endpoints.md`
- `docs/table_Schema_decisions.md`
- `docs/testing/testing-strategy.md`
- `docs/testing/test-matrix.md`

---

# 2. User Story

Copy the approved GitHub user story here.

> As a [user], I want [capability], so that [value].

Do not rewrite the requirement unless the GitHub issue has been formally updated.

---

# 3. Objective

Describe exactly what this implementation is intended to accomplish.

This section should answer:

> What will be true about the application when this ticket is complete that was not true before?

Keep the objective focused on this ticket.

---

# 4. Scope

## 4.1 Included

List everything that this ticket is responsible for.

-
-
-

## 4.2 Explicitly Not Included

List functionality that might appear related but belongs to another ticket or future work.

-
-
-

This section is mandatory.

Its purpose is to prevent implementation scope from expanding during development.

---

# 5. Existing Architecture

Identify the existing architectural decisions that affect this implementation.

Relevant decisions may include:

- Authentication
- Authorization
- Organization isolation
- Database ownership
- Immutable interaction snapshots
- Property resolution
- Map-first workflow
- No-delete MVP policy
- Visibility rules
- Current-state interaction model

For each relevant decision, explain how it affects this ticket.

Do not introduce new architectural decisions in this section.

---

# 6. Technical Design

Describe the intended implementation.

## 6.1 Backend

Identify the backend components involved.

Possible areas:

- Route/controller
- Service/business logic
- Repository/data access
- Validation
- Middleware
- Authorization
- Error handling

Describe what each component is responsible for.

---

## 6.2 Frontend

Identify the frontend components involved.

Possible areas:

- Page/view
- Component
- Hook
- Context/state
- API client
- Form
- Error handling
- Loading state

Only include frontend work when this ticket requires it.

---

## 6.3 Database

Identify:

- Tables affected
- Columns used
- Relationships
- Constraints
- Queries
- Transactions
- Indexes, if required

The implementation must follow:

`docs/table_Schema_decisions.md`

Do not redesign the schema within this specification unless the architecture has been explicitly approved to change.

---

# 7. API Contract

Complete this section if the ticket involves an API.

## Endpoint

```text
METHOD /api/example
```

## Authentication

- Required / Not required

## Authorization

Describe which roles/users may access the endpoint.

## Request

```json
{}
```

## Response

```json
{}
```

## Error Responses

Document expected failure cases.

```text
400 — Validation failure
401 — Unauthenticated
403 — Unauthorized
404 — Resource not found
409 — Conflict
500 — Unexpected server error
```

Only include statuses that actually apply.

The final contract must agree with:

`docs/api_endpoints.md`

---

# 8. Data Flow

Describe the request/data flow from beginning to end.

Example:

```text
User action
    ↓
Frontend component
    ↓
API client
    ↓
Authenticated API request
    ↓
Authorization
    ↓
Validation
    ↓
Service/business logic
    ↓
Database
    ↓
API response
    ↓
Frontend state update
    ↓
UI
```

Replace the generic flow with the actual flow for the ticket.

---

# 9. Business Rules

List every business rule this implementation must enforce.

Examples:

- Organization ownership must be respected.
- Representatives may modify their own interactions.
- Managers may modify interactions belonging to representatives on their assigned teams within organization scope.
- Administrators may modify any interaction within organization scope.
- Manager/admin edits must not transfer interaction ownership.
- A revision must use the existing interaction group.
- A revision must not create a new knock.
- Existing notes must carry forward.
- Historical snapshots must remain unchanged.

Each rule should be testable.

---

# 10. Security Requirements

Document the security considerations for this ticket.

Address applicable items:

- Authentication
- Authorization
- Organization isolation
- Resource ownership
- Input validation
- ID manipulation
- Duplicate requests
- Replay/retry behavior
- Sensitive information exposure
- Error information leakage

Describe both expected successful behavior and expected unauthorized behavior.

---

# 11. Error Handling

Document expected failure conditions.

| Condition                     | Expected Behavior |
| ----------------------------- | ----------------- |
| Missing required input        |                   |
| Invalid input                 |                   |
| Unauthenticated request       |                   |
| Unauthorized request          |                   |
| Resource not found            |                   |
| Duplicate/conflicting request |                   |
| Database failure              |                   |
| External service failure      |                   |

Only include conditions relevant to this ticket.

---

# 12. Test Requirements

Identify the tests required by the test matrix.

## Existing Tests

Reference applicable tests:

- `TEST-XXX`
- `TEST-XXX`

## New Tests

Identify tests that must be created.

- `TEST-XXX`
- `TEST-XXX`

## Unit Tests

Describe required unit-level behavior.

## Integration/API Tests

Describe required API/database behavior.

## Frontend Tests

Describe required frontend behavior where applicable.

## End-to-End Tests

Identify applicable end-to-end workflows.

---

# 13. Test Scenarios

Describe the important scenarios explicitly.

### Scenario 1 — Happy Path

**Given:**

...

**When:**

...

**Then:**

...

---

### Scenario 2 — Validation Failure

**Given:**

...

**When:**

...

**Then:**

...

---

### Scenario 3 — Unauthorized Access

**Given:**

...

**When:**

...

**Then:**

...

---

### Scenario 4 — Organization Isolation

**Given:**

...

**When:**

...

**Then:**

...

---

Add or remove scenarios as appropriate.

Do not create artificial scenarios that are irrelevant to the ticket.

---

# 14. Implementation Sequence

Describe the recommended implementation order.

Example:

```text
1. Create/update database migration
2. Implement repository/data access
3. Implement business service
4. Implement validation
5. Implement authorization
6. Implement API endpoint
7. Implement frontend behavior
8. Add automated tests
9. Run targeted tests
10. Run npm test
```

Adjust the sequence to the actual ticket.

---

# 15. Expected Files

Identify the files expected to be created or modified.

## Expected New Files

```text
path/to/file
path/to/file
```

## Expected Modified Files

```text
path/to/file
path/to/file
```

## Potential Files

```text
path/to/file
```

Potential files are areas that may need modification depending on the existing implementation.

Copilot should avoid modifying files outside this list unless a technical dependency makes it necessary.

If additional files become necessary, Copilot should explain why.

---

# 16. Dependencies

Identify dependencies that must exist before implementation can begin.

### Required Previous Tickets

- `#XX`

### Required Architecture

- [Decision]

### Required API

- [Endpoint]

### Required Database

- [Table/relationship]

### Required Frontend

- [Component/state]

---

# 17. Implementation Constraints

List things the implementation must not do.

Examples:

- Do not create a new interaction group for a revision.
- Do not expose geocoding directly to the frontend.
- Do not add a delete endpoint.
- Do not expose interaction history to normal users.
- Do not bypass organization isolation.
- Do not add future expiration behavior.
- Do not introduce a new dependency without approval.

---

# 18. Definition of Done

This ticket is complete when:

### Functionality

- [ ] All required functionality is implemented.
- [ ] Acceptance criteria are satisfied.
- [ ] Out-of-scope functionality was not implemented.

### Architecture

- [ ] Implementation matches approved architecture.
- [ ] Database behavior matches schema documentation.
- [ ] API behavior matches API documentation.
- [ ] No unapproved architecture was introduced.

### Security

- [ ] Authentication requirements are satisfied.
- [ ] Authorization requirements are satisfied.
- [ ] Organization isolation is enforced.
- [ ] Input validation is implemented.

### Testing

- [ ] Required unit tests exist.
- [ ] Required integration/API tests exist.
- [ ] Required frontend tests exist where applicable.
- [ ] Required end-to-end coverage exists where applicable.
- [ ] `npm test` passes.

### Documentation

- [ ] Implementation documentation remains accurate.
- [ ] API documentation is updated if the approved contract changed.
- [ ] Architecture documentation is updated only when an approved architectural decision changed.

### Review

- [ ] No unrelated files were modified unnecessarily.
- [ ] No unrelated features were implemented.
- [ ] Known limitations are documented.
- [ ] Manual QA requirements are identified.

---

# 19. Manual QA

Identify behavior that should be manually tested after automated tests pass.

Examples:

- Tablet interaction
- Touch accuracy
- Map behavior
- GPS behavior
- Visual layout
- Network transitions
- Browser compatibility

List only the manual checks relevant to this ticket.

---

# 20. Known Risks

Identify technical or product risks associated with this implementation.

For each risk:

**Risk:**

...

**Impact:**

...

**Mitigation:**

...

Do not invent risks simply to fill this section.

---

# 21. Open Questions / Blocking Decisions

List unresolved questions.

If there are no unresolved questions:

> None.

A ticket should not move into implementation while a blocking architecture or product decision remains unresolved.

---

# 22. Copilot Implementation Notes

This section contains specific instructions for the implementation agent.

Examples:

- Follow existing repository patterns.
- Reuse existing authentication middleware.
- Reuse existing validation utilities.
- Do not introduce a new abstraction unless required.
- Do not modify unrelated files.
- Add tests before declaring the ticket complete.
- Run the relevant targeted tests.
- Run `npm test` before completion.

This section must not override the project's architecture documentation.

---

# 23. Completion Report Template

When implementation is complete, report:

## Implemented

-

## Files Changed

-

## Tests Added

-

## Tests Run

```text
npm test
```

Result:

```text
PASS / FAIL
```

## Manual QA Required

-

## Documentation Updated

-

## Known Limitations

-

## Remaining Issues

-
