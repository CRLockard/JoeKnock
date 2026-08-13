# JoeKnock — Implementation Roadmap

> **Status:** Proposed
> **Purpose:** Define the engineering sequence for implementing the JoeKnock MVP.
> **Source of Truth:** This roadmap translates the approved architecture, schema, API contracts, user stories, testing strategy, and GitHub issues into an executable development plan.
>
> This document does **not** replace the Project Management Plan. The Project Management Plan defines how work is managed. This document defines **how the application will be built and in what order**.

---

# 1. Implementation Philosophy

JoeKnock will be developed as a professional software project rather than as a collection of independent features.

The implementation process follows:

```text
Approved Requirement
        ↓
Architecture / Design
        ↓
Implementation Plan
        ↓
GitHub Issue
        ↓
Implementation Specification
        ↓
Implementation
        ↓
Automated Tests
        ↓
Code Review
        ↓
Manual QA
        ↓
Completed Ticket
```

The implementation order is determined by **technical dependencies**, not simply by feature importance.

A feature should not be implemented until the foundation it depends upon exists.

---

# 2. Development Rules

## 2.1 One Ticket at a Time

Only one implementation ticket should normally be actively developed at a time.

The workflow is:

```text
Select next ready ticket
        ↓
Review ticket specification
        ↓
Implement
        ↓
Run targeted tests
        ↓
Run full test suite when appropriate
        ↓
Review implementation
        ↓
Manual QA
        ↓
Close ticket
        ↓
Move to next ticket
```

The next ticket should not begin until the current ticket has been reviewed and accepted.

---

## 2.2 Architecture Before Implementation

Copilot and other implementation tools must not independently redesign the application.

Implementation must follow:

- `docs/Architecture_Decision_Record.md`
- `docs/table_Schema_decisions.md`
- `docs/api_endpoints.md`
- `docs/user_stories.md`
- `docs/project_management_plan.md`
- `docs/testing/testing-strategy.md`
- `docs/testing/test-matrix.md`
- Individual implementation specifications

If implementation reveals a genuine architectural problem, implementation stops and the decision is reviewed before proceeding.

---

## 2.3 No Scope Creep

A ticket should implement only the functionality defined by that ticket.

Related functionality belongs in another ticket.

If implementation reveals that additional work is required:

1. Stop.
2. Document the dependency.
3. Determine whether an existing ticket covers it.
4. Create or modify a ticket if necessary.
5. Update the implementation plan if the dependency changes the roadmap.

---

# 3. Engineering Phases

The MVP will be implemented through the following phases:

```text
Phase 1 — Project Foundation
        ↓
Phase 2 — Database Foundation
        ↓
Phase 3 — Authentication Foundation
        ↓
Phase 4 — Organization & User Management
        ↓
Phase 5 — Team Management & Visibility
        ↓
Phase 6 — Property & Geocoding Infrastructure
        ↓
Phase 7 — Interaction Engine
        ↓
Phase 8 — Reporting & Export
        ↓
Phase 9 — Frontend Application Foundation
        ↓
Phase 10 — Map & Field Workflow
        ↓
Phase 11 — End-to-End Integration
        ↓
Phase 12 — Security, Hardening & MVP Validation
```

Some work within a phase may be performed in parallel in a larger team.

For the current single-developer project, the default approach is sequential implementation unless a dependency clearly allows otherwise.

---

# 4. Phase 1 — Project Foundation

## Goal

Establish the repository and development environment required for all subsequent work.

The application should be able to:

- Start the frontend.
- Start the backend.
- Connect to PostgreSQL.
- Run database migrations.
- Run automated tests.
- Follow the agreed repository structure.

## Primary Work

### US-046 — Establish Project Foundation Scaffold

This is the foundation ticket identified during the issue audit.

Expected work includes:

- React/Vite frontend scaffold
- Express backend scaffold
- PostgreSQL connection layer
- `pg` configuration
- `node-pg-migrate` configuration
- Vitest configuration
- Supertest configuration
- Playwright configuration
- Development scripts
- Application/server bootstrap
- Foundation documentation

