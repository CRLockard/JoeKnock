# JoeKnock MVP Test Matrix

## 1. Purpose

This document defines the automated test coverage expected for the JoeKnock MVP.

It complements:

- `docs/testing/testing-strategy.md`
- `docs/table_Schema_decisions.md`
- `docs/api_endpoints.md`
- `docs/Architecture_Decision_Record.md`

This document is a testing inventory, not an implementation specification.

The exact testing framework and test-file organization will be determined during project foundation based on the application's actual technology stack.

A feature is not considered fully tested merely because one happy-path test passes. Important business rules, security boundaries, failure cases, and regression risks must be covered.

---

# 2. Test Status

Each test area should eventually have one of these states:

- **Planned** — Test requirement identified but not implemented.
- **Implemented** — Automated test exists.
- **Passing** — Automated test currently passes.
- **Failing** — Automated test exists but currently fails.
- **Blocked** — Test cannot yet be implemented because a dependency is incomplete.
- **Manual** — Testing is intentionally performed manually because automation is inappropriate or insufficient.

During implementation, this document may be updated to reflect actual test coverage.

---

# 3. Test Priority

Tests are categorized by priority.

### P0 — Critical

Failure could cause:

- Security vulnerability
- Data corruption
- Incorrect ownership/isolation
- Incorrect interaction history
- Incorrect reporting
- Loss of user data

P0 tests must pass before MVP release.

### P1 — Important

Important functional behavior that should be automated before MVP release.

### P2 — Supporting

Useful coverage that improves confidence but is less critical to core business behavior.

### Manual

Behavior requiring human/device evaluation.

---

# 4. Project Foundation

## TEST-001 — Test Runner

**Priority:** P0

Verify:

- `npm test` exists.
- `npm test` executes the automated test suite.
- A failing test produces a non-zero exit code.
- A passing suite produces a successful exit code.

**Status:** Planned

---

## TEST-002 — Test Environment Isolation

**Priority:** P0

Verify:

- Automated tests do not use normal development data.
- Test configuration is separate from production configuration.
- Test secrets are not committed.
- Tests can be run repeatedly without relying on previous test execution.

**Status:** Planned

---

# 5. Organization Registration

Related issue: **#1 — US-001 Register Organization**

## TEST-003 — Valid Organization Registration

**Priority:** P0

Verify that valid organization registration:

- Creates the organization.
- Creates the initial administrator/user as defined by the API contract.
- Associates the user with the correct organization.
- Produces the expected response.

**Status:** Planned

---

## TEST-004 — Registration Validation

**Priority:** P1

Verify registration rejects:

- Missing required fields.
- Invalid field formats.
- Invalid password requirements.
- Invalid organization information.

**Status:** Planned

---

## TEST-005 — Duplicate Registration

**Priority:** P1

Verify duplicate conditions defined by the API/database contract are rejected appropriately.

**Status:** Planned

---

## TEST-006 — Registration Transaction Integrity

**Priority:** P0

Verify that a failed portion of organization registration does not leave partially created organization/user data.

**Status:** Planned

---

# 6. Authentication

Related issue: **#2 — US-002 Log In**

## TEST-007 — Valid Login

**Priority:** P0

Verify valid credentials successfully authenticate the user.

**Status:** Planned

---

## TEST-008 — Invalid Login

**Priority:** P0

Verify invalid credentials are rejected.

**Status:** Planned

---

## TEST-009 — Missing Login Credentials

**Priority:** P1

Verify incomplete authentication requests are rejected with the expected validation response.

**Status:** Planned

---

## TEST-010 — Password Security

**Priority:** P0

Verify:

- Passwords are never stored in plaintext.
- Authentication uses the approved password hashing approach.
- Authentication responses do not expose password information.

**Status:** Planned

---

## TEST-011 — Invalid Authentication Token

**Priority:** P0

Verify protected endpoints reject invalid authentication credentials.

**Status:** Planned

---

## TEST-012 — Missing Authentication

**Priority:** P0

Verify protected endpoints reject unauthenticated requests.

**Status:** Planned

---

# 7. Organization Isolation

Related issue: **#35 — US-035 Enforce Organization Isolation**

## TEST-013 — Cross-Organization Property Access

**Priority:** P0

Create:

```text
Organization A
    Property A

Organization B
    Property B
```

