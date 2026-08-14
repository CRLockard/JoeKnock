# JoeKnock - Master Project Specification

Status: DRAFT - CONSOLIDATION FOR ARCHITECTURAL REVIEW

## Table of Contents

1. Product Vision & Purpose
2. MVP Scope
3. Users, Roles & Personas
4. Core Business Rules
5. Core User Workflows
6. Authorization Model
7. Visibility Model
8. Interaction / Knock Model
9. Reporting Semantics
10. Map Behavior
11. Property & Geocoding Architecture
12. Database Architecture
13. API Contract
14. Frontend Architecture
15. Backend Architecture
16. Security Architecture
17. Reliability & Idempotency
18. Testing Architecture
19. Implementation Roadmap
20. Deferred / Post-MVP
21. Architecture Decisions
22. Contradictions & Conflicts
23. Ambiguities / Missing Definitions
24. Decisions Required From Product Owner
25. Source Document Index
26. Executive Architecture Status

## 1. Product Vision & Purpose

- JoeKnock is a map-first field interaction platform for organizations with representatives working in physical neighborhoods and addresses. [CONSISTENT]
- The MVP focus is rapid, in-field interaction capture while staying on the map workflow. [CONSISTENT]
- JoeKnock is explicitly not a CRM replacement and does not own customer lifecycle management. [LOCKED]
- Core philosophy is to capture field interaction truth at the moment it occurs and preserve historical integrity internally. [CONSISTENT]

## 2. MVP Scope

### MVP Features

- JWT-authenticated, organization-scoped multi-user application.
- Organization, user, team, and status management.
- Map-first property selection and interaction capture.
- Backend-mediated property resolution and geocoding.
- Immutable interaction snapshots with current-state retrieval.
- Reporting and CSV export.

Status: [CONSISTENT]

### MVP Non-Goals

- CRM lifecycle capabilities (pipeline, opportunity, scheduling, revenue).
- Public geocoding/search APIs.
- User-facing historical interaction timeline.
- Map filters and map pin metadata (status/count/history overlays).

Status: [LOCKED]

### Deferred / Post-MVP

- US-022 map filtering by status/date.
- US-024 address search endpoint.
- US-025 dedicated geocoding cache subsystem.
- US-033 user-facing interaction history timeline.
- Additional roadmap deferred capabilities (advanced analytics/territory/integrations/scheduled exports/advanced auth infrastructure).

Status: [DEFERRED]

## 3. Users, Roles & Personas

### Representative

- Performs field interactions.
- Sees current interactions based on organization visibility setting.
- Can edit only interactions they own.

Status: [LOCKED]

### Manager

- Performs representative functions.
- Visibility depends on visibility setting plus team assignment.
- Can edit authorized team-member interactions in organization scope.
- Manager edits do not transfer interaction ownership.

Status: [LOCKED]

### Administrator

- Organization-wide visibility and edit authority inside organization scope.
- Can manage organization configuration and users.
- Admin edits do not transfer interaction ownership.

Status: [LOCKED]

### Organization

- Hard tenant boundary for all protected resources.

Status: [LOCKED]

### Teams

- Group users for visibility and management workflows.
- Teams do not define role identity.

Status: [LOCKED]

## 4. Core Business Rules

- Interaction ownership is representative-based per interaction group.
- interaction_group_id identifies organization + property + representative relationship.
- One representative can receive at most one knock per property.
- Different representatives can each receive one knock for the same property.
- Revisions never create additional knocks.
- Snapshot count is never knock count.
- initial_interaction_at is the knock timestamp and does not change.
- changed_at is revision/current chronology timestamp and changes with revisions.
- There is no interaction_at field in MVP.
- Interaction snapshots are immutable except controlled is_current transitions.
- Manager/admin edits do not transfer ownership.
- Organization isolation is a hard backend security boundary.

Status: [LOCKED]

## 5. Core User Workflows

### Initial Knock

- Representative selects/resolves property from map.
- If no group exists for organization+property+representative, create interaction_group_id and first snapshot.
- Set initial_interaction_at and changed_at.
- Snapshot becomes current.

Status: [LOCKED]

### Return Visit

- Same representative updates existing relationship by creating a new snapshot in same interaction_group_id.
- initial_interaction_at is preserved.
- changed_at updates.
- New snapshot becomes current.
- No additional knock is created.