## Exit Criteria

```text
Frontend starts
Backend starts
Database connection works
Migration system works
Test harness works
Repository structure is established
```

No business feature functionality should be implemented in this phase.

## Blocks

This phase blocks most subsequent implementation work.

---

# 5. Phase 2 — Database Foundation

## Goal

Implement the approved PostgreSQL data model and database invariants.

The database becomes the persistence foundation for the application.

## Tables

Implementation order:

```text
organizations
      ↓
organization_settings
      ↓
users
      ↓
teams
      ↓
team_users
      ↓
properties
      ↓
statuses
      ↓
interactions
```

## Required Schema Decisions

The database implementation must follow the finalized schema decisions:

- Organization-scoped email uniqueness
- Organization-defined statuses
- `statuses.description`
- Immutable interaction snapshots
- `interaction_group_id`
- `initial_interaction_at`
- `changed_at`
- `changed_by`
- `is_current`
- `client_request_id`
- Organization isolation
- Normalized property identity
- One current snapshot per interaction group

## Database Integrity

The implementation must enforce, where appropriate:

- Foreign keys
- Organization-scoped relationships
- Unique constraints
- Check constraints
- Partial unique indexes
- Required indexes
- Interaction current-state integrity
- Idempotency protection

Complex trigger logic should be avoided unless a constraint cannot safely enforce the required invariant.

## Migration Strategy

Migrations should be:

- Ordered
- Repeatable in development/test environments
- Independent of application seed data
- Safe to run from a clean database

## Exit Criteria

A clean database can be created entirely through migrations and satisfies the approved schema specification.

---

# 6. Phase 3 — Authentication Foundation

## Goal

Establish secure identity and authenticated request handling.

## Primary Capabilities

- User authentication
- Password hashing
- Login
- Logout
- Session/token handling
- Authentication middleware
- Authenticated request context

## Relevant Existing Issues

Existing authentication issues should be sequenced according to their actual dependencies.

The exact issue should not begin until:

- `users` exists
- Database access exists
- Backend foundation exists

## Security Requirements

Authentication implementation must establish patterns that later tickets reuse.

This includes:

- Password hashing
- Credential validation
- Authentication failure handling
- Token/session validation
- Protected API routes
- No password exposure in API responses

## Exit Criteria

A valid user can authenticate and an authenticated request can reliably identify:

```text
user
organization
role
```

---

# 7. Phase 4 — Organization & User Management

## Goal

Establish the organization-level SaaS structure.

## Capabilities

- Organization registration
- User creation
- User activation/deactivation
- User roles
- Organization settings
- Organization isolation

## Roles

The approved role model is:

```text
admin
manager
rep
```

Roles control access to management functionality and data.

Every authenticated user remains capable of performing the field workflow.

## Organization Isolation

Every organization-owned resource must be scoped to the authenticated user's organization.

This becomes a foundational security rule for all later APIs.

## Exit Criteria

A complete organization can be created and users can be securely associated with it.

---

# 8. Phase 5 — Team Management & Visibility

## Goal

Implement team organization and permission-based interaction visibility.

## Capabilities

- Team creation
- Team membership
- Multiple teams per user
- Team management
- Representative visibility settings
- Team-level visibility
- Organization-level visibility

## Canonical Visibility Values

```text
own
team
organization
```

## Architecture

Teams organize users.

Roles determine permissions.

Team membership influences visibility.

Roles are not duplicated onto team membership records.

## Exit Criteria

The application can correctly determine whether an authenticated user may access a particular organization's interaction data.

This authorization model must exist before reporting and interaction access are considered complete.

---

# 9. Phase 6 — Property & Geocoding Infrastructure

## Goal

Establish the property model and backend-mediated property resolution.

## Property Responsibilities

Properties represent physical locations.

They are independent from interactions.

