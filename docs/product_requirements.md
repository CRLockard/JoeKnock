# JoeKnock - Product Requirements Document

## Purpose

This document defines the functional requirements for the JoeKnock MVP.

The goal of the MVP is to create a functional field interaction platform that allows organizations to capture, organize, and review location-based interactions while demonstrating professional full-stack development practices.

The MVP prioritizes:

- Fast field interaction capture
- Clean data collection
- Reliable historical information
- Organizational visibility
- Scalable architecture

---

# MVP Scope

# 1. Authentication and User Management

Users must be able to securely access JoeKnock through authentication.

The system supports three roles:

---

## Representative

Primary field user.

Capabilities:

- Access the map
- Create interactions
- View permitted information
- Access personal profile

---

## Manager

Team-level user.

Capabilities:

- Perform field interactions
- View assigned team activity
- Review accessible reports

---

## Administrator

Organization-level user.

Capabilities:

- Perform field interactions
- Manage users
- Manage teams
- Configure organization settings
- Configure statuses
- View organization data

---

# 2. Organization Management

JoeKnock uses an organization-based structure.

Each organization contains:

- Users
- Teams
- Properties
- Interactions
- Organization settings

Organizations represent the company or group using JoeKnock.

---

# 3. Team Management

Teams provide a flexible way to organize users and manage visibility.

Teams support:

- Multiple managers
- Multiple representatives
- Shared responsibilities
- Temporary coverage

Users may belong to multiple teams.

Roles are determined by the user record, not team membership.

---

# 4. Configurable Statuses

Statuses are organization-defined.

JoeKnock does not enforce a universal workflow.

Examples:

- No Answer
- Interested
- Appointment Scheduled
- Not Interested
- Follow Up Needed

Administrators define statuses meaningful to their organization.

---

# 5. Map-First Field Experience

The map is the core feature of JoeKnock.

Users can:

- View their current location
- See permitted property markers
- Select a property
- Record an interaction without leaving the map

The map will:

- Center on user location
- Display user position
- Display property interaction markers
- Preserve context during interaction entry

Property markers:

- Indicate that an interaction exists at a location
- Do not display status colors in MVP
- Respect user visibility permissions

---

# 6. Property Management

Properties represent physical locations where interactions occur.

A property is not:

- A lead
- A customer record
- A sales opportunity

A property answers:

> Where did this interaction happen?

Properties may contain multiple interactions.

Example:

```
Property:
123 Main Street

Interactions:

Rep A
No Answer

Rep B
Interested
```

---

# 7. Interaction Capture

Interactions are the core records in JoeKnock.

An interaction records:

- Property
- User
- Organization
- Status
- Notes
- Timestamp

Interactions represent what happened during a field interaction.

The latest interaction status is displayed as the current state for the property.

---

# 8. Interaction History

JoeKnock preserves historical changes to maintain trust.

The system should answer:

- What changed?
- Who changed it?
- When did it change?

The MVP does not expose a full CRM-style history interface.

Internal history exists to support:

- Data reliability
- Troubleshooting
- Future expansion

---

# 9. Visibility Controls

Organizations define visibility settings.

Available options:

## Self

Users see only their own interactions.

## Team

Users see interactions from assigned teams.

## Organization

Users see organization-wide interactions.

Managers and administrators maintain broader access based on role.

---

# 10. Reporting

The MVP reporting system focuses on simple operational visibility.

Included:

- Interaction counts
- Status counts
- User activity summaries
- Date range filtering

Reporting should represent field activity.

Updates to existing records should not incorrectly appear as new field interactions.

---

# 11. Data Export

JoeKnock is designed to provide data to external systems.

Exports focus on interaction information.

Potential export fields:

- Property details
- Interaction status
- Representative
- Manager visibility context
- Timestamp
- Notes

JoeKnock does not determine:

- Lead ownership
- Sales assignment
- Commission
- Customer lifecycle

Those decisions belong in the organization's CRM.

---

# Features Deferred Beyond MVP

## CRM Integrations

Future:

- Webhooks
- External APIs
- Automated synchronization

---

## Advanced Data Capture

Future:

- Custom organization fields
- Additional property information

Examples:

- Roof age
- Roof type
- Insurance information

---

## Territory Management

Future:

- Geographic assignments
- Territory boundaries

---

## Heat Maps

Future:

- Activity density
- Opportunity areas
- Completed work visualization

---

## Property Intelligence

Future:

- Seasonal canvassing support
- Previous outcome summaries
- Advanced property history

---

## Gamification

Future:

- Leaderboards
- Distance tracking
- Rep comparisons

---

# MVP Success Criteria

The MVP is successful if any authorized user can:

1. Open JoeKnock.
2. View their location on the map.
3. Select a property.
4. Quickly record an interaction.
5. Save the interaction.
6. Allow appropriate users to view the information.

The system should make field interaction capture faster and easier than manual processes.

---

# Guiding Principle

Every feature should support the core purpose of JoeKnock:

> Capture the interaction quickly, preserve trust in the data, and make the information available where it is needed.