Status: [LOCKED]

### Different Representative

- Different representative at same property creates separate interaction_group_id.
- Property remains reused; relationship is representative-specific.

Status: [LOCKED]

### Interaction Editing

- Representative edits own interactions only.
- Manager edits team-member interactions they are authorized to edit in org scope.
- Administrator edits any interaction in org scope.
- Manager/admin edits do not transfer ownership.

Status: [LOCKED]

### Map Workflow

- User remains map-first through property selection and interaction overlay workflow.
- Map reflects current authorized interaction/property state only.

Status: [LOCKED]

### Reporting

- Knock reporting uses initial_interaction_at, one knock per interaction_group_id.
- Current/revision/status reporting uses changed_at/current snapshot semantics.

Status: [LOCKED]

## 6. Authorization Model

### Authentication

- Protected endpoints require JWT bearer token.

Status: [LOCKED]

### Organization Isolation

- All resource reads/writes are constrained to authenticated organization.

Status: [LOCKED]

### Visibility

- Controlled by organization setting rep_visibility using canonical values:
  - own
  - team
  - organization

Status: [LOCKED]

### Edit Permission

- Separate from visibility.
- Representative: edit own only.
- Manager: edit authorized team-member interactions inside organization scope.
- Administrator: edit any interaction inside organization scope.

Status: [LOCKED]

### Interaction Edit Matrix

- Rep editing own interaction: allowed. [LOCKED]
- Rep editing another rep interaction: denied. [LOCKED]
- Manager editing authorized team-member interaction: allowed. [LOCKED]
- Admin editing any org interaction: allowed. [LOCKED]
- Manager/admin editing does not transfer ownership: required. [LOCKED]
- Cross-organization edit attempt: denied. [LOCKED]

## 7. Visibility Model

Canonical values and labels:

- own -> Only my interactions
- team -> My team's interactions
- organization -> Organization-wide interactions

Default:

- own

Behavior:

- own:
  - Reps see only own current interactions.
  - Managers see own plus assigned-team current interactions; if no assigned team, own only.
  - Admins see all current interactions in organization.

- team:
  - Reps see own current interactions plus current interactions owned by representatives on one of their teams.
  - Managers see/edit current interactions for assigned-team representatives plus own interactions.
  - Admins see/edit all in organization.

- organization:
  - All users can see all current interactions in organization.
  - Representatives may still edit only their own interactions.
  - Managers can edit interactions they can see, within role rules.
  - Admins can edit all interactions in organization.

Status: [LOCKED]

## 8. Interaction / Knock Model

Model elements:

- interaction_group_id is interaction relationship identity (organization + property + representative). [LOCKED]
- Snapshot rows are immutable historical states. [LOCKED]
- Exactly one current snapshot exists per interaction_group_id. [LOCKED]
- initial_interaction_at is first-knock timestamp for the relationship. [LOCKED]
- changed_at is snapshot chronology/current-state timestamp. [LOCKED]
- client_request_id is idempotency key only; not interaction identity. [LOCKED]

Required explicit answers:

1. When does a knock occur?

- At first snapshot creation for a representative/property relationship.

2. When does a return visit occur?

- When the same representative creates a revision snapshot in the existing group.

3. Does a revision create another knock?

- No.

4. Can two representatives each receive a knock for one property?

- Yes, through separate interaction groups.

5. What timestamp determines knock reporting?

- initial_interaction_at.

6. What timestamp determines revision/current chronology?

- changed_at with current-snapshot invariants.

7. What data represents historical changes?

- Immutable snapshot rows linked by interaction_group_id.

Status: [LOCKED]

## 9. Reporting Semantics

- Knock counts: one per interaction_group_id using initial_interaction_at.
- Revision snapshots do not create additional knocks.
- Status/current-state reporting: changed_at and current snapshot semantics.
- Report/export date interpretation and presentation use organization timezone; timestamps remain stored in UTC.
- dateFrom and dateTo are organization-local calendar dates and are both inclusive.
- Backend converts inclusive organization-local date boundaries to UTC for database querying.
- CSV interaction date semantics use changed_at for current/revision chronology export.

Status: [LOCKED]

## 10. Map Behavior

- MVP map is map-first with no filtering controls.
- No status/date/interaction-count/representative-count/snapshot-count map filters in MVP.
- One property pin appears when current user can see an interaction at that property.
- No pin metadata in MVP:
  - no status color
  - no status indicator
  - no interaction count
  - no representative count
  - no snapshot count
  - no historical marker overlays
