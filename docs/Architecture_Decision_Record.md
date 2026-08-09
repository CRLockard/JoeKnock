# JoeKnock - Architecture Decisions

## Purpose

This document records the major architectural decisions made during the design and development of JoeKnock.

The purpose of this document is to explain not only **what** decisions were made, but **why** they were made.

Good architecture is not only about choosing technologies. It is about understanding the problems being solved, considering alternatives, and making intentional tradeoffs.

---

# ADR-001: Map-First Application Design

## Decision

JoeKnock will use a map-first interface as the primary workspace for field interactions.

The map is not a secondary feature. It is the center of the user workflow.

---

## Context

JoeKnock is designed for users actively moving through physical locations.

Traditional applications often rely on:

- Lists
- Tables
- Search screens
- Multiple navigation steps

These workflows create friction for users who need to quickly:

- Understand where they are
- Identify locations
- Capture an interaction
- Continue moving

---

## Alternatives Considered

### Traditional list-based workflow

Rejected because:

- Adds unnecessary navigation
- Does not match field workflows
- Slows down interaction capture

---

## Result

The user begins with the map.

The map provides:

- Current user location
- Property selection
- Interaction entry
- Existing property indicators
- Current property status

---

# ADR-002: Separate Properties From Interactions

## Decision

JoeKnock separates physical locations from interactions that occur at those locations.

A property represents:

> Where something happened.

An interaction represents:

> What happened during a field visit.

---

## Context

A single property may have many interactions over time.

Example:

Day 1:

- Rep A visits
- No Answer

Day 7:

- Rep B visits
- Not Interested

The property did not change.

The field interactions did.

---

## Alternatives Considered

### Treat each interaction as a new property record

Rejected because:

- Creates duplicate locations
- Makes historical reporting difficult
- Does not represent real-world behavior

---

## Result

Properties become stable location records.

Interactions preserve field activity history.

---

# ADR-003: JoeKnock Is Not a CRM

## Decision

JoeKnock will focus on field interaction capture and data delivery rather than managing the complete customer lifecycle.

---

## Context

Organizations often already use CRM systems.

JoeKnock solves a different problem:

> Capturing what happened in the field and delivering that information to downstream systems.

---

## Alternatives Considered

### Build CRM functionality

Rejected because:

- Expands scope significantly
- Duplicates existing products
- Distracts from JoeKnock's core purpose

---

## Result

JoeKnock owns:

- Field interactions
- Location data
- Rep activity
- Interaction outcomes

The organization's CRM owns:

- Lead ownership
- Sales pipeline
- Appointment management
- Revenue tracking
- Customer lifecycle

---

# ADR-004: PostgreSQL Relational Database

## Decision

JoeKnock will use PostgreSQL as its database system.

---

## Context

JoeKnock contains highly connected business data:

- Organizations
- Users
- Teams
- Properties
- Interactions
- Permissions

These relationships are central to the application.

---

## Alternatives Considered

### MongoDB / Document Database

Rejected for MVP because:

- Relationships are important
- Reporting requires relational queries
- Permissions require structured relationships

---

## Result

PostgreSQL provides:

- Data consistency
- Strong relationships
- Reliable reporting
- Clear ownership boundaries

---

# ADR-005: Team-Based Organization Structure

## Decision

JoeKnock will organize users through teams instead of direct manager relationships.

---

## Context

Organizations change frequently.

Managers may:

- Cover another team
- Share responsibility
- Temporarily oversee groups
- Participate in multiple teams

Direct manager relationships create unnecessary limitations.

---

## Alternatives Considered

### Store manager_id directly on users

Rejected because:

- Limits flexibility
- Creates difficult organizational changes
- Does not support multiple managers

---

## Result

Teams support:

- Multiple managers
- Multiple representatives
- Multiple team assignments
- Flexible organization structures

---

# ADR-006: Roles Control Access, Not Field Capability

## Decision

Every JoeKnock user can perform field interactions.

Roles determine permissions and visibility, not whether a user can knock doors.

---

## Context

Managers and administrators may participate directly in field work.

Restricting field functionality based on role creates unnecessary limitations.

---

## Role Responsibilities

### Administrator

Can:

- Perform field interactions
- Manage organization settings
- Manage users
- Manage teams
- Configure visibility
- View organization data

### Manager

Can:

- Perform field interactions
- View assigned team information
- Review team activity

### Representative

Can:

- Perform field interactions
- View information allowed by organization settings

---

## Result

Everyone can knock.

Roles determine access and visibility.

---

# ADR-007: Organization-Defined Statuses

## Decision

Organizations define their own interaction statuses.

---

## Context

Different organizations have different workflows.

Examples:

Roofing:

- No Answer
- Interested
- Appointment Scheduled

Political Campaign:

- Supporter
- Undecided
- Not Home

A fixed workflow would reduce adoption.

---

## Alternatives Considered

### Hard-coded statuses

