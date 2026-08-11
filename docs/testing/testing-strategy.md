# JoeKnock MVP Testing Strategy

## 1. Purpose

Testing is part of the JoeKnock MVP implementation process, not a final step performed after the application is built.

The goal is to provide a repeatable automated test suite that verifies:

- Core business behavior
- API contracts
- Database behavior
- Authentication
- Authorization
- Organization isolation
- Interaction snapshot behavior
- Validation and error handling
- Frontend behavior where practical
- Regression protection as the application evolves

The automated test suite will not replace manual QA. It will provide a reliable baseline that can be run locally and before significant changes are committed.

The primary command for running the automated test suite should be:

```bash
npm test
```

A successful `npm test` run should indicate that the automated MVP test suite has passed.

---

# 2. Testing Principles

JoeKnock testing should follow these principles.

### Test behavior, not implementation details

Tests should verify what the system is supposed to do rather than depending unnecessarily on the internal structure of the code.

### Test important business rules explicitly

Critical JoeKnock rules should have dedicated tests rather than relying only on broad endpoint tests.

Examples include:

- Organization isolation
- Role permissions
- One interaction history per organization/property/representative
- Immutable interaction snapshots
- Revisions not counting as new knocks
- Notes carrying forward between revisions
- No deletion behavior
- Current-state interaction retrieval

### Security behavior must be tested

Authentication and authorization failures are expected behaviors and should have automated tests.

A successful request is not sufficient evidence that an endpoint is secure.

### Tests should prevent regressions

When a bug is discovered, the preferred process is:

1. Reproduce the behavior with a test.
2. Fix the application.
3. Confirm the test passes.
4. Keep the test permanently.

### Tests should be deterministic

Tests should not depend on:

- A developer's local database state
- Existing production-like data
- External geocoding services
- Network availability
- Execution order
- Current date/time unless explicitly controlled

External services should be mocked or replaced with deterministic test implementations.

---

# 3. Testing Layers

JoeKnock will use multiple testing layers.

## 3.1 Unit Tests

Unit tests verify individual functions, services, or business rules in isolation.

Examples:

- Password validation
- Address normalization
- Permission evaluation
- Visibility rules
- Status validation
- Interaction counting
- Snapshot calculations
- Date-range filtering

Unit tests should be fast and numerous.

---

## 3.2 API / Integration Tests

API tests verify that the backend behaves correctly through its HTTP interface.

These tests should verify:

- Request handling
- Authentication
- Authorization
- Validation
- Database interaction
- Response status codes
- Response structure
- Error responses
- Organization isolation

Examples:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/properties/resolve
POST /api/properties/:propertyId/interactions
POST /api/interactions/:id
```

The exact endpoint list must always follow `docs/api_endpoints.md`.

---

# 4. Database Testing

Database tests verify that important data constraints and persistence behavior are enforced correctly.

Tests should cover:

- Foreign-key relationships
- Required fields
- Unique constraints
- Organization ownership
- User/team relationships
- Status relationships
- Property relationships
- Interaction relationships
- Immutable snapshot behavior
- Current snapshot behavior
- Interaction-group uniqueness

Database tests should verify behavior at the database level where appropriate rather than assuming application code will always enforce the rule.

---

# 5. Authentication Testing

Authentication tests must verify both successful and unsuccessful authentication.

At minimum, test:

### Registration

- Valid organization registration succeeds.
- Required fields are validated.
- Invalid input is rejected.
- Duplicate registration conditions are rejected appropriately.
- Passwords are never stored in plaintext.

### Login

- Valid credentials succeed.
- Invalid credentials fail.
- Missing credentials fail.
- Disabled/inactive users cannot authenticate when applicable.
- Authentication produces the expected authenticated identity context.

### JWT / Session Identity

Protected endpoints must reject requests that:

- Have no authentication credentials.
- Have invalid credentials.
- Have expired/invalid authentication credentials.

The exact authentication mechanism must follow the finalized architecture documentation.

---

# 6. Authorization Testing

Authorization is separate from authentication.

A user being logged in does not automatically mean they are allowed to perform an action.

Tests must verify role-based permissions and resource-level permissions defined by the finalized MVP architecture.

At minimum, test:

- Representative permissions
- Manager permissions
- Administrator permissions
- Unauthorized role access
- Access to protected resources
- Attempted modification of resources the user cannot modify

Every protected endpoint should have tests for both:

1. Authorized access.
2. Unauthorized access.

---

# 7. Organization Isolation Testing

Organization isolation is one of JoeKnock's most important security requirements.

Tests must explicitly create data belonging to multiple organizations and verify that one organization cannot access another organization's data.

Example:

```text
Organization A
├── User A
├── Property A
└── Interaction A

