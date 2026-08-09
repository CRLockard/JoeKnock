# JoeKnock MVP — Final Database Schema

This document defines the canonical database schema for the JoeKnock MVP.

## Tables

The MVP contains 8 tables:

1. `organizations`
2. `organization_settings`
3. `users`
4. `teams`
5. `team_users`
6. `properties`
7. `statuses`
8. `interactions`

There is no `interaction_activity_log` table. Immutable interaction snapshots provide the historical record.

---

## 1. `organizations`

Represents a customer/company using JoeKnock.

| Column                  | Type         | Constraints      | Description                     |
| ----------------------- | ------------ | ---------------- | ------------------------------- |
| `id`                    | UUID         | PK               | Organization identifier         |
| `name`                  | VARCHAR(255) | NOT NULL         | Organization name               |
| `slug`                  | VARCHAR(100) | NOT NULL, UNIQUE | URL/application-safe identifier |
| `billing_address_line1` | VARCHAR(255) | NULL             | Billing address                 |
| `billing_address_line2` | VARCHAR(255) | NULL             | Billing address                 |
| `billing_city`          | VARCHAR(100) | NULL             | Billing city                    |
| `billing_state`         | VARCHAR(100) | NULL             | Billing state                   |
| `billing_postal_code`   | VARCHAR(20)  | NULL             | Billing ZIP/postal code         |
| `billing_country`       | VARCHAR(100) | NULL             | Billing country                 |
| `created_at`            | TIMESTAMP    | NOT NULL         | Creation timestamp              |
| `updated_at`            | TIMESTAMP    | NOT NULL         | Last modification timestamp     |

---

## 2. `organization_settings`

Stores organization-specific JoeKnock configuration.

One organization has one settings record.

| Column            | Type        | Constraints                             | Description                      |
| ----------------- | ----------- | --------------------------------------- | -------------------------------- |
| `id`              | UUID        | PK                                      | Settings identifier              |
| `organization_id` | UUID        | FK → organizations.id, UNIQUE, NOT NULL | Owning organization              |
| `rep_visibility`  | VARCHAR(30) | NOT NULL                                | `own`, `team`, or `organization` |
| `created_at`      | TIMESTAMP   | NOT NULL                                | Creation timestamp               |
| `updated_at`      | TIMESTAMP   | NOT NULL                                | Last modification timestamp      |

### `rep_visibility`

Allowed values:

- `own` — rep sees only their own interactions
- `team` — rep sees their team's interactions
- `organization` — rep sees organization-wide interactions

Managers and admins are subject to their role-based permissions in addition to these visibility rules.

---

## 3. `users`

Represents people belonging to an organization.

Users are soft-deleted/deactivated rather than physically removed.

| Column            | Type         | Constraints                     | Description                        |
| ----------------- | ------------ | ------------------------------- | ---------------------------------- |
| `id`              | UUID         | PK                              | User identifier                    |
| `organization_id` | UUID         | FK → organizations.id, NOT NULL | Organization                       |
| `first_name`      | VARCHAR(100) | NOT NULL                        | First name                         |
| `last_name`       | VARCHAR(100) | NOT NULL                        | Last name                          |
| `email`           | VARCHAR(255) | NOT NULL                        | Login email                        |
| `password_hash`   | VARCHAR(255) | NOT NULL                        | Hashed password                    |
| `role`            | VARCHAR(30)  | NOT NULL                        | User role                          |
| `is_active`       | BOOLEAN      | NOT NULL, DEFAULT TRUE          | Whether user can access the system |
| `created_at`      | TIMESTAMP    | NOT NULL                        | Creation timestamp                 |
| `updated_at`      | TIMESTAMP    | NOT NULL                        | Last modification timestamp        |
| `deactivated_at`  | TIMESTAMP    | NULL                            | When user was deactivated          |

### `role`

MVP roles:

- `rep`
- `manager`
- `admin`

---

## 4. `teams`

Represents an organizational team.