- Historical snapshots never create additional pins.
- Multiple representative interaction groups at one property still render one pin.

Status: [LOCKED]

## 11. Property & Geocoding Architecture

- Properties are organization-scoped location records.
- Interactions are separate from properties.
- Property reuse prevents duplicates for same organization/location using normalized-address rules.
- Geocoding is backend-mediated through POST /api/properties/resolve.
- Public geocoding endpoints are not part of MVP.

Status: [LOCKED]

## 12. Database Architecture

Current documented MVP schema: 8 tables. [CONSISTENT]

- organizations
- organization_settings
- users
- teams
- team_users
- properties
- statuses
- interactions

Interaction table canonical fields include:

- id
- interaction_group_id
- property_id
- organization_id
- user_id
- status_id
- status_name
- initial_interaction_at
- changed_at
- changed_by
- is_current
- contact_name
- contact_phone
- contact_email
- notes
- client_request_id
- created_at

Critical invariants:

- Immutable snapshots.
- Exactly one current snapshot per interaction_group_id.
- initial_interaction_at preserved across revisions.
- client_request_id uniqueness for idempotent create/retry behavior when provided.
- Duplicate create requests with the same client_request_id reuse the original create result and do not create additional relationships or knocks.
- Idempotency key retention has no arbitrary expiration window in MVP.
- Deterministic current/latest selection uses changed_at DESC, then interaction snapshot id DESC.

Status: [LOCKED]

## 13. API Contract

Current documented inventory: 34 endpoints. [CONSISTENT]

Core contract highlights:

- POST /api/auth/register requires a client-supplied organization timezone (IANA identifier); registration does not infer or silently default timezone.
- POST /api/properties/resolve is the MVP geocoding/property resolution gateway.
- POST /api/properties/:propertyId/interactions supports interaction creation with idempotency key.
- POST /api/interactions/:id creates revision snapshots.
- GET /api/map/properties must return map data aligned with locked one-pin/no-pin-metadata behavior.
- GET /api/reports/activity and GET /api/exports/properties follow knock/status semantics and organization timezone interpretation.
- Authorization follows locked rep/manager/admin edit matrix and ownership-preservation rules.

Status: [LOCKED]

## 14. Frontend Architecture

- React + Vite baseline.
- Map-first route and interaction overlay workflow.
- Local interaction draft handling for network resiliency.
- No user-facing historical interaction timeline in MVP.
- No map filtering controls or contextual pin metadata in MVP.

Status: [LOCKED]

## 15. Backend Architecture

- Node.js + Express REST API.
- PostgreSQL via pg with node-pg-migrate.
- Middleware/service/repository style implementation guidance.
- Backend-enforced organization isolation, visibility, edit authorization, snapshot invariants, and idempotency.

Status: [LOCKED]

## 16. Security Architecture

- JWT bearer authentication.
- Argon2id password hashing.
- Organization isolation as hard security boundary.
- Authorization separate from authentication and separate from visibility.
- Input validation at backend boundary.
- Backend-mediated geocoding protection.

Status: [LOCKED]

## 17. Reliability & Idempotency

- client_request_id protects create/retry behavior from duplicates.
- Interaction identity remains interaction_group_id.
- Local drafts plus retry flows preserve field-capture reliability.

- Repeating the same interaction-create request with the same client_request_id must not create another interaction relationship or another knock.
- Duplicate client_request_id create retries reuse/return the original result.
- Idempotency key records are retained with interaction data.
- MVP does not introduce an arbitrary client_request_id expiration window.

Status: [LOCKED]

## 18. Testing Architecture

Required test coverage includes:

- One knock per representative/property relationship.
- Revision does not create another knock.
- Different representatives can each have one knock at same property.
- initial_interaction_at remains unchanged across revisions.
- changed_at changes on revision.
- Immutable snapshot behavior.
- Exactly one current snapshot per interaction group.
- Rep edit-own and deny-edit-other-rep.
- Manager edit authorized team-member interaction.
- Admin edit any interaction in organization.
- Manager/admin edits do not transfer ownership.
- Owner rep continues to see interaction after manager/admin edit.
- Organization isolation.
- own/team/organization visibility behavior, including manager with no team.
- organization visibility allows all users to see current interactions.
- Map one-pin-per-property behavior.
- No pin status/count semantics in MVP.
- No MVP map filtering.
- UTC storage + organization-timezone report/export behavior.
- Idempotent interaction creation/retry behavior.
- Inclusive organization-local date range behavior for report/export dateFrom/dateTo.
- Deterministic changed_at tie-breaking with interaction snapshot id DESC.