Property identity is determined by:

```text
organization_id
+
normalized_address
```

## Geocoding

The MVP uses:

```text
Frontend
    ↓
POST /api/properties/resolve
    ↓
JoeKnock backend
    ↓
Nominatim
```

The frontend must not communicate directly with Nominatim.

## MVP Geocoding Scope

Included:

- Reverse geocoding
- Property resolution
- Existing property reuse
- Address normalization
- Geographic coordinates

Deferred:

- Public `/api/geocoding/*` endpoints
- Forward address search
- Dedicated geocoding cache
- High-volume geocoding infrastructure

## Exit Criteria

A selected map location can be resolved into a property without creating duplicate normalized-address records.

---

# 10. Phase 7 — Interaction Engine

## Goal

Implement JoeKnock's core business capability: recording field interactions.

This is the most important backend domain in the application.

## Interaction Model

A property may have multiple interaction groups.

An interaction group represents:

```text
organization + representative + property
```

The representative who created the interaction group remains the owner of that group.

Manager/admin edits do not transfer ownership, do not create a new relationship, and do not create a new knock.

Each save creates a new immutable snapshot.

Example:

```text
Property 123
    │
    ├── Rep A / Group A
    │      ├── Snapshot 1
    │      ├── Snapshot 2
    │      └── Snapshot 3 ← current
    │
    └── Rep B / Group B
           ├── Snapshot 1
           └── Snapshot 2 ← current
```

## Required Behavior

- Create new interaction
- Continue existing interaction group
- Create immutable snapshots
- Preserve historical status text
- Maintain `is_current`
- Prevent duplicate submission
- Preserve `initial_interaction_at`
- Record `changed_at`
- Record `changed_by`

## Idempotency

`client_request_id` exists specifically for retry/duplicate protection.

The interaction snapshot UUID remains the identity of the snapshot.

These concepts must not be conflated.

## Current Snapshot

Each interaction group must have exactly one current snapshot.

Creating a new snapshot should promote the new snapshot and demote the previous current snapshot atomically.

## Exit Criteria

The backend can safely create and retrieve interaction snapshots while preserving all approved historical and current-state invariants.

---

# 11. Phase 8 — Reporting & Export

## Goal

Provide the minimum operational visibility required by the MVP.

Reporting should be implemented after the interaction model and authorization model are stable.

## Reporting Rules

### Knock Count

Uses:

```text
initial_interaction_at
```

Each interaction group contributes at most one knock within the selected range.

### Status Count

Uses:

```text
changed_at
```

For each interaction group, only the latest snapshot within the reporting period determines the status count.

## Visibility

Authorization occurs before determining the latest accessible snapshot.

```text
All snapshots
      ↓
Organization isolation
      ↓
Role / team / visibility filtering
      ↓
Accessible snapshots
      ↓
Latest snapshot per group
      ↓
Report
```

## CSV Export

### US-047 — Export Activity Data as CSV

The export endpoint is:

```http
GET /api/exports/properties
```

The export uses the same:

- Organization isolation
- Authorization
- Visibility
- Report filters

as the corresponding reporting workflow.

The approved CSV interaction date is:

```text
changed_at
```

Reporting/export timezone rule:

- Timestamps are stored in UTC.
- Reporting and export date interpretation/presentation use the organization's configured timezone.

## Exit Criteria

A user can generate an authorized report and export the corresponding accessible data without violating organization or visibility boundaries.

---

# 12. Phase 9 — Frontend Application Foundation

## Goal

Establish the frontend structure required to consume the backend APIs.

## Capabilities

- Application routing
- Authentication state
- Protected routes
- API client
- Error handling
- Loading states
- Shared application state where required
- Base layout/navigation

The frontend should not begin implementing complex field workflow behavior until the required backend contracts exist.

## Exit Criteria

An authenticated user can enter the application and navigate through the major MVP areas using real API communication.

---

# 13. Phase 10 — Map & Field Workflow

## Goal