| Column            | Type         | Constraints                     | Description                 |
| ----------------- | ------------ | ------------------------------- | --------------------------- |
| `id`              | UUID         | PK                              | Team identifier             |
| `organization_id` | UUID         | FK → organizations.id, NOT NULL | Owning organization         |
| `name`            | VARCHAR(100) | NOT NULL                        | Team name                   |
| `created_at`      | TIMESTAMP    | NOT NULL                        | Creation timestamp          |
| `updated_at`      | TIMESTAMP    | NOT NULL                        | Last modification timestamp |

---

## 5. `team_users`

Junction table connecting users and teams.

This is a many-to-many relationship.

| Column       | Type      | Constraints      | Description                   |
| ------------ | --------- | ---------------- | ----------------------------- |
| `team_id`    | UUID      | PK/FK → teams.id | Team                          |
| `user_id`    | UUID      | PK/FK → users.id | User                          |
| `created_at` | TIMESTAMP | NOT NULL         | Membership creation timestamp |

### Primary Key

Composite primary key:

`(team_id, user_id)`

This prevents the same user from being added to the same team more than once.

---

## 6. `properties`

Represents the physical property/address being canvassed.

A property can have many interactions.

| Column            | Type          | Constraints                     | Description                 |
| ----------------- | ------------- | ------------------------------- | --------------------------- |
| `id`              | UUID          | PK                              | Property identifier         |
| `organization_id` | UUID          | FK → organizations.id, NOT NULL | Owning organization         |
| `address_line1`   | VARCHAR(255)  | NOT NULL                        | Street address              |
| `address_line2`   | VARCHAR(255)  | NULL                            | Unit/apartment/etc.         |
| `city`            | VARCHAR(100)  | NOT NULL                        | City                        |
| `state`           | VARCHAR(100)  | NOT NULL                        | State                       |
| `postal_code`     | VARCHAR(20)   | NOT NULL                        | ZIP/postal code             |
| `country`         | VARCHAR(100)  | NOT NULL                        | Country                     |
| `latitude`        | DECIMAL(10,7) | NOT NULL                        | Geographic latitude         |
| `longitude`       | DECIMAL(10,7) | NOT NULL                        | Geographic longitude        |
| `created_at`      | TIMESTAMP     | NOT NULL                        | Creation timestamp          |
| `updated_at`      | TIMESTAMP     | NOT NULL                        | Last modification timestamp |

### Property Matching

The normalized address is the primary mechanism for matching a selected map location to an existing property.

Latitude/longitude are primarily used for:

- Map rendering
- Current-location functionality
- Geographic positioning
- Marker placement

The property itself is not permanently owned by a representative.

---

## 7. `statuses`

Organization-defined interaction statuses.

Statuses are configurable rather than hard-coded into the application.

| Column            | Type         | Constraints                     | Description                            |
| ----------------- | ------------ | ------------------------------- | -------------------------------------- |
| `id`              | UUID         | PK                              | Status identifier                      |
| `organization_id` | UUID         | FK → organizations.id, NOT NULL | Owning organization                    |
| `name`            | VARCHAR(100) | NOT NULL                        | Display name                           |
| `description`     | VARCHAR(255) | NULL                            | Optional description                   |
| `display_order`   | INTEGER      | NOT NULL                        | Ordering in UI                         |
| `is_active`       | BOOLEAN      | NOT NULL, DEFAULT TRUE          | Whether available for new interactions |
| `created_at`      | TIMESTAMP    | NOT NULL                        | Creation timestamp                     |
| `updated_at`      | TIMESTAMP    | NOT NULL                        | Last modification timestamp            |

Historical interaction snapshots preserve the status name used when the snapshot was created.

---

## 8. `interactions`

This is the core table of the JoeKnock MVP.

It represents an immutable interaction snapshot.

A property can have many interaction records.

Every time an interaction changes, a new row is created. The previous row is never modified.