Organization B
├── User B
├── Property B
└── Interaction B
```

Tests should verify:

- User A cannot retrieve Property B.
- User A cannot retrieve Interaction B.
- User A cannot modify Organization B data.
- User A cannot access Organization B users.
- User A cannot access Organization B teams.
- User A cannot access Organization B statuses.
- Organization-scoped queries always apply the authenticated organization context.

This testing requirement applies even when the requested resource ID is otherwise valid.

---

# 8. Property Resolution Testing

Property resolution is handled through:

```text
POST /api/properties/resolve
```

The frontend must not communicate directly with the geocoding provider.

Tests should verify:

- Valid coordinates can resolve a property.
- Invalid coordinates are rejected.
- Backend geocoding behavior is invoked correctly.
- A matching existing property is returned rather than creating a duplicate.
- A new property is created when no matching property exists.
- Property ownership remains organization-scoped.
- The resolved address is the address returned by the configured lookup process.
- Latitude and longitude are controlled by the backend/application and are not user-editable fields.

External geocoding services should not be called during normal automated tests.

They should be mocked or replaced with a deterministic test provider.

---

# 9. Interaction Testing

Interactions contain some of the most important JoeKnock business rules.

The MVP rule is:

> One interaction history exists per organization + property + representative.

Tests must verify:

### First interaction

The first interaction for a representative/property combination:

- Creates the interaction group.
- Creates the initial snapshot.
- Sets the appropriate initial interaction date.
- Records the authenticated representative.
- Stores the initial interaction state.

### Returning to the property

When the same representative interacts with the same property again:

- A new interaction group is NOT created.
- The interaction does NOT count as a new knock.
- The existing interaction can be revised.

### Different representative

When a different representative interacts with the same property:

- The system can maintain a separate interaction history for that representative according to the finalized data model.

### Duplicate prevention

Repeated submissions must not accidentally create duplicate interaction groups.

---

# 10. Immutable Snapshot Testing

Interaction snapshots must be treated as historical records.

When an interaction is changed:

1. The existing snapshot remains preserved.
2. A new snapshot is created.
3. The new snapshot becomes the current state.
4. The interaction group remains the same.
5. The previous snapshot is not rewritten to reflect the new values.

Tests should verify this behavior explicitly.

Example:

```text
Snapshot 1
Status: Interested
Notes: "Interested in estimate"

        ↓ edit

Snapshot 2
Status: Follow Up
Notes: "Interested in estimate. Call Tuesday."
```

Snapshot 1 must remain unchanged.

---

# 11. Notes Persistence Testing

When a representative opens an existing interaction:

- Existing notes should be loaded.
- The representative may leave the notes unchanged.
- The representative may modify the notes.
- Saving creates a new snapshot.
- The new snapshot contains the appropriate notes.
- Previous snapshots retain their original notes.

Tests should cover both unchanged and modified notes.

---

# 12. New Knock Counting

The MVP does not treat every interaction revision as a new knock.

Tests must verify:

```text
First interaction
    = 1 knock

Revision
    = 0 additional knocks

Second revision
    = 0 additional knocks
```

The reporting logic must use the finalized interaction-group rules rather than simply counting rows in the interactions table.

Future interaction expiration is explicitly outside the MVP and should not be implemented or tested as an MVP feature.

---

# 13. Current-State Testing

The normal MVP application experience uses the current interaction state.

Tests should verify that current-state queries return the appropriate current snapshot.

The MVP does not provide a normal user-facing historical timeline.

Historical snapshots still exist for data integrity and future capabilities, but the standard application workflow should not accidentally expose them as a history feature.

---

# 14. Validation Testing

All API endpoints should test invalid input.

Examples:

- Missing required fields
- Invalid data types
- Invalid IDs
- Invalid coordinates
- Invalid status values
- Invalid dates
- Malformed request bodies
- Unauthorized values
- Duplicate values where uniqueness is required

Tests should verify both:

- Appropriate HTTP status code
- Consistent error response structure

---

# 15. Network Failure and Retry Testing

The MVP includes protection against interaction data loss and network failure.

Tests should verify:

- An interaction draft can be preserved locally.
- A failed submission does not silently lose the user's work.
- A retry does not accidentally create duplicate interaction groups.
- A successful retry produces the expected interaction snapshot.
- Repeated submission of the same interaction does not create unintended duplicates.

Where possible, retry behavior should be tested using deterministic simulated network failures.

---

# 16. Reporting Testing

Reporting tests must verify that reports follow the finalized interaction rules.

At minimum, test:

- Date-range filtering
- Status grouping
- Representative grouping
- Organization isolation
- Interaction-group counting
- Revision exclusion from new-knock counts
- Current-state behavior where applicable

Example:

```text
Rep A
Property 1
    Snapshot 1
    Snapshot 2
    Snapshot 3
