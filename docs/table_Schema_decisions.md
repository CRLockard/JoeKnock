# JoeKnock MVP — Final Database Schema

## Schema Overview

The JoeKnock MVP uses **8 relational tables**:

1. `organizations`
2. `organization_settings`
3. `users`
4. `teams`
5. `team_users`
6. `properties`
7. `statuses`
8. `interactions`

The MVP intentionally does **not** include:

- `interaction_activity_log`
- Follow-up tables
- Appointment tables
- Reminder tables
- Notification tables
- Territory tables
- CRM integration tables
- Customer lifecycle tables

Historical interaction data is preserved directly through immutable interaction snapshots.

---

# 1. organizations

Stores the organization that owns all JoeKnock data.

| Column       | Type         | Constraints | Description                     |
| ------------ | ------------ | ----------- | ------------------------------- |
| `id`         | UUID         | PK          | Unique organization identifier  |
| `name`       | VARCHAR(255) | NOT NULL    | Organization name               |
| `created_at` | TIMESTAMP    | NOT NULL    | Organization creation timestamp |
| `updated_at` | TIMESTAMP    | NOT NULL    | Last organization update        |

### Relationships

- One organization has many users.
- One organization has many teams.
- One organization has many properties.
- One organization has many statuses.
- One organization has one `organization_settings` record.
- One organization has many interactions.

---

# 2. organization_settings

Stores organization-specific configuration.

| Column            | Type         | Constraints          | Description                                    |
| ----------------- | ------------ | -------------------- | ---------------------------------------------- |
| `id`              | UUID         | PK                   | Unique settings identifier                     |
| `organization_id` | UUID         | FK, UNIQUE, NOT NULL | Owning organization                            |
| `rep_visibility`  | VARCHAR(50)  | NOT NULL             | Controls representative interaction visibility |
| `timezone`        | VARCHAR(100) | NOT NULL             | Organization timezone (IANA identifier)        |
| `created_at`      | TIMESTAMP    | NOT NULL             | Settings creation timestamp                    |
| `updated_at`      | TIMESTAMP    | NOT NULL             | Last settings update                           |

### `rep_visibility` values

The MVP supports:

- `own`
- `team`
- `organization`

Default:

- `own`

### Visibility behavior

**Own**

Representatives see only their own interaction history.

**Team**

Representatives see interactions associated with their team visibility.

**Organization**

Representatives see organization-wide interactions.

Managers and administrators have additional visibility based on their role.

Human-facing labels:

- `own` -> Only my interactions
- `team` -> My team's interactions
- `organization` -> Organization-wide interactions

### Timezone behavior

- `timezone` is required during `POST /api/auth/register` and is supplied by the client as an organization setting value.
- `timezone` must be a valid IANA timezone identifier.
- Registration does not infer timezone from server/browser/user location.
- Registration does not apply a silent default or hidden fallback timezone.
- The submitted registration timezone is stored in `organization_settings.timezone`.
- The organization timezone can later be changed through `PATCH /api/organization/settings`.
- All timestamps are stored in UTC.
- The organization `timezone` setting is authoritative for reporting and export date interpretation/presentation.

### Relationships

- Belongs to one organization.

---

# 3. users

Stores authenticated users.

| Column            | Type         | Constraints  | Description                   |
| ----------------- | ------------ | ------------ | ----------------------------- |
| `id`              | UUID         | PK           | Unique user identifier        |
| `organization_id` | UUID         | FK, NOT NULL | User's organization           |
| `email`           | VARCHAR(255) | NOT NULL     | Login email                   |
| `password_hash`   | TEXT         | NOT NULL     | Hashed password               |
| `first_name`      | VARCHAR(100) | NOT NULL     | User first name               |
| `last_name`       | VARCHAR(100) | NOT NULL     | User last name                |
| `role`            | VARCHAR(50)  | NOT NULL     | User's application role       |
| `is_active`       | BOOLEAN      | NOT NULL     | Whether the account is active |
| `created_at`      | TIMESTAMP    | NOT NULL     | Account creation timestamp    |
| `updated_at`      | TIMESTAMP    | NOT NULL     | Last account update           |

