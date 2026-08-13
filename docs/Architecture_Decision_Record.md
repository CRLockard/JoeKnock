# JoeKnock - Architecture Decisions

## Purpose

This document records the major architectural decisions made during the design and development of JoeKnock.

The purpose of this document is to explain not only **what** decisions were made, but **why** they were made.

Good architecture is not only about choosing technologies. It is about understanding the problems being solved, considering alternatives, and making intentional tradeoffs.

---

# ADR-001: Map-First Application Design

**Status:** Accepted

## Decision

JoeKnock will use a map-first interface as the primary workspace for field interactions.

The map is not a secondary feature. It is the center of the representative workflow.

JoeKnock will use **Leaflet** for the map interface and **OpenStreetMap** map data for the MVP.

## Context

JoeKnock is designed for users actively moving through physical locations.

Traditional business applications often rely on:

- Lists
- Tables
- Search screens
- Multiple navigation steps

These workflows create unnecessary friction for users who need to quickly:

- Understand where they are
- Identify a property
- Record an interaction
- Continue moving

The application should keep representatives focused in the field rather than navigating through multiple screens.

## Alternatives Considered

### Traditional CRM-style list workflow

Rejected because:

- Adds unnecessary navigation
- Interrupts field work
- Does not match the user's physical workflow

### Commercial mapping platforms

Rejected for the MVP because they introduce unnecessary cost and commercial dependencies when Leaflet and OpenStreetMap satisfy the project's mapping requirements.

## Result

The representative begins with the map.

The map provides:

- Current user location
- Existing property pins
- Property selection
- Current property status
- Interaction entry
- Immediate return to field work

The MVP map stack is:

```text
React
  ↓
Leaflet
  ↓
OpenStreetMap
```

The application must provide appropriate OpenStreetMap attribution.

---

# ADR-002: Separate Properties From Interactions

**Status:** Accepted

## Decision

JoeKnock separates physical locations from the interactions that occur at those locations.

A property answers:

> Where did this happen?

An interaction answers:

> What happened?

## Context

A property exists independently of any individual interaction.

Example:

### Day 1

- Rep A visits
- No Answer

### Day 4

- Rep B visits
- Interested

The location did not change.

Only the interaction changed.

## Alternatives Considered

### Treat every interaction as its own property/lead

Rejected because:

- Creates duplicate addresses
- Loses historical continuity
- Makes reporting more difficult
- Does not reflect real-world behavior

## Result

Properties become permanent location records.

Interactions become the historical record of field activity.

A single property can therefore have multiple interaction groups belonging to different representatives.

---

# ADR-003: JoeKnock Is Not a CRM

**Status:** Accepted

## Decision

JoeKnock focuses on capturing field interactions and making that information available to downstream systems.

It intentionally does not manage the customer lifecycle.

## Context

Organizations frequently already own systems such as:

- Salesforce
- HubSpot
- AccuLynx
- JobNimbus
- ServiceTitan

These systems already solve:

- Lead ownership
- Sales pipelines
- Scheduling
- Opportunity management
- Revenue forecasting

JoeKnock solves a different problem:

> Capturing accurate information at the moment the interaction occurs.

## Alternatives Considered

### Build CRM functionality

Rejected because:

- Greatly increases scope
- Duplicates existing products
- Distracts from JoeKnock's purpose

## Result

JoeKnock owns:

- Field interactions
- Property data
- Representative activity
- Status outcomes
- Exportable field data

External CRMs own:

- Lead assignment
- Sales ownership
- Appointment scheduling
- Customer lifecycle
- Revenue

JoeKnock captures the moment.

The CRM owns everything afterward.

---

# ADR-004: PostgreSQL Relational Database

**Status:** Accepted

## Decision

JoeKnock will use PostgreSQL as its relational database.

## Context

JoeKnock manages highly related data including:

- Organizations
- Users
- Teams
- Properties
- Interactions
- Statuses
- Organization settings