Verify Organization A users cannot retrieve Property B.

**Status:** Planned

---

## TEST-014 — Cross-Organization Interaction Access

**Priority:** P0

Verify a user cannot retrieve or modify an interaction belonging to another organization.

**Status:** Planned

---

## TEST-015 — Cross-Organization User Access

**Priority:** P0

Verify organization-scoped user operations cannot expose users belonging to another organization.

**Status:** Planned

---

## TEST-016 — Cross-Organization Team Access

**Priority:** P0

Verify team data cannot cross organization boundaries.

**Status:** Planned

---

## TEST-017 — Cross-Organization Status Access

**Priority:** P0

Verify status data cannot cross organization boundaries.

**Status:** Planned

---

## TEST-018 — Resource ID Does Not Bypass Organization Scope

**Priority:** P0

Verify that knowing a valid resource ID from another organization does not provide access to that resource.

**Status:** Planned

---

# 8. Role Permissions

Related issue: **#36 — US-036 Enforce Role Permissions**

## TEST-019 — Representative Permissions

**Priority:** P0

Verify representatives can perform only actions allowed by the finalized MVP permission model.

**Status:** Planned

---

## TEST-020 — Manager Permissions

**Priority:** P0

Verify managers can perform only actions allowed by the finalized MVP permission model.

Managers must not automatically receive edit permissions for another representative's interaction merely because they can view it.

**Status:** Planned

---

## TEST-021 — Administrator Permissions

**Priority:** P0

Verify administrators can perform organization-level administrative actions allowed by the MVP.

**Status:** Planned

---

## TEST-022 — Unauthorized Role Access

**Priority:** P0

Verify users receive an appropriate authorization failure when attempting an action outside their role.

**Status:** Planned

---

# 9. Users

Related issues: **#6–#9**

## TEST-023 — Create User

**Priority:** P1

Verify authorized users can create users according to the API contract.

**Status:** Planned

---

## TEST-024 — Update User

**Priority:** P1

Verify authorized user updates work correctly.

**Status:** Planned

---

## TEST-025 — User Organization Assignment

**Priority:** P0

Verify users cannot be accidentally associated with the wrong organization.

**Status:** Planned

---

## TEST-026 — No User Deletion

**Priority:** P0

Verify the MVP does not expose or execute hard-delete or soft-delete behavior for users.

The implementation must follow the finalized MVP decision that user deletion is not supported.

**Status:** Planned

---

# 10. Teams

Related issues: **#10–#13**

## TEST-027 — Create Team

**Priority:** P1

Verify authorized users can create a team within their organization.

**Status:** Planned

---

## TEST-028 — Team Membership

**Priority:** P1

Verify users can be associated with teams according to the finalized API and permission rules.

**Status:** Planned

---

## TEST-029 — Cross-Organization Team Membership

**Priority:** P0

Verify a user cannot be added to or associated with a team belonging to another organization.

**Status:** Planned

---

# 11. Statuses

Related issues: **#14–#17**

## TEST-030 — View Organization Statuses

**Priority:** P1

Verify users retrieve the correct statuses for their organization.

**Status:** Planned

---

## TEST-031 — Create Status

**Priority:** P1

Verify authorized users can create organization-defined statuses.

**Status:** Planned

---

## TEST-032 — Update Status

**Priority:** P1

Verify authorized users can update statuses according to the finalized rules.

**Status:** Planned

---

## TEST-033 — Cross-Organization Status Isolation

**Priority:** P0

Verify statuses belonging to another organization cannot be retrieved or modified.

**Status:** Planned

---

# 12. Property Resolution

Related issues: **#23, #26, #45**

## TEST-034 — Resolve Property

**Priority:** P0

Verify:

```text
coordinates
    ↓
backend geocoding
    ↓
normalized address
    ↓
organization-scoped property lookup/create
    ↓
resolved property
```

produces the expected result.

**Status:** Planned

---

## TEST-035 — Existing Property Reuse

**Priority:** P0

Verify resolving an already-known property returns the existing organization-scoped property rather than creating a duplicate.

**Status:** Planned

---

## TEST-036 — New Property Creation

**Priority:** P0

Verify resolution creates a property when no matching property exists.

**Status:** Planned

---

## TEST-037 — Property Organization Isolation

**Priority:** P0

Verify a property belonging to Organization A cannot be reused or exposed as Organization B's property.