### Roles

The MVP supports:

- `admin`
- `manager`
- `rep`

### Important architecture rule

The user's role is stored on the `users` table.

Team membership does **not** determine role.

This provides one authoritative source for permissions.

### Email uniqueness

Email uniqueness is organization-scoped.

Canonical rule:

```text
UNIQUE (organization_id, lower(email))
```

The same email may exist in different organizations.

### Relationships

- Belongs to one organization.
- May belong to many teams through `team_users`.
- May create many interactions.

---

# 4. teams

Stores organizational teams.

| Column            | Type         | Constraints  | Description             |
| ----------------- | ------------ | ------------ | ----------------------- |
| `id`              | UUID         | PK           | Unique team identifier  |
| `organization_id` | UUID         | FK, NOT NULL | Owning organization     |
| `name`            | VARCHAR(255) | NOT NULL     | Team name               |
| `created_at`      | TIMESTAMP    | NOT NULL     | Team creation timestamp |
| `updated_at`      | TIMESTAMP    | NOT NULL     | Last team update        |

### Relationships

- Belongs to one organization.
- Contains many users through `team_users`.

A user may belong to multiple teams.

---

# 5. team_users

Junction table connecting users to teams.

| Column            | Type      | Constraints  | Description                       |
| ----------------- | --------- | ------------ | --------------------------------- |
| `organization_id` | UUID      | FK, NOT NULL | Organization scope for membership |
| `team_id`         | UUID      | PK, FK       | Team identifier                   |
| `user_id`         | UUID      | PK, FK       | User identifier                   |
| `created_at`      | TIMESTAMP | NOT NULL     | Membership creation timestamp     |

### Constraints

The combination of:

```text
team_id + user_id
```

must be unique.

Team membership must be organization-consistent.

The database should enforce that `team_users.organization_id` matches both the referenced team and the referenced user.

### Relationships

- A team has many users.
- A user can belong to many teams.

---

# 6. properties

Represents a physical location.

A property exists independently from any interaction.

| Column               | Type         | Constraints  | Description                                  |
| -------------------- | ------------ | ------------ | -------------------------------------------- |
| `id`                 | UUID         | PK           | Unique property identifier                   |
| `organization_id`    | UUID         | FK, NOT NULL | Owning organization                          |
| `address_line_1`     | VARCHAR(255) | NOT NULL     | Street address                               |
| `address_line_2`     | VARCHAR(255) | NULL         | Apartment/unit/etc.                          |
| `city`               | VARCHAR(100) | NOT NULL     | City                                         |
| `state`              | VARCHAR(100) | NOT NULL     | State                                        |
| `postal_code`        | VARCHAR(20)  | NOT NULL     | Postal/ZIP code                              |
| `country`            | VARCHAR(100) | NOT NULL     | Country                                      |
| `normalized_address` | TEXT         | NOT NULL     | Canonical address used for property matching |
| `latitude`           | DECIMAL      | NOT NULL     | Geographic latitude                          |
| `longitude`          | DECIMAL      | NOT NULL     | Geographic longitude                         |
| `created_at`         | TIMESTAMP    | NOT NULL     | Property creation timestamp                  |
| `updated_at`         | TIMESTAMP    | NOT NULL     | Last property update                         |

### Property Matching

`normalized_address` is the primary mechanism used to determine whether a property already exists.

When a representative identifies a location:

1. JoeKnock obtains the address.
2. The address is normalized.
3. JoeKnock checks whether that normalized address already exists for the organization.
4. If it exists, the existing property is used.
5. If it does not exist, a new property is created.

The system does **not** create a new property simply because a different representative visits the same location.

### Geocoding

The property stores the resulting address and coordinates.

Geocoding is performed through the JoeKnock backend using the MVP geocoding service defined in the geocoding ADR.

The frontend does not communicate directly with the geocoding provider.

### Relationships

- Belongs to one organization.
- Has many interactions.

---

# 7. statuses

Stores organization-defined interaction statuses.