Implement JoeKnock's primary user experience.

The map is the center of the representative workflow.

## Map

- Leaflet integration
- OpenStreetMap tiles
- Required attribution
- Current user location
- Map positioning/follow behavior
- Property markers
- No map status/date filtering in MVP

## Property Interaction

The representative can:

```text
Select location
      ↓
Resolve property
      ↓
View property information
      ↓
Enter interaction
      ↓
Save interaction
      ↓
See current state
      ↓
Return to map
```

## Interaction Overlay

The interaction UI should minimize interruption to field work.

The map should lock appropriately while interaction information is being entered.

## Local Draft Protection

The MVP includes local interaction draft protection to reduce accidental loss of field data.

## Exit Criteria

A representative can complete the core JoeKnock workflow from map selection through interaction capture and return to field work.

---

# 14. Phase 11 — End-to-End Integration

## Goal

Verify that the independently implemented systems work together as one application.

## Primary Workflow

The MVP's primary end-to-end workflow is:

```text
Register organization
        ↓
Authenticate
        ↓
Open map
        ↓
Determine representative location
        ↓
Select property
        ↓
Resolve property
        ↓
Create interaction
        ↓
Return to property
        ↓
Create another snapshot
        ↓
View current accessible state
        ↓
Generate report
        ↓
Export data
```

## Testing

End-to-end tests should verify critical workflows rather than duplicate every unit/integration test.

Important E2E areas include:

- Authentication
- Organization isolation
- Property resolution
- Interaction capture
- Repeated interaction
- Visibility behavior
- Reporting
- Export

---

# 15. Phase 12 — Security, Hardening & MVP Validation

## Goal

Perform final validation before declaring the MVP complete.

## Security Review

Verify:

- Authentication
- Authorization
- Organization isolation
- ID manipulation protection
- Team isolation
- Interaction ownership
- Visibility filtering
- Export authorization
- Input validation
- Duplicate request handling
- Sensitive information exposure
- Error handling

## Database Review

Verify:

- Migrations work from a clean database
- Constraints work as expected
- Current snapshot invariant works
- Historical snapshots remain immutable
- Organization isolation is enforced
- Idempotency protection works

## MVP Scope Review

Confirm no deferred features have accidentally entered the MVP.

Deferred examples include:

- CRM integrations
- Webhooks
- Territory management
- Heat maps
- Gamification
- Advanced analytics
- Billing
- Public API
- Scheduled exports
- Advanced export builders
- Customer-facing historical timelines
- Dedicated geocoding cache

## Final Demonstration

The completed MVP should demonstrate:

```text
Authentication
      ↓
Organization
      ↓
Map
      ↓
Property
      ↓
Interaction
      ↓
Historical snapshot preservation
      ↓
Current state
      ↓
Reporting
      ↓
CSV export
```

---

# 16. GitHub Issue Mapping

The existing GitHub issues remain the execution mechanism.

Known architecture additions already created:

| Issue | Purpose                                        | Phase   |
| ----- | ---------------------------------------------- | ------- |
| #46   | Establish Project Foundation Scaffold          | Phase 1 |
| #47   | Export Activity Data as CSV                    | Phase 8 |
| #48   | Enforce Interaction Current-Snapshot Integrity | Phase 7 |

The remaining existing issues should be mapped into the phases above before implementation begins.

Issues should **not** be automatically implemented simply because they exist.

Each issue must be evaluated for:

- Correct phase
- Dependencies
- Scope
- Architecture alignment
- Testing requirements
- Implementation specification

If an issue does not fit the roadmap, it should be corrected before implementation.

---

# 17. Ticket Dependency Model

The expected high-level dependency chain is:

```text
US-046
Project Foundation
      │
      ├───────────────┐
      ↓               ↓
Database          Test Infrastructure
Foundation
      │
      ↓
Authentication
      │
      ↓
Organization / Users
      │
      ↓
Teams / Visibility
      │
      ├───────────────┐
      ↓               ↓
Properties       Interaction Engine
      │               │
      └───────┬───────┘
              ↓
        Reporting / Export
              │
              ↓
      Frontend Integration
              │
              ↓
       Map / Field Workflow
              │
              ↓
       End-to-End Testing
              │
              ↓
       Security / Hardening
```

This is the **engineering dependency model**, not necessarily a literal one-ticket-after-another sequence.

---

# 18. Implementation Specification Requirements

Every implementation ticket must have a corresponding implementation specification using the standard JoeKnock implementation template.

Each specification must define:

- Ticket information
- User story
- Objective
- Included scope
- Explicit exclusions
- Existing architecture
- Technical design
- API contract
- Data flow
- Business rules
- Security requirements
- Error handling
- Test requirements
- Test scenarios
- Implementation sequence
- Expected files
- Dependencies
- Implementation constraints
- Definition of Done
- Manual QA
- Known risks
- Open questions
- Copilot implementation notes
- Completion report

A ticket must not enter implementation while it contains unresolved blocking architecture or product decisions.

---

# 19. Ticket Lifecycle

Every implementation ticket follows:

```text
Backlog
   ↓
Planned
   ↓
Ready
   ↓
In Progress
   ↓
Review
   ↓
Done
```

### Planned

The work has been identified but may still require specification or dependency work.

### Ready

The ticket has:

- Clear scope
- Acceptance criteria
- Dependencies resolved
- Architecture resolved
- Implementation specification completed

### In Progress

The ticket is actively being implemented.

Only one ticket should normally be in progress for the current single-developer workflow.

### Review

Implementation is complete and awaiting:

- Automated test verification
- Code review
- Manual QA
- Documentation verification

### Done

The ticket has been implemented, tested, reviewed, and accepted.

---

# 20. Completion Reporting

Each completed ticket should produce a concise engineering update.

```text
Ticket:
US-XXX

Implemented:
- ...

Files Changed:
- ...

Tests Added:
- ...

Tests Run:
- ...

Manual QA:
- ...

Documentation:
- ...

Known Limitations:
- ...

Next Ticket:
US-XXX
```

This provides a running record of project progress and can also be used for class status updates.

---

# 21. Project Completion Definition

JoeKnock MVP is complete when:

### Architecture

- All MVP architecture decisions are implemented.
- No unresolved architectural contradictions remain.

### Database

- All MVP tables exist.
- Migrations work from a clean database.
- Required constraints and indexes are implemented.
- Interaction snapshot invariants are enforced.

### Backend

- Authentication works.
- Organization isolation works.
- Authorization works.
- Property resolution works.
- Interaction capture works.
- Reporting works.
- CSV export works.

### Frontend

- Authentication workflow works.
- Map-first workflow works.
- Property resolution works.
- Interaction capture works.
- Current accessible state is displayed correctly.
- Reporting interface works.

### Testing

- Required unit tests pass.
- Required integration/API tests pass.
- Required frontend tests pass.
- Critical E2E workflows pass.
- Security/organization-isolation tests pass.
- `npm test` passes.

### Documentation

- ADRs remain accurate.
- Schema documentation remains accurate.
- API documentation remains accurate.
- Implementation specifications reflect the final implementation.
- Project management documentation reflects actual project status.

### Scope

- MVP functionality is complete.
- Deferred functionality remains deferred unless explicitly approved.
- No unexplained architecture or feature additions remain.

---

# 22. Engineering Principle

The purpose of this roadmap is not to predict every line of code.

It is to establish a disciplined sequence for solving the engineering problem.

The project should continuously move from:

```text
Unknown
   ↓
Decision
   ↓
Specification
   ↓
Implementation
   ↓
Verification
   ↓
Known-good system
```

JoeKnock should be built incrementally so that every completed phase leaves the application in a more reliable and demonstrable state than before.

The goal is not simply to finish the MVP.

The goal is to demonstrate that the MVP was **engineered intentionally**.
