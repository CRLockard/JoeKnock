# JoeKnock - Architecture Decisions

## Purpose

This document records the major architectural decisions made during the design and development of JoeKnock.

The purpose of this document is to explain not only **what** decisions were made, but **why** they were made.

Good architecture is not only about choosing technologies. It is about understanding the problems being solved, considering alternatives, and making intentional tradeoffs.

---

# ADR-001: Map-First Application Design

## Decision

JoeKnock will use a map-first interface as the primary workspace for field interactions.

The map is not a secondary feature. It is the center of the representative workflow.

---

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

The application should keep representatives focused on the field, not navigating software.

---

## Alternatives Considered

### Traditional CRM-style list workflow

Rejected because:

- Adds unnecessary navigation
- Interrupts field work
- Does not match the user's physical workflow

---

## Result

The representative begins with the map.

The map provides:

- Current user location
- Existing property pins
- Property selection
- Current property status
- Interaction entry
- Immediate return to field work

---

# ADR-002: Separate Properties From Interactions

## Decision

JoeKnock separates physical locations from the interactions that occur at those locations.

A property answers:

> Where did this happen?

An interaction answers:

> What happened?

---

## Context

A property exists independently of any individual interaction.

Example:

Day 1

- Rep A visits
- No Answer

Day 4

- Rep B visits
- Interested

The location did not change.

Only the interaction changed.

---

## Alternatives Considered

### Treat every interaction as its own property/lead

Rejected because:

- Creates duplicate addresses
- Loses historical continuity
- Makes reporting more difficult
- Does not reflect real-world behavior

---

## Result

Properties become permanent location records.

Interactions become the historical record of field activity.

---

# ADR-003: JoeKnock Is Not a CRM

## Decision

JoeKnock focuses on capturing field interactions and making that information available to downstream systems.

It intentionally does **not** manage the customer lifecycle.

---

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

Capturing accurate information at the moment the interaction occurs.

---

## Alternatives Considered

### Build CRM functionality

Rejected because:

- Greatly increases scope
- Duplicates existing products
- Distracts from JoeKnock's purpose

---

## Result

JoeKnock owns:

- Field interactions
- Property data
- Representative activity
- Status outcomes

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

## Decision

JoeKnock will use PostgreSQL as its relational database.

---

## Context

JoeKnock manages highly related data including:

- Organizations
- Users
- Teams
- Properties
- Interactions
- Organization settings

Maintaining these relationships consistently is central to the application.

---

## Alternatives Considered

### MongoDB / Document Database

Rejected because:

- Relationships are a core part of the design
- Reporting requires relational queries
- Referential integrity is valuable
- PostgreSQL better supports future reporting needs

---

## Result

PostgreSQL provides:

- Strong relationships
- ACID compliance
- Reliable reporting
- Excellent scalability
- Familiarity with the project technology stack

---

# ADR-005: Teams Organize People, Roles Define Permissions

## Decision

JoeKnock separates **team membership** from **user roles**.

A user's role is stored on the User record and serves as the single source of truth.

Teams simply group users together.

---

## Context

Organizations frequently reorganize teams.

A manager may oversee multiple teams.

A representative may belong to multiple teams.

However, a user's responsibility inside the application rarely changes.

If a person is a Manager, they are always a Manager.

Allowing role assignments inside individual teams introduces unnecessary complexity and opportunities for inconsistent permissions.

---

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

---

## Result

Users contain:

- Role
- Authentication
- Identity

Teams contain:

- Groups of users

Permissions come from the User.

Visibility comes from Team membership.

This creates one authoritative place to change permissions while allowing organizations to organize teams however they choose.

# ADR-006: Roles Control Access, Not Field Capability

## Decision

Every authenticated user in JoeKnock can perform field interactions.

Roles determine **permissions and visibility**, not whether someone can use the map.

---

## Context

Managers frequently spend time in the field.

Administrators of smaller organizations may also knock doors.

Preventing them from using the application's primary workflow would create unnecessary restrictions.

JoeKnock should support organizations where leadership actively participates in field work.

---

