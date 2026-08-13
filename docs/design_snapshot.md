# JoeKnock - Product & Architecture Design Snapshot

> This document is a supporting design snapshot.
>
> It is not the authoritative implementation contract.
>
> For current implementation decisions, use:
>
> 1. `docs/api_endpoints.md` and `docs/table_Schema_decisions.md`
> 2. `docs/implementation/foundation/project-foundation-spec.md`
> 3. `docs/Architecture_Decision_Record.md`
> 4. `docs/implementation/tickets/`
>
> Some wording in this snapshot may describe historical or conceptual alternatives and should not override the finalized MVP contracts.

## Overview

JoeKnock is a lightweight field interaction platform designed for organizations that rely on teams working directly with people in the field.

The primary use case is door-to-door sales, but the platform is intentionally designed to support other field interaction workflows including:

- Community outreach
- HOA engagement
- Political canvassing
- Signature collection
- Field surveys
- Any location-based interaction

JoeKnock is not intended to replace a CRM.

Instead, JoeKnock focuses on the critical moment where an interaction happens. It allows field representatives to quickly capture accurate information, preserve a complete history of what occurred, and make that information available to the organization or downstream systems.

The philosophy:

> Capture the moment. Don't manage the lifecycle.

JoeKnock owns the field interaction. The organization's CRM owns everything that happens afterward.

---

# Product Vision

Organizations that rely on field teams often lose valuable information between the moment an interaction happens and when that information reaches the rest of the business.

JoeKnock gives field representatives a map-first workspace where they can quickly record the outcome of an interaction, add context, and immediately move to the next opportunity.

The goal is simple:

> Everything you need in the moment someone answers the door is at your fingertips.

A representative should be able to:

1. Find a property.
2. Capture what happened.
3. Add context if needed.
4. Save.
5. Move on.

No paper.

No delayed data entry.

No forgotten details.

Just:

> Knock. Click. Go.

---

# Core Product Principles

## 1. Capture the Moment, Not the Lifecycle

JoeKnock is not a CRM.

It intentionally does **not** manage:

- Sales pipelines
- Opportunities
- Revenue
- Appointments
- Lead ownership
- Customer lifecycle

Those systems already exist.

JoeKnock captures accurate field data and makes it available for those systems to consume.

---

## 2. The Representative Experience Comes First

If the representative cannot quickly record an interaction, the application has failed.

The application prioritizes:

- Speed
- Minimal typing
- Tablet-friendly design
- Large touch targets
- Shallow navigation
- Staying on the map

Every unnecessary click reduces adoption.

---

## 3. Organizations Own Their Data

Representatives create interactions.

Organizations own the data.

Organizations decide:

- Who can see interactions
- Which statuses exist
- How teams are organized

JoeKnock simply enforces those rules.

---

## 4. Preserve History

Every change to an interaction should be preserved.

JoeKnock never destroys historical information.

Instead, every save creates a new snapshot of the interaction.

This provides:

- Trust
- Accountability
- Historical reporting
- Troubleshooting capability

The MVP does not expose this history to users, but it exists internally.

---

# MVP Goals

The goal of the capstone MVP is not to build a complete SaaS platform.

The goal is to demonstrate:

- React frontend development
- Express backend development
- PostgreSQL relational database design
- Authentication
- REST API design
- CRUD operations
- Professional software architecture

---

# User Roles

JoeKnock contains three roles.

Roles determine administrative permissions and data visibility.

Roles do **not** determine whether someone can perform field work.

Everyone can knock.

---

## Sales Representative

Primary user.

Can:

- View map
- Record interactions
- View permitted property pins
- View permitted reports
- Manage profile

Visibility depends on organization settings.

---

## Manager

Managers have every capability of a representative.

Additionally they can:

- View assigned team activity
- Access team reporting
- Review interactions
- Manage teams where permitted

Managers can also perform field work.

---

## Administrator

Administrators have every capability available in JoeKnock.

They can:

- Perform field work
- Manage users
- Manage teams
- Configure organization settings
- Configure statuses
- View all organization data

Administrators are simply users with additional permissions.

---