| Column                   | Type         | Constraints                     | Description                                                      |
| ------------------------ | ------------ | ------------------------------- | ---------------------------------------------------------------- |
| `id`                     | UUID         | PK                              | Interaction snapshot identifier                                  |
| interaction_group_id     | UUID         | NOT NULL                        | Identifies the interaction history that this snapshot belongs to |
| `property_id`            | UUID         | FK → properties.id, NOT NULL    | Property interacted with                                         |
| `organization_id`        | UUID         | FK → organizations.id, NOT NULL | Organization                                                     |
| `user_id`                | UUID         | FK → users.id, NOT NULL         | Rep who performed the interaction                                |
| `status_id`              | UUID         | FK → statuses.id, NOT NULL      | Status associated with snapshot                                  |
| `status_name`            | VARCHAR(100) | NOT NULL                        | Historical status name                                           |
| `initial_interaction_at` | TIMESTAMP    | NOT NULL                        | First-ever interaction date for this interaction history         |
| `interaction_at`         | TIMESTAMP    | NOT NULL                        | Date/time of field interaction represented by snapshot           |
| `changed_at`             | TIMESTAMP    | NOT NULL                        | When this snapshot was created                                   |
| `is_current`             | BOOLEAN      | NOT NULL, DEFAULT TRUE          | Whether this is the current snapshot                             |
| `contact_name`           | VARCHAR(255) | NULL                            | Contact name known at interaction                                |
| `contact_phone`          | VARCHAR(50)  | NULL                            | Contact phone known at interaction                               |
| `contact_email`          | VARCHAR(255) | NULL                            | Contact email known at interaction                               |
| `notes`                  | TEXT         | NULL                            | Interaction notes                                                |
| `created_at`             | TIMESTAMP    | NOT NULL                        | Record creation timestamp                                        |

---

# Interaction Snapshot Rules

## Rule 1 — Never update an existing interaction snapshot

If an interaction changes, create a new interaction snapshot.

```text
OLD interaction
      ↓
create NEW interaction snapshot

Rule 2 — initial_interaction_at never changes

Example:

First interaction:
initial_interaction_at = August 1
interaction_at         = August 1

Updated interaction:
initial_interaction_at = August 1
interaction_at         = August 5

The initial date remains August 1.

Rule 3 — changed_at represents the snapshot change

If the interaction is edited on August 6:

changed_at = August 6
Rule 4 — The latest snapshot becomes current

When a new snapshot is created:

old snapshot:
is_current = false

new snapshot:
is_current = true
Rule 5 — Historical snapshots are never deleted

The interactions table itself provides the historical record.

There is no interaction_activity_log table.

Relationships
organizations
    │
    ├────────────── organization_settings
    │
    ├────────────── users
    │                  │
    │                  └────── team_users ────── teams
    │
    ├────────────── properties
    │                  │
    │                  └────── interactions
    │                              │
    │                              ├──── users
    │                              │
    │                              └──── statuses
    │
    └────────────── statuses
Relationship Summary
Relationship	Type
Organization → Organization Settings	1 : 1
Organization → Users	1 : N
Organization → Teams	1 : N
Organization → Properties	1 : N
Organization → Statuses	1 : N
Users ↔ Teams	N : M
Property → Interactions	1 : N
User → Interactions	1 : N
Status → Interactions	1 : N
Tables Explicitly Excluded From the MVP
Excluded Table	Reason
interaction_activity_log	Immutable interaction snapshots already provide the historical record
follow_ups	Deferred CRM functionality
appointments	Deferred CRM functionality
reminders	Deferred functionality
notifications	Deferred functionality
lead_ownership	JoeKnock tracks field interactions, not permanent lead ownership
Final MVP Model
ORGANIZATION
     │
     ├── USERS ──────── TEAMS
     │     │              │
     │     └──────────────┘
     │
     ├── STATUSES
     │
     └── PROPERTIES
            │
            └── INTERACTIONS
                    │
                    ├── USER
                    ├── STATUS
                    ├── CONTACT SNAPSHOT
                    ├── INTERACTION DATE
                    └── HISTORY
Core Architectural Rule

A property is persistent. An interaction is historical. Every change to an interaction creates a new immutable snapshot.

This schema is the source of truth for the JoeKnock MVP database design.
```