## Role Responsibilities

### Administrator

Can:

- Perform field interactions
- View every property and interaction
- Manage users
- Manage teams
- Manage statuses
- Configure organization settings
- View reports
- Export data

---

### Manager

Can:

- Perform field interactions
- View interactions for teams they belong to
- View reports for accessible teams

---

### Representative

Can:

- Perform field interactions
- View interactions based on organization visibility settings

---

## Result

Everyone can knock.

Roles only determine access to management features and data visibility.

---

# ADR-007: Organization-Defined Statuses

## Decision

Each organization defines its own interaction statuses.

JoeKnock does not provide a fixed workflow.

---

## Context

Different organizations describe outcomes differently.

Examples:

Roofing Company

- No Answer
- Interested
- Appointment Scheduled
- Estimate Given

Political Campaign

- Supporter
- Opposed
- Undecided
- Not Home

Community Outreach

- Contact Made
- Follow Up Needed
- Information Delivered

No universal status list exists.

---

## Additional Decision

Statuses are displayed in the order defined by the organization.

Administrators can reorder statuses at any time.

That order determines how they appear inside the interaction window.

---

## Alternatives Considered

### Hard-code statuses

Rejected because:

- Limits flexibility
- Forces organizations into one workflow

---

## Result

Organizations own their workflow.

JoeKnock simply captures it.

---

# ADR-008: Immutable Interaction Snapshots

## Decision

Interactions are immutable snapshots.

Every save creates a brand-new interaction record.

Existing interaction records are never modified.

---

## Context

A representative may return to the same property multiple times.

Example:

Monday

Rep visits.

Status:

No Answer

Thursday

Rep returns.

Status:

Not Interested

Friday

Rep realizes the homeowner's name was entered incorrectly.

The correction should **not** overwrite history.

Instead, JoeKnock creates another interaction snapshot representing the newest state.

This preserves a complete timeline of what the representative knew at each moment.

---

## Alternatives Considered

### Update interaction records in place

Rejected because:

- Destroys historical context
- Makes troubleshooting impossible
- Removes confidence in reporting

### Separate activity log table

Rejected for the MVP because every interaction snapshot already represents the complete state of the interaction.

Maintaining both would duplicate historical information.

---

## Result

Each interaction record becomes a complete historical snapshot.

Nothing is overwritten.

Nothing is deleted.

History is preserved naturally by creating new records.

---

# ADR-009: Current State Is Derived From The Latest Snapshot

## Decision

Although every interaction snapshot is preserved, users normally see only the newest snapshot they have permission to view.

---

## Context

Representatives should not need to browse historical timelines while working.

When a property is selected, JoeKnock displays the latest interaction visible to that user.

Example:

Snapshot 1

No Answer

Snapshot 2

Not Interested

Snapshot 3

Corrected Homeowner Name

The representative sees Snapshot 3.

Snapshots 1 and 2 remain in the database unchanged.

---

## Result

Current state is derived.

Historical records remain intact.

The interface stays simple while preserving complete history.

---

# ADR-010: Reporting Uses Current Property State

## Decision

The MVP reporting system reports against the latest interaction snapshot for each property within the selected date range.

---

## Context

A property may have multiple interaction snapshots.

Example:

Monday

No Answer

Wednesday

Interested

Friday

Corrected Phone Number

A report should not count the same property three times simply because multiple snapshots exist.

Instead, reporting should represent the property's most current state during the selected reporting period.

---

## Result

The MVP will include:

### Current Property Report

For each property:

- Find interaction snapshots inside the selected date range.
- If multiple snapshots exist for the same property, use only the most recent snapshot.
- Count statuses using that newest snapshot.

This prevents duplicate reporting while preserving full historical data for future analysis.

# ADR-011: Interaction Visibility Is Permission-Based

## Decision

Users only see the latest interaction snapshot they are authorized to access.

Property visibility is determined by both the user's role and the organization's representative visibility setting.

---

## Context

A property may contain many interaction snapshots created by different representatives.

Example:

Rep A

- No Answer

Rep B

- Interested