Maintaining these relationships consistently is central to the application.

## Alternatives Considered

### MongoDB / Document Database

Rejected because:

- Relationships are a core part of the design
- Reporting requires relational queries
- Referential integrity is valuable
- PostgreSQL better supports future reporting needs

## Result

PostgreSQL provides:

- Strong relationships
- ACID compliance
- Reliable reporting
- Referential integrity
- Excellent scalability
- Familiarity with the project technology stack

---

# ADR-005: Teams Organize People, Roles Define Permissions

**Status:** Accepted

## Decision

JoeKnock separates **team membership** from **user roles**.

A user's role is stored on the User record and serves as the single source of truth.

Teams simply group users together.

## Context

Organizations frequently reorganize teams.

A manager may oversee multiple teams.

A representative may belong to multiple teams.

However, a user's application role should not be duplicated across team memberships.

## Alternatives Considered

### Store role on team membership

Rejected because:

- Creates multiple sources of truth
- Allows conflicting permissions
- Makes administration more error-prone

### Store manager_id on User

Rejected because:

- Limits flexibility
- Makes temporary coverage difficult
- Does not support multiple managers

## Result

Users contain:

- Role
- Authentication
- Identity

Teams contain:

- Groups of users

Permissions come from the User.

Visibility can be influenced by team membership.

---

# ADR-006: Roles Control Access, Not Field Capability

**Status:** Accepted

## Decision

Every authenticated user in JoeKnock can perform field interactions.

Roles determine **permissions and visibility**, not whether someone can use the map.

## Context

Managers frequently spend time in the field.

Administrators of smaller organizations may also knock doors.

Preventing them from using the application's primary workflow would create unnecessary restrictions.

## Role Responsibilities

### Administrator

Can:

- Perform field interactions
- View organization-wide accessible data
- Manage users
- Manage teams
- Manage statuses
- Configure organization settings
- View reports
- Export accessible data

### Manager

Can:

- Perform field interactions
- View interactions for accessible teams
- View reports for accessible teams
- Export accessible data

### Representative

Can:

- Perform field interactions
- View interactions based on organization visibility settings
- Export accessible data if permitted by the MVP role model

## Result

Everyone can knock.

Roles determine access to management features and data visibility.

---

# ADR-007: Organization-Defined Statuses

**Status:** Accepted

## Decision

Each organization defines its own interaction statuses.

JoeKnock does not provide a fixed workflow.

Statuses are displayed in the order defined by the organization.

Administrators can reorder statuses at any time.

## Context

Different organizations describe outcomes differently.

Examples:

### Roofing Company

- No Answer
- Interested
- Appointment Scheduled
- Estimate Given

### Political Campaign

- Supporter
- Opposed
- Undecided
- Not Home

### Community Outreach

- Contact Made
- Follow Up Needed
- Information Delivered

No universal status list exists.

## Alternatives Considered

### Hard-code statuses

Rejected because:

- Limits flexibility
- Forces organizations into one workflow

## Result

Organizations own their workflow.

JoeKnock captures it.

Historical interaction snapshots preserve the status text selected at the time of the interaction.

---

# ADR-008: Immutable Interaction Snapshots With Controlled Current-State Flag

**Status:** Accepted

## Decision

Interactions are stored as immutable snapshots.

Every interaction save creates a brand-new interaction record.

The existing interaction snapshot's data is never edited after creation.

The **one controlled exception** is the `is_current` field.

`is_current` may be changed when the current snapshot changes or when an authorized support/administrator user restores a previous snapshot.

## Context

A representative may return to the same property multiple times.

For the MVP, repeated work by the same representative continues the same interaction group.

Example:

```text
Rep A
Property 123

Aug 1 — No Answer
Aug 2 — Return
Aug 3 — No Answer
Aug 4 — Lead
```

Each save creates another snapshot.