| Column            | Type         | Constraints  | Description                                             |
| ----------------- | ------------ | ------------ | ------------------------------------------------------- |
| `id`              | UUID         | PK           | Unique status identifier                                |
| `organization_id` | UUID         | FK, NOT NULL | Owning organization                                     |
| `name`            | VARCHAR(100) | NOT NULL     | Status name                                             |
| `description`     | TEXT         | NULL         | Optional status description                             |
| `display_order`   | INTEGER      | NOT NULL     | Order displayed to representatives                      |
| `is_active`       | BOOLEAN      | NOT NULL     | Whether representatives can currently select the status |
| `created_at`      | TIMESTAMP    | NOT NULL     | Status creation timestamp                               |
| `updated_at`      | TIMESTAMP    | NOT NULL     | Last status update                                      |

### Status Behavior

Organizations define their own statuses.

Statuses may be:

- Created
- Renamed
- Reordered
- Deactivated

Historical interaction snapshots retain the status text that was selected at the time.

Therefore, historical records do not depend exclusively on the current Status record remaining active.

### Relationships

- Belongs to one organization.
- May be referenced by many interaction snapshots.

---

# 8. interactions

Stores the historical snapshots of field interactions.

This is the most important historical table in the MVP.

## Core Rule

An interaction record represents the state of a representative's interaction with a property at a particular point in time.

Interaction snapshots are **immutable except for `is_current`**.

The application does not edit an existing snapshot's interaction data.

When a representative changes an interaction, JoeKnock creates a new snapshot.

The previous snapshot remains unchanged except that `is_current` may be changed to indicate that it is no longer the current snapshot.

---

## Columns

| Column                   | Type         | Constraints  | Description                                                              |
| ------------------------ | ------------ | ------------ | ------------------------------------------------------------------------ |
| `id`                     | UUID         | PK           | Unique snapshot identifier                                               |
| `interaction_group_id`   | UUID         | NOT NULL     | Groups all snapshots for one representative/property interaction history |
| `property_id`            | UUID         | FK, NOT NULL | Property being interacted with                                           |
| `organization_id`        | UUID         | FK, NOT NULL | Owning organization                                                      |
| `user_id`                | UUID         | FK, NOT NULL | Representative who owns the interaction group                            |
| `status_id`              | UUID         | FK, NULL     | Status selected for this snapshot                                        |
| `status_name`            | VARCHAR(100) | NOT NULL     | Status text preserved at snapshot creation                               |
| `initial_interaction_at` | TIMESTAMP    | NOT NULL     | Date/time the representative first created the interaction group         |
| `changed_at`             | TIMESTAMP    | NOT NULL     | Date/time this snapshot was created                                      |
| `changed_by`             | UUID         | FK, NOT NULL | User responsible for creating this snapshot                              |
| `is_current`             | BOOLEAN      | NOT NULL     | Indicates the current snapshot for the interaction group                 |
| `contact_name`           | VARCHAR(255) | NULL         | Contact/homeowner name                                                   |
| `contact_phone`          | VARCHAR(50)  | NULL         | Contact phone number                                                     |
| `contact_email`          | VARCHAR(255) | NULL         | Contact email                                                            |
| `notes`                  | TEXT         | NULL         | Representative notes                                                     |
| `client_request_id`      | UUID         | NULL         | Optional retry/idempotency key for create requests                       |
| `created_at`             | TIMESTAMP    | NOT NULL     | Database record creation timestamp                                       |

---

# Interaction Groups

`interaction_group_id` is the key to understanding the interaction model.

An interaction group belongs to:

```text
ONE representative
+
ONE property
```

It represents that representative's ongoing interaction history with that property.

### Example

Rep A visits Property 123:

```text
interaction_group_id = GROUP-A
user_id = Rep A
property_id = Property 123
```

Rep A returns multiple times.

All of those snapshots remain in:

```text
GROUP-A
```

Rep B later visits the same property.

Rep B receives a different group:

```text
interaction_group_id = GROUP-B
user_id = Rep B
property_id = Property 123
```

Rep B's subsequent changes belong to `GROUP-B`.

Therefore:

```text
Property 123
│
├── Rep A
│   └── GROUP-A
│       ├── Snapshot 1
│       ├── Snapshot 2
│       ├── Snapshot 3
│       └── Snapshot 4
│
└── Rep B
    └── GROUP-B
        ├── Snapshot 1
        └── Snapshot 2
```

The property remains a single physical location.

Each representative maintains their own interaction history.

---

# Initial Interaction Date

`initial_interaction_at` is established when the representative first creates their interaction group.

It does not change when the interaction is edited.

Example:

```text
Aug 1
Rep A knocks
Status = No Answer

initial_interaction_at = Aug 1
```

The representative later edits the interaction:

```text
Aug 2
Status = Return
```

The new snapshot still contains:

```text
initial_interaction_at = Aug 1
```

This field is therefore the basis for the MVP's **knock count**.

---

# Changed Date

`changed_at` represents when the particular snapshot was created.

For the initial interaction:

```text
changed_at = initial snapshot creation time
```

For later edits:

```text
changed_at = time the new snapshot was created
```

This allows reporting to determine when a status state existed within a reporting period.

---

# Changed By

`changed_by` identifies the user responsible for creating the snapshot.

This preserves who performed the change without requiring a separate interaction activity-log table.

---

# Current Snapshot

Each interaction group has exactly one current snapshot.

The current snapshot is identified by:

```text
is_current = true
```

When an interaction is changed:

1. The existing snapshot remains intact.
2. A new snapshot is created.
3. The new snapshot becomes current.
4. The previous snapshot's `is_current` value is changed to `false`.

The historical interaction data itself is never overwritten.

### Support Recovery

Because previous snapshots remain available, support or administrative tooling can restore an older snapshot if necessary.

For example:

```text
Snapshot 1
Detailed notes

Snapshot 2
Rep accidentally deletes/corrects notes

Snapshot 3
Current version
```

A support administrator can identify the appropriate historical snapshot and restore it by changing which snapshot is current.

This capability is intended primarily for administrative/support use and is not a customer-facing historical editing workflow in the MVP.

---

# Status History

The `status_name` field is stored directly on every interaction snapshot.

This ensures historical records preserve the status exactly as it existed when the snapshot was created.

For example:

```text
Snapshot 1
status_id   = UUID-1
status_name = "No Answer"

Snapshot 2
status_id   = UUID-2
status_name = "Lead"
```

If an administrator later renames or deactivates a status, historical snapshots remain understandable.

---

# Interaction Snapshot Example

A representative visits a property four times.

### August 1

```text
Status: No Answer
```

Creates:

```text
Snapshot 1
initial_interaction_at = Aug 1
changed_at             = Aug 1
status_name            = No Answer
is_current             = true
```

### August 2

The homeowner answers, but the decision maker is not home.

```text
Status: Return
```

Creates:

```text
Snapshot 2
initial_interaction_at = Aug 1
changed_at             = Aug 2
status_name            = Return
is_current             = true
```

Snapshot 1 becomes:

```text
is_current = false
```

### August 3

No answer.

Creates:

```text
Snapshot 3
initial_interaction_at = Aug 1
changed_at             = Aug 3
status_name            = No Answer
is_current             = true
```

### August 4

Appointment/lead created.

```text
Status: Lead
```

Creates:

```text
Snapshot 4
initial_interaction_at = Aug 1
changed_at             = Aug 4
status_name            = Lead
is_current             = true
```

The earlier snapshots remain available.

The current state is:

```text
Lead
```

---

# Reporting Rules

The MVP uses two different concepts for reporting:

## 1. Knock Count

A knock counts when the interaction group's:

```text
initial_interaction_at
```

falls within the selected reporting range.

Example:

```text
Initial interaction: Aug 1
Report: Aug 1–4
```

Result:

```text
Knock Count +1
```

If the representative edits the interaction on Aug 2, Aug 3, and Aug 4, those edits do **not** create additional knocks.

The same interaction group remains one knock.

---

## 2. Status Counts

Status reporting uses the snapshot's:

```text
changed_at
```

field.

The initial interaction date does **not** determine whether a status appears in a report.

For a selected reporting period:

1. Find snapshots whose `changed_at` falls within the period.
2. Group snapshots by `interaction_group_id`.
3. If the same interaction group has multiple snapshots during the period, use only its **latest snapshot within that period**.
4. Count the status represented by that latest snapshot.

### Example

Interaction history:

| Date  | Status    |
| ----- | --------- |
| Aug 1 | No Answer |
| Aug 2 | Return    |
| Aug 3 | No Answer |
| Aug 4 | Lead      |

### Report: Aug 1–4

Latest snapshot during the period:

```text
Lead
```

Result:

```text
Lead: 1
No Answer: 0
Return: 0
```

The property is **not counted four times**.

### Report: Aug 1–3

Latest snapshot during the period:

```text
No Answer
```

Result:

```text
No Answer: 1
```

### Important distinction

If the interaction began before the reporting period but was changed during the reporting period:

```text
Initial interaction: July 28
Status changed to Lead: August 3
```

A report for:

```text
August 1–7
```

would show:

```text
Knock count: 0
Lead: 1
```

The interaction does not contribute to the August knock count because its initial interaction occurred in July.

It does contribute to the August status count because its snapshot was changed in August.

---

# Map Display Rules

The map does not display every historical interaction snapshot.

For normal users, the map displays the latest interaction state that the user is authorized to see.

Example:

```text
Rep A:
Aug 1 — No Answer

Rep B:
Aug 4 — Not Interested
```

An administrator viewing the map sees:

```text
Not Interested
```

The older Rep A interaction remains in the database and can be used for reporting/support purposes.

---

# Visibility

Interaction visibility is controlled by:

- User role
- Organization `rep_visibility`
- Team membership

The database retains the complete interaction history regardless of what a particular representative is allowed to see.

The MVP does not expose a customer-facing historical interaction timeline.

---

# Duplicate-Safe Interaction Creation

Interaction creation should support a client-generated request UUID.

This allows the API to safely identify a retry of the same client operation.

This is particularly important when a representative submits an interaction while experiencing an unreliable network connection.

The client can retry the request without unintentionally creating duplicate interaction records.

`client_request_id` is an idempotency key only.

It does not replace interaction snapshot identity.

`id` remains the unique identity of each immutable snapshot.

---

# Relationships

The interaction table relates to:

- `organizations`
- `properties`
- `users`
- `statuses`

The interaction group itself is not a separate table.

`interaction_group_id` is stored directly on interaction snapshots.

---

# Interaction Constraints

The database/application must enforce the following logical rules:

1. Every interaction belongs to one organization.
2. Every interaction belongs to one property.
3. Every interaction belongs to one representative.
4. Every interaction belongs to an `interaction_group_id`.
5. An interaction group represents one representative/property relationship.
6. `initial_interaction_at` never changes after the group is created.
7. Every edit creates a new interaction snapshot.
8. Historical interaction data is never overwritten.
9. Only `is_current` may be changed on an existing snapshot.
10. Each interaction group has exactly one current snapshot.
11. `changed_at` identifies when the current snapshot was created.
12. `changed_by` identifies who created that snapshot.
13. Historical status text is preserved in `status_name`.
14. A different representative creates a different interaction group for the same property.
15. No separate interaction activity-log table is required for the MVP.

---

# Database Enforcement (MVP)

The database should enforce organization-scoped relationships where practical, preferring composite foreign keys over triggers when they can enforce the rule cleanly.

## Organization-scoped relationship enforcement

Recommended enforcement approach:

1. Keep organization ownership columns on organization-owned records.
2. Use composite foreign keys for cross-table references that must remain in the same organization.
3. Use lightweight triggers only where cross-row invariants cannot be expressed by constraints/indexes alone.

Examples:

- `team_users.organization_id` must match both `teams.organization_id` and `users.organization_id`.
- `interactions.organization_id` must match related `properties`, `users`, and `statuses` records.

## Interaction group invariants

`interaction_group_id` is the explicit identity of one representative + one property relationship.

The database/application must enforce:

- Exactly one current snapshot per `interaction_group_id`.
- All snapshots in a group share the same `organization_id`.
- All snapshots in a group share the same `property_id`.
- All snapshots in a group share the same `user_id`.
- All snapshots in a group share the same `initial_interaction_at`.