If the organization is configured for **Self** visibility, Rep B should not know Rep A previously visited the property.

Rep B will approach the property as a new interaction.

However, JoeKnock will still recognize that the property already exists internally and attach the new interaction snapshot to the existing property record.

The database preserves organization history.

The user interface only displays information the user has permission to view.

---

## Visibility Rules

### Representatives

Depending on organization settings:

- Only my interactions
- My team's interactions
- Entire organization

---

### Managers

Managers see interaction snapshots belonging to the teams they manage.

---

### Administrators

Administrators always have organization-wide visibility.

---

## Result

The same property may appear differently to different users while the database maintains one complete historical record.

---

# ADR-012: Historical Status Preservation

## Decision

Interaction snapshots store the status **as text** rather than depending solely on a foreign key to the Status table.

---

## Context

Organizations can edit their available statuses over time.

Example:

Current Statuses

1. No Answer
2. Not Interested
3. Estimate Given

Later, the administrator removes "Not Interested."

Historical interactions should continue displaying exactly what the representative selected at that moment.

Deleting or renaming a status should never change historical records.

---

## Alternatives Considered

### Foreign key only

Rejected because:

- Historical records could lose meaning
- Deleted statuses would break history
- Renaming statuses would rewrite historical data unintentionally

---

## Result

The Status table defines what representatives can currently choose.

Interaction snapshots preserve the actual status text that was selected when the interaction occurred.

History remains accurate even if organization workflows change.

---

# ADR-013: Export-Oriented Architecture

## Decision

JoeKnock is designed to move captured field data into external systems rather than become the system of record.

---

## Context

Organizations already have established business systems.

JoeKnock captures information immediately after an interaction and makes it available for downstream processing.

Lead ownership, scheduling, commissions, and customer management belong in the organization's existing software.

---

## Alternatives Considered

### Full CRM ownership

Rejected because:

- Significantly expands project scope
- Creates unnecessary duplication
- Moves away from JoeKnock's primary value

---

## Result

JoeKnock provides:

- Reliable interaction capture
- Historical property records
- Export-ready data
- Future API integration opportunities

Organizations decide what happens after the interaction.

---

# ADR-014: MVP Scope Discipline

## Decision

The MVP focuses exclusively on validating the core field interaction workflow.

Features that do not directly improve field data capture are intentionally deferred.

---

# ADR-XXX: Use OpenStreetMap Nominatim for MVP Geocoding

**Status:** Accepted

**Date:** 2026-08-09

## Context

JoeKnock is a map-first application. Representatives interact with properties directly from a map and need to be able to identify properties with minimal manual data entry.

The MVP requires two geocoding operations:

1. **Reverse geocoding**
   - Convert latitude and longitude into a street address.
   - Used when a representative selects a location or property on the map.

2. **Forward geocoding**
   - Convert an address into latitude and longitude.
   - Used when an address needs to be located on the map.

The MVP also has a strict requirement to avoid introducing a paid geocoding service.

The geocoding provider should therefore:

- Be free to use for the MVP.
- Support forward and reverse geocoding.
- Provide sufficient address information for property creation.
- Work with the React/Leaflet map architecture.
- Avoid locking the frontend directly to a third-party provider.
- Be replaceable if the application's usage grows beyond the provider's acceptable limits.

## Decision

JoeKnock will use **OpenStreetMap data through the Nominatim geocoding service** for geocoding during the MVP.

Nominatim will provide:

- Forward geocoding
- Reverse geocoding

The JoeKnock frontend will **not communicate directly with Nominatim**.

Instead, requests will go through the JoeKnock backend API.

```text
React / Leaflet
       │
       ▼
JoeKnock API
       │
       ├── GET /api/geocoding/reverse
       │
       └── GET /api/geocoding/search
       │
       ▼
OpenStreetMap Nominatim
```

This keeps the external service behind the application's API boundary and allows the geocoding provider to be replaced later without requiring major frontend changes.

## API Endpoints

### Reverse Geocoding

```http
GET /api/geocoding/reverse?lat={latitude}&lng={longitude}
```