The original records remain unchanged except that their `is_current` value may be changed to identify which snapshot represents the current state.

## Interaction Identity

Each interaction has:

- `id` — unique UUID for the snapshot
- `property_id` — physical property
- `interaction_group_id` — identifies the representative's interaction history with that property
- `user_id` — representative associated with the interaction
- `initial_interaction_at` — first interaction date for the group
- `changed_at` — timestamp for the snapshot
- `changed_by` — user who created the snapshot
- `is_current` — identifies the current snapshot for the interaction group

Snapshot identity and retry/idempotency identity are distinct in the MVP architecture:

- `id` remains the immutable snapshot identity.
- `client_request_id` is an optional client-supplied retry key used for duplicate-submission protection on create flows.

`client_request_id` is not the identity of the interaction snapshot.

## Interaction Groups

An `interaction_group_id` belongs to a specific **representative + property relationship**.

Example:

```text
Property 123

Rep A
└── Group A
    ├── Aug 1 — No Answer
    ├── Aug 2 — Return
    └── Aug 4 — Lead

Rep B
└── Group B
    ├── Aug 5 — No Answer
    └── Aug 7 — Interested
```

Rep A's history does not become Rep B's history.

Each group maintains its own current snapshot.

## Current Snapshot Rule

Each `interaction_group_id` must have exactly one:

```text
is_current = true
```

snapshot.

The current snapshot represents the latest authorized state for that interaction group.

## Restoration

Support/administrative functionality may restore an older snapshot by changing the `is_current` state.

For example:

```text
Snapshot 1
is_current = false

Snapshot 2
is_current = true
```

can become:

```text
Snapshot 1
is_current = true

Snapshot 2
is_current = false
```

The contents of either snapshot are never rewritten.

## Alternatives Considered

### Update interaction records in place

Rejected because:

- Destroys historical context
- Makes troubleshooting difficult
- Removes confidence in historical reporting

### Separate interaction activity-log table

Rejected for the MVP because every interaction snapshot already represents the complete state of the interaction.

Maintaining both would duplicate historical information.

## Result

The database preserves a complete snapshot history while still providing a simple mechanism for determining and restoring the current snapshot.

---

# ADR-009: Current State Is Derived From the Latest Accessible Snapshot

**Status:** Accepted

## Decision

Users normally see the newest interaction snapshot they are authorized to access.

Authorization and visibility filtering occur **before** determining the latest accessible snapshot.

## Context

A property may contain multiple interaction groups and many snapshots.

Example:

```text
Property 123

Rep A
└── Aug 1 — No Answer

Rep B
└── Aug 4 — Lead
```

If a representative only has access to their own interactions, they should not see Rep B's information.

## Visibility Process

```text
All interaction snapshots
        ↓
Apply organization + role + visibility rules
        ↓
Remove unauthorized snapshots
        ↓
Determine latest accessible snapshot
        ↓
Display current state
```

This prevents unauthorized information from influencing what another user sees.

## Result

The same property may appear differently to different users while the database maintains one complete historical record.

---

# ADR-010: MVP Reporting Uses Separate Knock and Status Rules

**Status:** Accepted

## Decision

JoeKnock MVP reporting uses two different rules:

1. **Knock count** is based on `initial_interaction_at`.
2. **Status counts** are based on `changed_at`.

These metrics are intentionally independent.

## Knock Count

A knock counts when the interaction group's `initial_interaction_at` falls within the selected reporting date range.

Each interaction group can contribute at most one knock to that range.

Later edits do not increase the knock count.

Example:

```text
Aug 1 — Initial interaction
Aug 2 — Edit
Aug 3 — Edit
Aug 4 — Edit
```

For Aug 1–4:

```text
Knocks = 1
```

## Status Count

Status reporting uses snapshots whose `changed_at` falls within the selected reporting range.

If an interaction group has multiple changes within the range, only the **latest snapshot within that range** determines the group's status count.

Example:

```text
Aug 1 — No Answer
Aug 2 — Return
Aug 3 — No Answer
Aug 4 — Lead
```

### Report: Aug 1–4

```text
Knocks: 1

Lead: 1
```

### Report: Aug 1–3

```text
Knocks: 1

No Answer: 1
```

### Report: Aug 4 only

```text
Knocks: 0

Lead: 1
```

A property whose initial knock occurred before the reporting period can still appear in status reporting if its interaction was changed during the selected period.

## Important Rule

`initial_interaction_at` has **no effect on status reporting**.

`changed_at` has **no effect on knock count**.

Timestamps are stored in UTC.

Reporting and export date interpretation/presentation use the organization's configured timezone.

## Result

Reports provide a snapshot of field activity and resulting state during the selected period without inflating totals because of repeated edits.

---

# ADR-011: Interaction Visibility Is Permission-Based

**Status:** Accepted

## Decision

Users only see interaction snapshots they are authorized to access.

Property visibility is determined by:

- User role
- Team membership
- Organization representative visibility settings

Visibility is applied before determining the latest accessible interaction.

## Representative Visibility Settings

Organizations configure representative visibility as:

### Own

Representatives see only their own interactions.

### Team

Representatives see interactions associated with their accessible team.

### Organization

Representatives see organization-wide interaction data.

## Managers

Managers see data associated with their accessible teams.

## Administrators

Administrators have organization-wide visibility.

## Example

Property 123:

```text
Rep A
└── No Answer

Rep B
└── Lead
```

With `own` visibility:

Rep A sees:

```text
No Answer
```

Rep B sees:

```text
Lead
```

An administrator sees:

```text
Lead
```

The database still contains both histories.

## Result

The same property can legitimately display different interaction information to different users without creating duplicate property records.

---

# ADR-012: Historical Status Preservation

**Status:** Accepted

## Decision

Interaction snapshots store the selected status as historical text in addition to the current status reference.

## Context

Organizations can edit their available statuses over time.

Example:

Current statuses:

1. No Answer
2. Not Interested
3. Estimate Given

Later, the administrator removes "Not Interested."

Historical interactions should continue displaying exactly what the representative selected at that moment.

## Alternatives Considered

### Foreign key only

Rejected because:

- Historical records could lose meaning
- Deleted statuses could break history
- Renaming statuses could unintentionally alter historical meaning

## Result

The Status table defines what representatives can currently choose.

The interaction snapshot preserves the actual status text selected at the time.

Historical meaning remains intact even when the organization's current workflow changes.

---

# ADR-013: Export-Oriented Architecture

**Status:** Accepted

## Decision

JoeKnock provides a basic CSV export for the MVP.

The export allows organizations to retrieve field data without requiring JoeKnock to become a CRM or build direct CRM integrations.

## MVP Export

The export contains:

- Address
- Contact/homeowner name
- Phone
- Current status
- Representative
- Interaction date

### Interaction Date Mapping

For MVP CSV export, `Interaction Date` maps to:

```text
changed_at
```

because the export includes the current status and represents when that current snapshot was recorded.

This does not change reporting semantics:

- `initial_interaction_at` remains the knock-count field.
- `changed_at` remains the status-timeline field.

## Export Workflow

```text
User applies report filters
        ↓
Reporting query
        ↓
Filtered accessible results
        ↓
Generate CSV
        ↓
Download
```

The export uses the same:

- Organization isolation
- Role permissions
- Representative visibility
- Date range
- Report filters

as the report being viewed.

## API

```http
GET /api/exports/properties
```

The export endpoint accepts the relevant report filters.

## Alternatives Considered

### Direct CRM integrations

Deferred because:

- Significantly increases MVP scope
- Requires integration-specific development
- Moves JoeKnock toward CRM ownership

### Scheduled exports

Deferred because they are unnecessary for validating the core workflow.

## Result