```

The reporting system must not count this as three knocks.

It represents one initial interaction.

---

# 17. Frontend Testing

Frontend tests should focus on important user behavior rather than testing every visual detail.

Important areas include:

- Authentication state
- Protected routes/views
- Map interaction flow
- Property selection
- Interaction form behavior
- Existing notes loading
- Local draft preservation
- Save/retry behavior
- Status selection
- Visibility behavior
- Current interaction display
- Error handling

Visual details such as exact spacing, colors, and minor layout changes should generally remain subject to manual QA unless they affect important functionality.

---

# 18. End-to-End Testing

End-to-end tests should verify the most important complete workflows.

At minimum, the MVP should eventually have automated coverage for:

### Organization setup

```text
Register organization
    ↓
Create administrator
    ↓
Authenticate
```

### Representative workflow

```text
Login
    ↓
Open map
    ↓
Select property
    ↓
Resolve property
    ↓
Create interaction
    ↓
Save interaction
    ↓
View current interaction
```

### Interaction revision

```text
Open existing property
    ↓
Load existing interaction
    ↓
Load existing notes
    ↓
Change status/notes
    ↓
Save
    ↓
Verify new current snapshot
    ↓
Verify previous snapshot remains preserved
```

### Security

```text
Organization A login
    ↓
Attempt Organization B resource
    ↓
Access denied
```

---

# 19. Test Data

Automated tests should create their own predictable test data.

Tests should not depend on manually created development records.

Test data should include scenarios such as:

```text
Organization A
    Admin A
    Manager A
    Rep A
    Property A
    Interaction A

Organization B
    Admin B
    Rep B
    Property B
    Interaction B
```

Tests should clean up or isolate their data so that test execution is repeatable.

---

# 20. Test Environment

Automated tests should run against a dedicated test environment/database rather than a developer's normal development data.

Test configuration should be controlled through environment variables.

Production credentials, API keys, and other secrets must never be committed to the repository or used by automated tests.

External services should be mocked or replaced with deterministic test implementations wherever practical.

---

# 21. npm test

The project should provide a single standard command:

```bash
npm test
```

This command should eventually execute the appropriate automated test suite for the project.

The exact testing framework and configuration will be selected during the project foundation phase based on the actual React/backend stack.

The final command should:

- Run automated tests.
- Return a non-zero exit code when tests fail.
- Return a successful exit code only when all required tests pass.
- Be suitable for local development.
- Be suitable for CI execution later.

Additional commands may exist for targeted testing, such as:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

if the selected tooling supports them, but `npm test` remains the primary verification command.

---

# 22. Coverage

Code coverage should be measured, but coverage percentage alone is not considered proof of quality.

High priority should be given to coverage of:

- Authentication
- Authorization
- Organization isolation
- Interaction creation
- Interaction revision
- Snapshot immutability
- Notes persistence
- Knock counting
- Property resolution
- Validation
- Error handling

A project with 90% coverage can still contain serious bugs if the wrong behavior is being tested.

Coverage is therefore a measurement tool rather than the definition of quality.

---

# 23. Definition of Done

An implementation is not considered complete until:

- [ ] Application behavior matches the finalized architecture.
- [ ] Database behavior matches the finalized schema.
- [ ] API behavior matches `docs/api_endpoints.md`.
- [ ] Authentication requirements are tested.
- [ ] Authorization requirements are tested.
- [ ] Organization isolation is tested.
- [ ] Required validation is tested.
- [ ] Important business rules have automated tests.
- [ ] Regression tests exist for discovered bugs.
- [ ] Relevant frontend behavior is tested.
- [ ] `npm test` passes.
- [ ] No unrelated tests are broken.
- [ ] No new architecture decisions were introduced without documentation.
- [ ] GitHub issue acceptance criteria are satisfied.
- [ ] Manual QA requirements are identified where automation is insufficient.

---

# 24. Automated Testing Does Not Replace QA

Automated tests are a safety net, not a replacement for human testing.

Manual QA remains necessary for areas such as:

- Real-world map behavior
- Tablet usability
- GPS accuracy and movement
- Touch interaction
- Visual layout
- Daylight readability
- Network transitions
- Browser/device compatibility
- User experience
- Unexpected workflows

The goal is to automate repeatable correctness checks while reserving human QA for behavior that is difficult or inappropriate to automate.

---

# 25. Testing as Part of Development

Every implementation plan should identify its required tests before implementation begins.

The preferred development cycle is:

```text
Implementation specification
        ↓
Test plan
        ↓
Write tests
        ↓
Implement feature
        ↓
Run tests
        ↓
Fix failures
        ↓
Code review
        ↓
npm test
        ↓
Commit
```

Testing should therefore be treated as part of implementation rather than a separate project phase.