Converts geographic coordinates into an address.

Example:

```text
GET /api/geocoding/reverse?lat=35.900000&lng=-84.000000
```

Expected result:

```json
{
  "address": {
    "addressLine1": "123 Main Street",
    "city": "Knoxville",
    "state": "TN",
    "postalCode": "37923",
    "country": "USA"
  },
  "coordinates": {
    "latitude": 35.9,
    "longitude": -84.0
  }
}
```

### Forward Geocoding

```http
GET /api/geocoding/search?address={address}
```

Converts an address into geographic coordinates.

Example:

```text
GET /api/geocoding/search?address=123 Main Street Knoxville TN
```

Expected result:

```json
{
  "results": [
    {
      "address": {
        "addressLine1": "123 Main Street",
        "city": "Knoxville",
        "state": "TN",
        "postalCode": "37923",
        "country": "USA"
      },
      "coordinates": {
        "latitude": 35.9,
        "longitude": -84.0
      }
    }
  ]
}
```

## MVP Map Workflow

The primary MVP workflow is reverse geocoding.

```text
Representative taps a property/location
                │
                ▼
       Get latitude/longitude
                │
                ▼
 GET /api/geocoding/reverse
                │
                ▼
        Nominatim lookup
                │
                ▼
          Address returned
                │
                ▼
     Does property exist?
          /           \
        YES            NO
         │              │
         ▼              ▼
  Load property    Create property
         │              │
         └──────┬───────┘
                ▼
        Record interaction
```

This supports the JoeKnock principle of minimizing manual data entry during a field interaction.

## Cost

Nominatim is selected because it does not charge an API fee for use of the public service.

This satisfies the MVP requirement that geocoding have a **$0 service cost**.

However, free access does not mean unlimited access.

The public Nominatim service has usage policies and capacity limitations. JoeKnock must comply with those requirements.

## Usage Restrictions

The public Nominatim service has a stated maximum usage rate of approximately:

```text
1 request per second
```

JoeKnock must not intentionally exceed this limit.

The application should avoid unnecessary requests by:

- Only geocoding when necessary.
- Avoiding repeated requests for the same coordinates/address.
- Caching geocoding results where appropriate.
- Avoiding bulk geocoding during the MVP.
- Not repeatedly geocoding while a user moves the map.
- Only requesting reverse geocoding after a meaningful property/location selection.

The MVP is expected to generate relatively low-volume, user-initiated geocoding requests, making this approach appropriate for the capstone.

## Attribution

Because JoeKnock uses OpenStreetMap data, the application must provide appropriate OpenStreetMap attribution.

The map interface should include attribution such as:

```text
© OpenStreetMap contributors
```

The exact implementation will follow the attribution requirements of the OpenStreetMap services being used.

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

This provides several benefits:

- Keeps the external provider abstracted from the frontend.
- Provides a central place for rate limiting.
- Provides a central place for caching.
- Allows request validation.
- Allows logging and monitoring.
- Makes it easier to replace Nominatim later.
- Prevents the frontend architecture from becoming tightly coupled to one provider.

## Caching

The MVP should cache successful geocoding results when practical.

For example, if the same property coordinates are repeatedly selected:

```text
First request
    ↓
JoeKnock API
    ↓
Nominatim
    ↓
Cache result
```

Future requests can use the cached result instead of making another external request.

Caching is particularly useful for reverse geocoding because a property's coordinates are unlikely to change.

The exact caching implementation may be deferred until the application requires it.

## No Dedicated Geocoding Table

The MVP does not require a dedicated database table for geocoding.

Geocoding is treated as an external service used to obtain or translate location information.

Once an address is confirmed, the resulting property information is stored in the existing:

```text
properties
```

table.

The `properties` table stores the property's address and geographic coordinates.

## Alternatives Considered

### Google Maps Platform

**Rejected for MVP**

Advantages:

- Mature geocoding platform
- Excellent address coverage
- Strong documentation
- Familiar tooling

Disadvantages:

- Introduces a paid service dependency.
- Requires billing/account configuration.
- Does not satisfy the MVP's strict $0 geocoding requirement as cleanly as Nominatim.