There is no separate `interaction_groups` table in the MVP.

## Required/Recommended indexes and constraints

1. Partial unique index for current-snapshot invariant:

```text
UNIQUE (interaction_group_id) WHERE is_current = true
```

2. Partial unique index for idempotency key:

```text
UNIQUE (organization_id, client_request_id)
WHERE client_request_id IS NOT NULL
```

3. Do not treat this optional index as group identity:

```text
UNIQUE (organization_id, property_id, user_id)
WHERE is_current = true
```

It can be a defensive optimization in strict MVP semantics, but it is not the definition of `interaction_group_id` and can be redundant when group invariants are correctly enforced.

## Deterministic snapshot ordering

When selecting latest/current snapshots for reporting/current-state reads:

- Primary ordering: `changed_at DESC`
- Secondary deterministic tie-break: interaction snapshot `id DESC`

This ordering is required when two snapshots share the same `changed_at`.

## Reporting date-range interpretation

- `dateFrom` and `dateTo` are organization-local calendar dates.
- Both boundaries are inclusive.
- Query boundaries are converted to UTC before filtering persisted UTC timestamps.

## Immutability and atomicity guidance

Desired behavior:

- Inserts create new snapshots.
- Historical business fields are never rewritten.
- `is_current` may transition under controlled logic.
- Restoring an older snapshot changes current designation without rewriting historical business data.
- Promotion of a new current snapshot and demotion of the previous current snapshot occurs atomically.

Implementation guidance:

- Use a transaction in the service layer for create/revision/restore flows.
- Use the partial unique `is_current` index as a database backstop.
- Add lightweight immutability checks only where constraint/index support is insufficient.

---

# Entity Relationship Summary

```text
organizations
│
├── organization_settings
│
├── users
│   │
│   └── team_users
│           │
│           └── teams
│
├── properties
│   │
│   └── interactions
│           │
│           ├── users
│           └── statuses
│
└── statuses
```

More specifically:

```text
Organization
    │
    ├── Users
    │     └── Team Memberships
    │
    ├── Teams
    │
    ├── Organization Settings
    │
    ├── Properties
    │      │
    │      └── Interaction Groups
    │             │
    │             └── Interaction Snapshots
    │
    └── Statuses
```

---

# MVP Data Model Principles

The final MVP schema follows these principles:

1. **Properties represent physical locations.**
2. **Interactions represent field activity at those locations.**
3. **Interaction groups belong to one representative and one property.**
4. **Every interaction edit creates a new snapshot.**
5. **Historical snapshots are preserved.**
6. **Only `is_current` may be changed on a historical snapshot.**
7. **`initial_interaction_at` defines the knock date.**
8. **`changed_at` defines when a snapshot became part of the historical record.**
9. **Knock counts and status counts use different reporting rules.**
10. **The latest authorized snapshot drives the normal map display.**
11. **Historical interaction timelines are not exposed to customers in the MVP.**
12. **Organization-defined statuses are preserved historically through `status_name`.**
13. **Normalized address is the primary property matching mechanism.**
14. **Geocoding is an external service behind the JoeKnock API.**
15. **No separate interaction activity log is required.**
16. **Organizations isolate their data from other organizations.**
17. **Roles determine permissions while teams determine organizational grouping and visibility.**
18. **The schema supports exporting addresses, contact information, and representative information without requiring additional MVP tables.**

---

# MVP Export

The schema supports a simple export containing:

- Property address
- Contact name
- Contact phone
- Contact email
- Representative

The export does not require a dedicated export table.

The API can construct the export from the existing property and current interaction data.

---

# Final Table List

| Table                   | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `organizations`         | Organization ownership                     |
| `organization_settings` | Organization configuration and visibility  |
| `users`                 | Authentication, identity, and roles        |
| `teams`                 | User organization                          |
| `team_users`            | User/team relationships                    |
| `properties`            | Physical locations                         |
| `statuses`              | Organization-defined workflows             |
| `interactions`          | Immutable historical interaction snapshots |

This is the canonical MVP data model.