**Status:** Planned

---

## TEST-038 — Invalid Coordinates

**Priority:** P1

Verify invalid coordinate input is rejected.

**Status:** Planned

---

## TEST-039 — Geocoding Provider Boundary

**Priority:** P0

Verify frontend requests use the application property-resolution API rather than directly calling the geocoding provider.

**Status:** Planned

---

## TEST-040 — Geocoding Failure

**Priority:** P1

Verify a geocoding failure produces a controlled application error without creating an invalid property record.

**Status:** Planned

---

# 13. Properties

Related issues: **#26–#28**

## TEST-041 — View Property

**Priority:** P1

Verify an authorized user can retrieve an accessible property.

**Status:** Planned

---

## TEST-042 — Property Organization Isolation

**Priority:** P0

Verify property retrieval always applies organization scope.

**Status:** Planned

---

## TEST-043 — Property Cannot Be Deleted

**Priority:** P0

Verify the MVP does not implement hard-delete or soft-delete behavior for properties.

**Status:** Planned

---

# 14. Map

Related issues: **#18–#22, #40–#42**

## TEST-044 — Map Loads

**Priority:** P1

Verify the map workspace loads successfully.

**Status:** Planned

---

## TEST-045 — Current Location

**Priority:** P2

Verify the application can display the representative's current position when location permission is available.

**Status:** Planned

---

## TEST-046 — Property Selection

**Priority:** P1

Verify selecting a property on the map opens the expected property interaction workflow.

**Status:** Planned

---

## TEST-047 — Interaction Markers

**Priority:** P1

Verify properties with accessible current interactions display the correct map state/marker information.

**Status:** Planned

---

## TEST-048 — Visibility Filtering

**Priority:** P0

Verify map-visible interaction/property information respects the representative visibility configuration.

**Status:** Planned

---

# 15. Interaction Creation

Related issue: **#29 — US-029 Record New Interaction**

## TEST-049 — First Interaction Creates Group

**Priority:** P0

Verify the first interaction for:

```text
organization + property + representative
```

creates the appropriate interaction group and initial snapshot.

**Status:** Planned

---

## TEST-050 — Interaction Group Identity

**Priority:** P0

Verify the interaction group represents the correct organization/property/representative combination.

**Status:** Planned

---

## TEST-051 — Repeat Interaction Does Not Create New Group

**Priority:** P0

Verify returning to the same property as the same representative does not create a second interaction group.

**Status:** Planned

---

## TEST-052 — Different Representative

**Priority:** P0

Verify the interaction model correctly handles another representative interacting with the same property according to the finalized schema and API rules.

**Status:** Planned

---

## TEST-053 — Duplicate Submission

**Priority:** P0

Verify repeated submission cannot accidentally create duplicate interaction groups.

**Status:** Planned

---

# 16. Interaction Revision

Related issue: **#31 — US-031 Update Interaction**

## TEST-054 — Create Revision

**Priority:** P0

Verify updating an interaction creates a new snapshot within the existing interaction group.

**Status:** Planned

---

## TEST-055 — Previous Snapshot Preserved

**Priority:** P0

Verify the previous snapshot remains unchanged after an update.

**Status:** Planned

---

## TEST-056 — Current Snapshot

**Priority:** P0

Verify the new snapshot becomes the current snapshot according to the finalized `is_current` behavior.

**Status:** Planned

---

## TEST-057 — Same Interaction Group

**Priority:** P0

Verify revisions retain the original `interaction_group_id`.

**Status:** Planned

---

## TEST-058 — Revision Does Not Create New Knock

**Priority:** P0

Verify a revision does not create another interaction group or additional knock.

**Status:** Planned

---

# 17. Notes

## TEST-059 — Existing Notes Load

**Priority:** P0

Verify editing an existing interaction loads the previous current notes.

**Status:** Planned

---

## TEST-060 — Unchanged Notes Persist

**Priority:** P0

Verify saving an interaction without changing its notes carries the notes into the new snapshot.

**Status:** Planned

---

## TEST-061 — Modified Notes Persist

**Priority:** P0

Verify changed notes are stored in the new snapshot.

**Status:** Planned

---

## TEST-062 — Previous Notes Preserved

**Priority:** P0

Verify previous snapshots retain their original notes.

**Status:** Planned

---