JoeKnock can demonstrate its export-oriented architecture while keeping the MVP implementation small.

---

# ADR-014: MVP Scope Discipline

**Status:** Accepted

## Decision

The MVP focuses exclusively on validating the core field interaction workflow.

Features that do not directly improve field data capture, basic reporting, or basic data export are intentionally deferred.

## Included in MVP

### Authentication and Organization

- Organization registration
- User authentication
- User management
- Roles
- Teams
- Organization settings

### Field Workflow

- Map-first interface
- Current representative location
- Property pins
- Property selection
- Property identification
- Interaction entry
- Local interaction drafts
- Immutable interaction snapshots
- Current-state display

### Property Management

- Property creation
- Property lookup
- Property updates
- Address normalization
- Geographic coordinates

### Statuses

- Organization-defined statuses
- Status ordering
- Status management

### Visibility

- Representative visibility settings
- Team visibility
- Organization-wide administrative visibility
- Organization isolation

### Reporting

- Date-range reporting
- Knock counts
- Status counts
- Representative/team filtering as applicable

### Export

- Basic CSV export
- Export based on active report filters

### Geocoding

- Reverse geocoding
- Backend-mediated Nominatim access
- Forward address search deferred/post-MVP

## Deferred Features

Examples include:

- CRM integrations
- Webhooks
- Territory management
- Heat maps
- Advanced analytics
- Gamification
- Customer lifecycle management
- Custom organization fields
- Billing and subscriptions
- Public API
- Scheduled exports
- Advanced export builders
- Customer-facing interaction history
- User-facing historical interaction timelines
- Geocoding cache infrastructure
- High-volume production geocoding infrastructure

## Result

The MVP demonstrates a complete, professionally designed application while remaining achievable within the capstone timeline.

---

# ADR-015: Historical Interaction Data Is Preserved but Not User-Facing in MVP

**Status:** Accepted

## Decision

JoeKnock will preserve complete interaction snapshot history in the database, but the MVP will not expose a customer-facing historical interaction timeline.

The MVP interface focuses on the current accessible state.

Historical snapshots exist primarily to:

- Preserve data integrity
- Support reporting
- Allow authorized support/admin investigation
- Allow restoration of a previous snapshot when necessary

## Context

The underlying interaction model intentionally preserves every snapshot.

However, exposing a full historical timeline to representatives and managers would add complexity that is not necessary to validate the core field workflow.

JoeKnock's MVP goal is to make field interaction capture fast and simple.

## User Experience

A representative selecting a property sees the latest interaction snapshot they are authorized to view.

They do not need to browse:

```text
Aug 1 — No Answer
Aug 2 — Return
Aug 3 — No Answer
Aug 4 — Lead
```

The interface instead displays:

```text
Current Status: Lead
```

## Administrative Recovery

Authorized support/administrative functionality may inspect historical snapshots when necessary.

For example, if a representative accidentally changes or removes important information, an administrator can identify the appropriate historical snapshot and restore it using the `is_current` mechanism.

## Alternatives Considered

### Expose full interaction history to representatives

Deferred because:

- Adds UI complexity
- Adds workflow complexity
- Is not required for the MVP's core value proposition

### Delete old snapshots

Rejected because:

- Destroys historical information
- Prevents recovery
- Reduces data integrity

## Result

History is preserved internally without burdening the representative workflow with historical data.

---

# ADR-016: OpenStreetMap Nominatim for MVP Geocoding

**Status:** Accepted

**Date:** 2026-08-09

## Context

JoeKnock is a map-first application. Representatives interact with properties directly from a map and need to identify properties with minimal manual data entry.

The MVP requires reverse geocoding for property resolution.

Forward address search remains deferred/post-MVP.

The MVP has a strict requirement to avoid introducing a paid geocoding service.

The geocoding provider should therefore:

- Be free to use for the MVP
- Support reverse geocoding for the MVP property workflow
- Provide sufficient address information for property creation
- Work with the React/Leaflet/OpenStreetMap architecture
- Avoid locking the frontend directly to a third-party provider
- Be replaceable if application usage grows

## Decision

JoeKnock will use **OpenStreetMap data through the Nominatim geocoding service** for geocoding during the MVP.

For MVP behavior, Nominatim is used through backend-managed property resolution.

The JoeKnock frontend will **not communicate directly with Nominatim**.

Requests will pass through the JoeKnock backend API.

```text
React / Leaflet
       │
       ▼
JoeKnock API
       │
        └── POST /api/properties/resolve
       │
       ▼
OpenStreetMap Nominatim
```

This keeps the external provider behind the application's API boundary and allows the provider to be replaced later without requiring major frontend changes.

## API Contract

MVP geocoding is internal to backend property resolution.

MVP does not expose public `/api/geocoding/*` endpoints.

Frontend geocoding-related behavior is performed through:

```http
POST /api/properties/resolve
```

## MVP Property Workflow

The primary MVP workflow is reverse geocoding.

```text
Representative selects map location
                │
                ▼
       Get latitude/longitude
                │
                ▼
POST /api/properties/resolve
                │
                ▼
        Nominatim lookup
                │
                ▼
        Normalized address
                │
          ┌─────┴─────┐
          │           │
        EXISTS      NOT FOUND
          │           │
          ▼           ▼
    Load property   Create property
          │           │
          └─────┬─────┘
                ▼
        Record interaction
```

## Property Identity Rule

The normalized address is used to determine whether an existing property can be reused.

The backend owns property identity.

The frontend does not independently decide whether two addresses represent the same property.

The general rule is:

> If the normalized address exists, use it. If it does not exist, create the property using the geocoded information.

## Cost

Nominatim is selected because the public service does not charge an API fee for use.

This satisfies the MVP requirement for a **$0 geocoding service cost**.

Free access does not mean unlimited access.

JoeKnock must comply with Nominatim's usage policies and service limitations.

## Usage Restrictions

The public Nominatim service has a stated usage policy that includes a maximum usage rate of approximately:

```text
1 request per second
```

JoeKnock must not intentionally exceed applicable usage limits.

The MVP should avoid unnecessary requests by:

- Only geocoding when necessary
- Reusing existing property records
- Avoiding repeated requests for the same property
- Avoiding bulk geocoding
- Avoiding geocoding while the user continuously moves the map
- Requesting reverse geocoding only after meaningful property/location selection

## Attribution

Because JoeKnock uses OpenStreetMap data, the application must provide appropriate attribution.

The map interface should include attribution such as:

```text
© OpenStreetMap contributors
```

The exact implementation will follow the attribution requirements applicable to the map and data services being used.

## Backend Proxy Decision

The frontend will not call Nominatim directly.

Instead:

```text
Frontend
    ↓
JoeKnock API
    ↓
Nominatim
```

This provides:

- Provider abstraction
- Central request validation
- Central rate limiting
- Central monitoring
- Easier provider replacement
- Reduced frontend coupling

## Caching

A dedicated geocoding cache is **not part of the MVP**.

The application does not need a separate geocoding cache because existing properties store their normalized address and coordinates.

Once a property has been identified and stored, JoeKnock can reuse the property record rather than repeatedly reverse-geocoding it.

A dedicated cache may be considered in a future production architecture if geocoding volume requires it.

## No Dedicated Geocoding Table

The MVP does not require a dedicated database table for geocoding.

Geocoding is treated as an external service used to obtain or translate location information.

Once an address is confirmed, the resulting information is stored in the existing:

```text
properties
```

table.

The `properties` table stores the property's address and geographic coordinates.

## Alternatives Considered

### Google Maps Platform

Rejected for the MVP because:

- Introduces a paid service dependency
- Requires billing/account configuration
- Does not satisfy the project's strict $0 geocoding requirement as cleanly as Nominatim