Rejected because:

- Limits flexibility
- Prevents organizations from matching existing workflows

---

## Result

Statuses are configurable organization data.

---

# ADR-008: Interactions Are Immutable Field Events

## Decision

JoeKnock treats interactions as immutable field events.

A new field interaction creates a new interaction record.

Previous interactions are not overwritten.

---

## Context

JoeKnock exists to capture the moment a field interaction occurs.

Example:

Monday:

Rep A knocks.

Result:

- No Answer

Tuesday:

Rep B returns.

Result:

- Not Interested

Both interactions are valuable.

The organization may need to understand:

- Who interacted
- When it happened
- What occurred

---

## Alternatives Considered

### Update the existing interaction record

Rejected because:

- Removes historical accuracy
- Makes reporting difficult
- Cannot distinguish activity from edits

---

### Create a separate activity log table

Deferred because:

- The interaction history itself provides the MVP historical record
- Adds complexity without improving the core workflow

---

## Result

The interaction table is the historical source of truth.

The latest interaction determines the current displayed status for a property.

---

# ADR-009: Reporting Uses Field Events, Not Record Updates

## Decision

Reporting is based on meaningful field interactions rather than record modification dates.

---

## Context

A record can be updated without additional field activity occurring.

Example:

Day 1:

- Rep knocks
- No Answer

Day 3:

- Phone number is corrected

The representative did not knock again.

Counting the update as activity would create inaccurate reporting.

---

## Result

Reports measure:

Field activity:

- Interaction creation
- New outcomes from field visits

Not:

- Administrative corrections
- Data maintenance

---

# ADR-010: Historical Status Information Is Preserved

## Decision

Historical interactions preserve the status information captured at the time of the interaction.

---

## Context

Organizations may change their available statuses.

Example:

Today:

1. No Answer
2. Not Interested
3. Estimate Given

Tomorrow:

The administrator removes "Not Interested."

Historical interactions should still accurately represent what happened.

---

## Alternatives Considered

### Store only the current status reference

Rejected because:

- Deleted statuses could damage historical records
- Past interactions should not depend on current configuration

---

## Result

Historical interactions preserve their original meaning.

Future status changes only affect future interactions.

---

# ADR-011: Representative-First Data Capture

## Decision

JoeKnock minimizes required fields during interaction entry.

---

## Context

The user is often entering information during or immediately after a conversation.

Too many required fields create friction.

---

## MVP Required Information

- Property/location
- Status

Optional:

- Notes
- Follow-up information

---

## Result

JoeKnock prioritizes speed and adoption.

---

# ADR-012: Organization Data Isolation

## Decision

All properties and interactions belong to an organization.

Organizations cannot access another organization's information.

---

## Context

JoeKnock is designed as a multi-organization platform.

Data separation is required for security and trust.

---

## Result

Every major record is associated with an organization boundary.

---

# ADR-013: Visibility Controlled Through Organization Settings

## Decision

Organizations control representative visibility.

---

## MVP Visibility Options

Representatives:

- Only my interactions
- My team's interactions
- Organization-wide interactions

Managers:

- Assigned team visibility

Administrators:

- Organization-wide visibility

---

## Result

Organizations control collaboration while preserving flexibility.

---

# ADR-014: Export-Oriented Architecture

## Decision

JoeKnock prioritizes making captured interaction data available outside the platform.

---

## Context

Organizations may already use:

- CRMs
- Reporting systems
- Internal tools

JoeKnock should complement existing systems.

---

## Alternatives Considered

### Build a complete internal business system

Rejected because:

- Expands scope
- Competes with existing platforms

---

## Result

JoeKnock provides:

- Data exports
- Future API integrations
- Future webhook support

The receiving system determines:

- Lead ownership
- Sales responsibility
- Commission
- Customer lifecycle

---

# ADR-015: MVP Scope Discipline

## Decision

The MVP focuses on validating the core field interaction workflow.

---

## Included in MVP

- Map-first workflow
- User location
- Property selection
- Interaction capture
- Configurable statuses
- Property pins
- Organization management
- User management
- Teams
- Visibility settings
- Basic reporting
- Export structure

---

## Deferred Features

Examples:

- Advanced CRM integrations
- Webhooks
- Heat maps
- Territory optimization
- Gamification
- Advanced analytics
- User-facing property history
- Advanced configurable fields

---

## Result

The MVP remains focused:

A user can quickly capture what happened in the field, and an organization can access accurate information.

---

# Summary

JoeKnock's architecture is built around several core ideas:

1. The map is the workspace.
2. Properties represent locations.
3. Interactions represent field events.
4. Historical accuracy comes from preserved interactions.
5. The latest interaction represents current property status.
6. Organizations control workflows.
7. Teams provide flexibility.
8. Everyone can perform field work.
9. JoeKnock captures the moment and delivers useful information downstream.

These decisions create a foundation that supports the MVP while leaving room for future growth.