# 18. Current Interaction State

Related issue: **#28 — US-028 View Property Interactions (Current State)**

## TEST-063 — Current Snapshot Returned

**Priority:** P0

Verify the normal property interaction endpoint returns the current interaction state according to the API contract.

**Status:** Planned

---

## TEST-064 — Previous Snapshot Not Treated As Current

**Priority:** P0

Verify an older snapshot does not appear as the current interaction.

**Status:** Planned

---

## TEST-065 — No Normal History Timeline

**Priority:** P1

Verify MVP application behavior does not expose a normal user-facing historical interaction timeline.

Historical snapshots may remain in the database.

**Status:** Planned

---

# 19. Interaction Permissions

## TEST-066 — Representative Can Edit Own Interaction

**Priority:** P0

Verify a representative can modify their own interaction according to the finalized MVP rules.

**Status:** Planned

---

## TEST-067 — Manager View-Only Behavior

**Priority:** P0

Verify a manager cannot edit another representative's interaction when the finalized MVP rules make that interaction view-only.

**Status:** Planned

---

## TEST-068 — Administrator View-Only Behavior

**Priority:** P0

Verify an administrator cannot edit another representative's interaction when the finalized MVP rules make that interaction view-only.

**Status:** Planned

---

## TEST-069 — Cross-Organization Interaction Modification

**Priority:** P0

Verify no user can modify an interaction belonging to another organization.

**Status:** Planned

---

# 20. Interaction Deletion

## TEST-070 — No Interaction Delete

**Priority:** P0

Verify no MVP API or application workflow permits hard or soft deletion of interactions/snapshots.

**Status:** Planned

---

# 21. Local Drafts

Related issue: **#30**

## TEST-071 — Draft Creation

**Priority:** P1

Verify interaction data can be saved locally as a draft before successful server submission.

**Status:** Planned

---

## TEST-072 — Draft Restoration

**Priority:** P1

Verify an interrupted interaction can restore its local draft.

**Status:** Planned

---

## TEST-073 — Successful Save Clears Draft

**Priority:** P1

Verify successful server submission handles the corresponding local draft correctly.

**Status:** Planned

---

# 22. Network Failure and Retry

Related issue: **#44**

## TEST-074 — Failed Interaction Submission

**Priority:** P0

Verify a network failure does not silently lose the interaction data.

**Status:** Planned

---

## TEST-075 — Retry Successful

**Priority:** P0

Verify a failed interaction submission can be retried successfully.

**Status:** Planned

---

## TEST-076 — Retry Does Not Duplicate Group

**Priority:** P0

Verify retrying the same interaction does not accidentally create a duplicate interaction group.

**Status:** Planned

---

# 23. Validation and Error Handling

Related issue: **#43**

## TEST-077 — Required Field Validation

**Priority:** P0

Verify required API fields are enforced.

**Status:** Planned

---

## TEST-078 — Invalid Resource ID

**Priority:** P1

Verify invalid resource identifiers produce the expected error.

**Status:** Planned

---

## TEST-079 — Invalid Status

**Priority:** P1

Verify invalid status values are rejected.

**Status:** Planned

---

## TEST-080 — Consistent Error Response

**Priority:** P1

Verify API validation and application errors follow the finalized response contract.

**Status:** Planned

---

# 24. Reporting

Related issues: **#37–#39**

## TEST-081 — Activity Report

**Priority:** P1

Verify the activity report returns data according to the finalized reporting API.

**Status:** Planned

---

## TEST-082 — Date Range

**Priority:** P1

Verify report filtering correctly respects the requested date range.

**Status:** Planned

---

## TEST-083 — Status Grouping

**Priority:** P1

Verify activity can be grouped/counts can be produced by status according to the finalized rules.

**Status:** Planned

---

## TEST-084 — Representative Grouping

**Priority:** P1

Verify activity can be grouped/counts can be produced by representative according to the finalized rules.

**Status:** Planned

---

## TEST-085 — Revision Does Not Double Count

**Priority:** P0

Given:

```text
Interaction Group A
    Snapshot 1
    Snapshot 2
    Snapshot 3
```

verify reporting counts the interaction according to the finalized knock-counting rules rather than counting three rows as three knocks.

**Status:** Planned

---

## TEST-086 — Organization Reporting Isolation

**Priority:** P0