# Navigation Design

## Main Navigation

JoeKnock intentionally uses shallow navigation.

The hamburger menu contains:

- Map
- Reports

Those are the two primary workspaces.

Administrative pages are intentionally separated from daily field work.

---

## User Menu

Selecting the user profile opens:

- Profile
- Users (Admin)
- Teams (Admin)
- Organization Settings (Admin)
- Logout

---

# Main User Experience

## Map-First Design

The map is the application.

Everything else supports the map.

```
------------------------------------------------

☰             JoeKnock             Corey ▼

------------------------------------------------


                FULL SCREEN MAP


------------------------------------------------
```

Requirements:

- Tablet optimized
- Daylight friendly
- Large touch targets
- Minimal navigation
- Representative location displayed

---

# Map Behavior

When the application loads:

- The representative's current location is displayed.
- The map centers on the representative.
- Existing property pins are displayed based on permissions.

Pins represent the **most recent interaction the current user is allowed to see**, not every historical interaction.

---

# Pin Visibility

Representative visibility is controlled by organization settings.

### Own

Representatives only see pins created from their own interactions.

---

### Team

Representatives see the latest interaction from users on their assigned teams.

---

### Organization

Representatives see the latest interaction for the organization.

---

Managers always see interactions for their assigned teams.

Administrators always see all interactions.

---

# Interaction Workflow

## Step 1

Representative opens the map.

---

## Step 2

Representative selects a property.

If the property already exists, the latest visible interaction loads.

If the representative cannot see an existing interaction because of visibility rules, the property appears as though it has never been visited.

The database still recognizes the property.

---

## Step 3

An interaction panel appears over the map.

The representative never leaves the map.

---

## Step 4

Representative updates or enters information.

Required:

- Status

Optional:

- Homeowner name
- Phone number
- Email
- Notes

---

## Step 5

Selecting **Save** never edits an existing interaction.

Instead:

A brand new interaction snapshot is created.

Previous interaction records remain unchanged.

The newest interaction becomes the interaction displayed on the property pin.

# Property Model

A property represents a physical location.

A property is **not** a lead.

A property is **not** a customer.

A property answers one question:

> Where did this interaction happen?

Example:

```
123 Main Street
Knoxville, TN
```

A property exists only once within an organization.

Multiple interactions may reference that same property over time.

Latitude and longitude are stored to position the property on the map, while the normalized address is used to determine whether the property already exists.

Properties are never deleted during normal operation.

---

# Property Matching

When a representative selects a location, JoeKnock determines whether the property already exists.

Matching priority:

1. Organization
2. Normalized Address

Latitude and longitude support mapping but are not considered the primary identifier because GPS coordinates can vary slightly between visits.

This prevents duplicate property records while allowing accurate mapping.

---

# Property Pins

A property pin represents the **latest interaction the current user has permission to view.**

The pin is **not** tied to a specific historical interaction.

Instead, JoeKnock determines which interaction should be displayed based on:

- Organization
- User role
- Visibility settings
- Team membership

Example:

```
Property

123 Main Street

History

Rep A
No Answer

Rep A
Not Interested

Rep A
Corrected Homeowner Name
```

The representative only sees the newest interaction they are allowed to access.

The previous interaction snapshots remain stored internally.

---

# Interaction Model

Interactions are the heart of JoeKnock.

Every interaction represents a complete snapshot of what was known at the moment the representative selected **Save**.

An interaction answers:

- Who recorded it?
- Where did it happen?
- What was the outcome?
- What information was known at that time?

An interaction belongs to:

- One organization
- One property
- One user

Unlike traditional CRUD applications, interactions are **append-only**.

Existing records are never modified.

---

# Interaction History

Every save creates a brand new interaction record.

Nothing is overwritten.

Example:

Day 1

```
Status:
No Answer

Homeowner:
Unknown
```

Day 4

Representative returns.

```
Status:
Not Interested

Homeowner:
John Smith
```

Rather than updating the first interaction, JoeKnock creates a second interaction containing the complete current state.

The first interaction remains untouched.

Later...

The representative realizes the homeowner's last name was entered incorrectly.