Status: [LOCKED]

## 19. Implementation Roadmap

Consolidated sequence:

1. Project foundation
2. Database foundation
3. Authentication foundation
4. Organization/user management
5. Team management and visibility
6. Property/geocoding infrastructure
7. Interaction engine
8. Reporting/export
9. Map/field workflow integration
10. End-to-end integration and hardening

Status: [CONSISTENT]

## 20. Deferred / Post-MVP

- US-022 map filtering.
- US-024 address search.
- US-025 geocoding cache subsystem.
- US-033 user-facing interaction history timeline.
- Additional advanced roadmap capabilities already marked deferred.

Status: [DEFERRED]

## 21. Architecture Decisions

- ADR-001 map-first UX.
- ADR-002 properties separate from interactions.
- ADR-003 not-a-CRM boundary.
- ADR-004 PostgreSQL relational model.
- ADR-005 teams organize users; roles define permissions.
- ADR-006 roles control access, not field capability.
- ADR-007 organization-defined statuses.
- ADR-008 immutable interaction snapshots.
- ADR-009 latest accessible current state.
- ADR-010 split knock/status reporting semantics.
- ADR-011 interaction visibility is permission-based.
- ADR-012 no-delete posture.
- ADR-013 export-oriented architecture.
- ADR-014 MVP scope discipline.
- ADR-015 history preserved internally, not user-facing in MVP.
- ADR-016 OSM/Nominatim backend-mediated geocoding.

Status: [CONSISTENT]

## 22. Contradictions & Conflicts

| Topic                                                 | Source A | Source B | Conflict | Impact | Needs Decision? |
| ----------------------------------------------------- | -------- | -------- | -------- | ------ | --------------- |
| None currently identified after locked-rule alignment | N/A      | N/A      | N/A      | N/A    | No              |

## 23. Ambiguities / Missing Definitions

| Topic                                                 | What is unclear | Where | Implementation Risk |
| ----------------------------------------------------- | --------------- | ----- | ------------------- |
| None currently identified after locked-rule alignment | N/A             | N/A   | N/A                 |

## 24. Decisions Required From Product Owner

Only unresolved decisions not fully specified by current docs:

1. None currently identified in this final alignment pass.

Status: [CONSISTENT]

## 25. Source Document Index

Reviewed sources:

- docs/MASTER_PROJECT_SPEC.md
- docs/Architecture_Decision_Record.md
- docs/table_Schema_decisions.md
- docs/api_endpoints.md
- docs/user_stories.md
- docs/testing/testing-strategy.md
- docs/testing/test-matrix.md
- docs/implementation/foundation/project-foundation-spec.md
- docs/implementation/implementation-spec-template.md
- docs/project_management_plan.md
- .github/copilot-instructions.md
- docs/product_requirements.md
- docs/project_vision.md
- docs/design_snapshot.md
- docs/frontend_wireframes.md
- docs/implementation/foundation/decision-summary.md
- docs/implementation/tickets/US-001-register-organization.md
- docs/implementation/tickets/US-002-login.md
- docs/implementation/tickets/US-003-logout.md

## 26. Executive Architecture Status

What is clearly locked:

- Ownership and interaction-group semantics.
- One-knock-per-representative/property rule.
- Immutable snapshots and current-state model.
- initial_interaction_at and changed_at semantics.
- own/team/organization visibility values.
- Manager/admin edit authority with ownership preservation.
- No MVP map filtering and no pin contextual metadata.
- Backend-mediated geocoding and organization isolation.
- UTC storage with organization-timezone reporting/export interpretation.

What is consistently documented:

- Core stack, schema baseline, API domain layout, and phased roadmap.

What is conflicted:

- No remaining major product/architecture conflicts after this reconciliation pass.

What is unresolved:

- None currently identified in this final alignment pass.

Is documentation currently safe as implementation source of truth:

- Yes.

Smallest clarifications still needed:

1. None currently identified in this final alignment pass.