Verify reports cannot include data belonging to another organization.

**Status:** Planned

---

# 25. Regression Tests

Regression tests should be added whenever a defect is discovered.

Each regression test should document:

- The original failure.
- The expected behavior.
- The test that prevents recurrence.

Example:

```text id="xy3rcj"
BUG:
Editing an interaction created a second interaction group.

REGRESSION TEST:
TEST-051 / TEST-053

EXPECTED:
The existing interaction group is reused.
```

**Status:** Ongoing

---

# 26. End-to-End Workflows

## TEST-087 — Complete Organization Setup

**Priority:** P0

Verify:

```text
Register organization
    ↓
Authenticate administrator
    ↓
Configure organization
    ↓
Create/configure users
    ↓
Configure statuses
```

**Status:** Planned

---

## TEST-088 — Complete Representative Workflow

**Priority:** P0

Verify:

```text
Login
    ↓
Open map
    ↓
Select location/property
    ↓
Resolve property
    ↓
Create interaction
    ↓
Save interaction
    ↓
Return to property
    ↓
View current interaction
```

**Status:** Planned

---

## TEST-089 — Complete Interaction Revision Workflow

**Priority:** P0

Verify:

```text
Open existing property
    ↓
Load current interaction
    ↓
Load existing notes
    ↓
Change interaction
    ↓
Save
    ↓
Verify new current snapshot
    ↓
Verify previous snapshot remains preserved
```

**Status:** Planned

---

## TEST-090 — Cross-Organization Security Workflow

**Priority:** P0

Verify:

```text
Authenticate Organization A user
    ↓
Attempt Organization B resource
    ↓
Request rejected
```

**Status:** Planned

---

# 27. Manual QA Matrix

Automated testing does not replace manual testing.

The following areas should receive explicit manual QA before MVP presentation/release.

| Area                     | Manual QA Required | Reason                                                 |
| ------------------------ | ------------------ | ------------------------------------------------------ |
| Map usability            | Yes                | Touch interaction and real-world usability             |
| GPS/current location     | Yes                | Device/location behavior                               |
| Map movement/follow mode | Yes                | Real-world interaction                                 |
| Tablet layout            | Yes                | Target device experience                               |
| Daylight readability     | Yes                | Product-specific usability                             |
| Property selection       | Yes                | Touch precision and UX                                 |
| Interaction form         | Yes                | User workflow                                          |
| Local draft behavior     | Yes                | Real device interruption scenarios                     |
| Network loss/recovery    | Yes                | Real-world network conditions                          |
| Login/logout UX          | Yes                | User experience                                        |
| Reports                  | Yes                | Visual interpretation                                  |
| Browser compatibility    | Yes                | Environment coverage                                   |
| Accessibility            | Yes                | Human evaluation plus automated checks where available |

---

# 28. MVP Release Test Gate

The JoeKnock MVP should not be considered release-ready until:

### Automated

- [ ] All P0 tests are implemented.
- [ ] All P0 tests pass.
- [ ] Important P1 tests are implemented.
- [ ] `npm test` passes.
- [ ] No known critical security regression exists.
- [ ] Organization isolation tests pass.
- [ ] Interaction snapshot tests pass.
- [ ] Reporting does not double-count revisions.
- [ ] No-delete constraints are verified.

### Manual

- [ ] Core representative workflow completed manually.
- [ ] Interaction revision workflow completed manually.
- [ ] Map workflow tested on the target device/browser.
- [ ] Network failure/recovery manually tested.
- [ ] Local draft recovery manually tested.
- [ ] Role/visibility workflows manually verified.
- [ ] Final UI/UX review completed.

### Documentation

- [ ] Architecture documents are current.
- [ ] API documentation matches implementation.
- [ ] Database documentation matches implementation.
- [ ] Implementation plans are complete.
- [ ] Test matrix reflects actual automated coverage.
- [ ] Known limitations are documented.

---

# 29. Test Coverage Goal

The goal is not to maximize a single coverage percentage.

The goal is to achieve **high confidence in critical behavior**.

P0 business and security rules should have explicit automated tests.

P1 functional behavior should generally have automated coverage.

P2 behavior may be covered selectively based on risk.

Manual testing remains required for physical-device, visual, usability, and real-world interaction behavior.

Coverage reports should be used to identify untested areas, not as the sole measure of software quality.