### Mapbox

Rejected for the MVP because:

- Introduces usage limits and potential costs
- Adds a commercial dependency
- Does not provide the simplest path to a $0 MVP

### Esri

Rejected for the MVP because:

- Commercial service
- More infrastructure than required
- Potential cost as usage grows

### OpenStreetMap Nominatim

Selected because:

- No API fee for the public service
- Uses OpenStreetMap data
- Supports reverse geocoding for the MVP property-resolution workflow
- Can support forward address search if that deferred feature is approved post-MVP
- Appropriate for low-volume MVP usage
- Works with the Leaflet/OpenStreetMap map architecture
- Avoids introducing a paid geocoding dependency

Disadvantages include:

- Public service usage limitations
- Attribution requirements
- Potential need for a different solution at production scale

## Consequences

### Positive

- No paid geocoding API is required for the MVP.
- The map-first workflow remains simple.
- The frontend remains independent of the provider.
- The provider can be replaced later.
- Existing properties can be reused without repeated geocoding.
- The solution fits the capstone scope and budget.

### Negative

- Nominatim's public service cannot be treated as an unlimited production API.
- Usage limits must be respected.
- Proper OpenStreetMap attribution is required.
- High-volume production use may require another solution.

## Future Migration Path

The JoeKnock API should remain stable even if the underlying provider changes.

Current:

```text
JoeKnock API
     ↓
Nominatim
```

Future:

```text
JoeKnock API
     ↓
Production Geocoding Provider
```

The frontend continues using:

```http
POST /api/properties/resolve
```

Potential future options include:

- Commercial geocoding provider
- Managed OpenStreetMap-based provider
- Self-hosted Nominatim
- Another compatible geocoding service

## Decision Summary

**JoeKnock MVP will use OpenStreetMap Nominatim behind backend-managed property resolution.**

All geocoding requests pass through the JoeKnock backend.

The MVP will not implement a dedicated geocoding cache.

The normalized address and coordinates are stored with the property, allowing existing properties to be reused without unnecessary external geocoding requests.

---

# Architecture Summary

JoeKnock's architecture is built around several core principles:

1. The map is the primary workspace.
2. Leaflet and OpenStreetMap provide the MVP map experience.
3. Properties represent permanent physical locations.
4. Interactions represent field activity associated with properties.
5. A representative's repeated work at a property belongs to the same `interaction_group_id` during the MVP.
6. Different representatives can have separate interaction groups for the same property.
7. Every interaction save creates a new historical snapshot.
8. Snapshot data is immutable except for the controlled `is_current` field.
9. Each interaction group has exactly one current snapshot.
10. `initial_interaction_at` determines knock-count eligibility.
11. `changed_at` determines status-reporting eligibility.
12. Reports collapse multiple changes within a range to the latest snapshot for each interaction group.
13. Users see only the latest snapshot they are authorized to access.
14. Visibility is applied before determining the latest accessible snapshot.
15. Teams organize people while user roles define permissions.
16. Organizations define their own statuses and workflow.
17. Historical status text is preserved inside interaction snapshots.
18. Full interaction history is preserved internally but is not exposed as a customer-facing timeline in the MVP.
19. Property identity is determined by the backend using normalized address data.
20. Existing normalized addresses are reused rather than creating duplicate properties.
21. Nominatim provides MVP reverse geocoding through backend-managed property resolution.
22. Geocoding requests pass through the JoeKnock backend.
23. No dedicated geocoding cache is required for the MVP.
24. JoeKnock provides basic CSV export using the active report filters.
25. Organization isolation and visibility rules apply to exports as well as normal application data.
26. JoeKnock is not a CRM and does not own the customer lifecycle.
27. The MVP intentionally prioritizes the core field workflow over advanced integrations and analytics.

The architecture intentionally keeps JoeKnock focused on one problem:

> **Capture the moment. Preserve the history. Deliver the data.**