They correct it and save.

JoeKnock creates a third interaction.

The interaction history becomes:

```
Interaction 1

No Answer
Unknown Homeowner


↓

Interaction 2

Not Interested
John Smith


↓

Interaction 3

Not Interested
John Smyth
```

Each record is a complete snapshot in time.

No previous interaction is ever edited.

---

# Why Snapshot History?

This approach provides several benefits.

It preserves:

- Complete historical accuracy
- Reporting consistency
- Troubleshooting capability
- Data recovery

It also simplifies auditing because every interaction represents exactly what the representative believed at that moment.

---

# Status Snapshot Strategy

Statuses are configurable by each organization.

However...

Interaction records do **not** reference the current status definition.

Instead, JoeKnock stores the status text directly inside each interaction snapshot.

Example:

Status table today:

```
No Answer
Interested
Not Interested
```

Months later...

The administrator removes **Not Interested** from the available statuses.

Historical interaction records continue displaying:

```
Not Interested
```

This preserves reporting accuracy and historical context regardless of future administrative changes.

---

# Reporting Philosophy

JoeKnock reporting focuses on the **current state of properties**, not every historical interaction.

Example:

Monday

```
123 Main Street

No Answer
```

Wednesday

```
123 Main Street

Interested
```

If a report covers the entire week, the property should not appear twice.

Instead, the report returns the **latest interaction** for that property within the selected date range.

This prevents duplicate property counts while accurately reflecting the most current outcome.

Future versions may introduce additional historical reporting options.

---

# Team Model

Teams organize users.

A team contains users.

Users already have a role.

The team does **not** determine permissions.

The user's assigned role remains the single source of truth.

A user may belong to multiple teams.

Example:

```
Organization

Team A

Corey
Sarah
Mike


Team B

Corey
John
Ashley
```

Corey's role never changes.

If Corey is a Manager, he is a Manager everywhere.

If Corey is a Representative, he is a Representative everywhere.

This avoids conflicting permissions and simplifies administration.

---

# Organization Contact

Each organization stores a primary contact.

This information allows JoeKnock administrators or support staff to identify the appropriate business contact if needed.

Typical fields include:

- Contact Name
- Email
- Phone Number

This is not intended to be a CRM contact.

It simply identifies the primary administrator for the organization.

---

# Database Direction

The MVP database includes:

## organizations

Stores company ownership.

Includes:

- Organization information
- Primary contact information
- Business contact details

---

## organization_settings

Stores configurable organization behavior.

Examples:

- Representative visibility
- Future export preferences

---

## users

Stores authentication and user information.

Fields include:

- First Name
- Last Name
- Email
- Phone Number
- Password Hash
- Role
- Active Flag

Every user belongs to one organization.

Roles:

- ADMIN
- MANAGER
- REPRESENTATIVE

Roles determine permissions.

They do not determine whether a user can perform field work.

---

## teams

Stores organization-defined teams.

Teams are simply named collections of users.

Names do not have to be unique.

Teams are not deleted in MVP. Team membership relationships can be removed through the documented API behavior.

---

## team_users

Connects users to teams.

A user may belong to many teams.

A team may contain many users.

The user's role comes from the Users table, not this relationship.

---

## statuses

Stores organization-defined interaction statuses.

Fields include:

- Name
- Display Order
- Active Flag

Statuses can be reordered by administrators to control how they appear in the interaction form.

Historical interaction records are unaffected when statuses change.

# Interaction Model

An interaction represents the current known state of a property at the time it is saved.

Each interaction answers:

- Who recorded it?
- What property was involved?
- What was the outcome?
- What information was known at that moment?

Interactions are immutable snapshots.

Whenever a user changes any information on an interaction and presses Save, JoeKnock creates a brand-new interaction record.

Previous interaction records are never modified.

This preserves the complete evolution of a property's history while keeping implementation simple.

---

## Interaction Editing

Although users experience this as "editing" an interaction, the database never updates previous records.

Example:

Day 1

Property:
123 Main Street

Status:
No Answer

↓

Day 3

Representative returns.

Status changes to:

Interested

↓

Database:

Interaction #1
Status: No Answer

Interaction #2
Status: Interested

↓

Day 5

Representative notices the homeowner's name was misspelled.

Changes:

"Jon"

to

"John"

↓

Database:

Interaction #1
Status: No Answer

Interaction #2
Status: Interested
Homeowner: Jon

Interaction #3
Status: Interested
Homeowner: John

Every save creates a complete snapshot.

---

## Current State

The map never attempts to display every interaction.

Instead, JoeKnock determines:

"The newest interaction this user has permission to view."

That interaction becomes the property's current state.

Different users may therefore see different current interactions depending on organization visibility rules.

---

# Property Pins

Pins appear on the map only for properties that contain an interaction visible to the current user.

Examples:

Representative visibility = OWN

Rep A creates an interaction.

Rep B sees nothing for that property.

Rep B knocks the same house.

JoeKnock recognizes the property already exists and simply creates another interaction.

Both interactions now belong to the same property.

Each representative only sees the newest interaction they are allowed to see.

Managers and Administrators see the newest interaction across all accessible users.

Pins intentionally do not indicate status through color during the MVP.

Every pin uses the same appearance.

Selecting a pin opens the latest visible interaction.

---

# Reporting Philosophy

JoeKnock reporting separates knock counting from current/revision status reporting.

Knock count uses `initial_interaction_at` with one knock per `interaction_group_id`.

Current/revision status reporting uses `changed_at` and current-snapshot semantics.

Snapshot count is never treated as knock count.

Example:

Monday

123 Main Street
No Answer

Wednesday

123 Main Street
Interested

Weekly Report

Interested: 1

No Answer: 0

The report reflects the property's latest known outcome during the selected period.

Future versions may include historical trend reporting, but the MVP focuses on current operational visibility.

---

# Status System

Interaction statuses are configurable by each organization.

Administrators may:

- Create statuses
- Reorder statuses
- Rename statuses
- Disable statuses

Statuses appear in the interaction window in the administrator-defined order.

Disabled statuses cannot be selected for new interactions.

Historical interaction records are never modified.

Instead of storing only a status_id, each interaction stores a snapshot of the status text at the time it was saved.

Example:

Status Table

1 - No Answer

2 - Interested

3 - Appointment

Later...

Administrator deletes "Interested."

Historical interaction records still contain:

Interested

because the value was stored with the interaction snapshot.

This guarantees historical accuracy regardless of future status configuration changes.

---

# Reporting MVP

The MVP includes simple operational reporting.

Reports include:

- Current property status counts
- Representative activity counts
- Team activity summaries
- Date range filtering

Reports intentionally avoid CRM metrics such as:

- Sales pipeline
- Revenue
- Opportunity stages
- Closing percentages

Those belong in downstream CRM systems.

---

# Export Philosophy

JoeKnock owns field interaction capture.

External systems own the customer lifecycle.

Exports provide:

- Property information
- Latest interaction snapshot
- Representative
- Team
- Timestamp
- Notes

The receiving CRM determines:

- Lead ownership
- Appointment scheduling
- Pipeline progression
- Sales attribution

JoeKnock intentionally avoids making business ownership decisions.

---

# Future Roadmap Ideas

Not included in the MVP.

Potential future features:

## Historical Property Timeline

Display every interaction snapshot for a property.

## CRM Integrations

Direct synchronization with:

- Salesforce
- HubSpot
- Zoho
- Other CRMs

## Territory Management

Assign geographic territories to teams.

## Heat Maps

Visualize activity density across an area.

## Custom Organization Fields

Allow organizations to define additional interaction fields.

---

# Architecture Philosophy

Every feature should answer one question:

> Does this help capture the field interaction quickly and accurately?

If yes, it belongs in JoeKnock.

If it belongs after the interaction is complete, it likely belongs in the organization's CRM instead.

---

# Current Product Statement

JoeKnock is a lightweight field interaction platform that helps organizations capture critical information at the moment an interaction happens while keeping representatives focused on the work and providing decision makers with accurate operational visibility.

**Knock. Click. Go.**