Google Maps may be reconsidered for a future production version if its additional capabilities justify the cost.

### Mapbox

**Rejected for MVP**

Advantages:

- Strong mapping ecosystem
- Good geocoding capabilities
- Excellent developer tooling

Disadvantages:

- Introduces usage limits and potential costs.
- Adds another commercial dependency.
- Does not provide the simplest path to a $0 MVP.

### Esri

**Rejected for MVP**

Advantages:

- Mature geospatial platform
- Strong geocoding capabilities

Disadvantages:

- Commercial service
- More infrastructure than required for the MVP
- Potential cost as usage grows

### OpenStreetMap Nominatim

**Selected**

Advantages:

- No API fee for the public service.
- Uses OpenStreetMap data.
- Supports forward and reverse geocoding.
- Appropriate for low-volume MVP usage.
- Works well with the Leaflet/OpenStreetMap map architecture.
- Avoids introducing a paid geocoding dependency during the capstone.

Disadvantages:

- Public service has strict usage limits.
- Must comply with Nominatim usage policy.
- Requires OpenStreetMap attribution.
- May not be appropriate for high-volume production usage.

## Consequences

### Positive

- JoeKnock can provide geocoding functionality without adding a paid API to the MVP.
- The map-first workflow can remain simple for representatives.
- The frontend remains independent of the geocoding provider.
- The provider can be replaced later.
- The architecture leaves room for caching and rate limiting.
- The solution fits the scope and budget of the capstone MVP.

### Negative

- Nominatim's public service cannot be treated as an unlimited production API.
- The 1-request-per-second policy must be respected.
- High-volume usage may eventually require a different solution.
- The application must provide proper OpenStreetMap attribution.
- A future production deployment may require a hosted geocoding service or self-hosted Nominatim infrastructure.

## Future Migration Path

If JoeKnock grows beyond the acceptable usage limits of the public Nominatim service, the backend geocoding interface should remain unchanged.

For example:

```text
Current:

JoeKnock API
     ↓
Nominatim


Future:

JoeKnock API
     ↓
Production Geocoding Provider
```

The frontend should continue using:

```http
GET /api/geocoding/reverse
GET /api/geocoding/search
```

without needing to know which external provider is being used.

Potential future options include:

- A commercial geocoding provider.
- A managed OpenStreetMap-based provider.
- Self-hosted Nominatim.
- Another compatible geocoding service.

## Decision Summary

**JoeKnock MVP will use OpenStreetMap Nominatim for forward and reverse geocoding.**

The service is selected because it satisfies the MVP's requirement for a **free geocoding solution**, supports the required map workflows, and works naturally with the Leaflet/OpenStreetMap architecture.

All geocoding requests will pass through the JoeKnock backend, and the implementation will respect Nominatim's usage limits and OpenStreetMap attribution requirements.

The geocoding provider remains replaceable so the MVP architecture does not prevent a future migration to a higher-capacity production service.

---

## Included in MVP

- Authentication
- Organizations
- Users
- Teams
- Organization-defined statuses
- Map-first interface
- Representative location
- Property selection
- Property pins
- Interaction snapshots
- Current property reporting
- Basic exports

---

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

---

## Result

The MVP demonstrates a complete, professionally designed application while remaining achievable within the capstone timeline.

---

# Summary

JoeKnock's architecture is built around several core principles:

1. The map is the primary workspace.
2. Properties represent permanent physical locations.
3. Interactions are immutable historical snapshots.
4. Every save creates a new snapshot—history is never overwritten.
5. Users see only the latest interaction they are permitted to access.
6. Teams organize people, while user roles define permissions.
7. Organizations define their own workflows through configurable statuses.
8. Historical records preserve the original status text, even if statuses change later.
9. Reporting focuses on the current property state rather than every historical snapshot.
10. JoeKnock captures the field interaction and hands the customer lifecycle to the organization's CRM.

These decisions intentionally keep JoeKnock focused on one problem:

> **Capture the moment. Preserve the history. Deliver the data.**
