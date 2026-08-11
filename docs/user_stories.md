# JoeKnock MVP — User Stories

## Overview

This document defines the user stories for the JoeKnock MVP.

Each story represents a meaningful piece of functionality from the perspective of an actual JoeKnock user.

Stories are prioritized using:

- **P0 — Critical:** Required for the MVP to function.
- **P1 — High:** Important to the MVP experience but not required for the core application to operate.
- **P2 — Medium:** Useful MVP functionality that can be completed after the critical workflow is working.

### Suggested GitHub Labels

| Label               | Purpose                               |
| ------------------- | ------------------------------------- |
| `user-story`        | Identifies a user-story issue         |
| `priority:p0`       | Critical MVP functionality            |
| `priority:p1`       | High-priority MVP functionality       |
| `priority:p2`       | Medium-priority functionality         |
| `area:auth`         | Authentication and authorization      |
| `area:users`        | User management                       |
| `area:teams`        | Team management                       |
| `area:properties`   | Property management                   |
| `area:interactions` | Field interactions                    |
| `area:map`          | Map functionality                     |
| `area:geocoding`    | Address/geocoding functionality       |
| `area:statuses`     | Status management                     |
| `area:reports`      | Reporting                             |
| `area:settings`     | Organization settings                 |
| `frontend`          | Frontend implementation               |
| `backend`           | Backend/API implementation            |
| `database`          | Database work                         |
| `security`          | Authentication/authorization/security |
| `testing`           | Testing-related work                  |

---

# Epic 1 — Authentication & Access

## US-001 — Register Organization

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:auth` `backend` `database`

### User Story

As a new organization administrator,
I want to create my organization and administrator account,
so that I can begin using JoeKnock.

### Acceptance Criteria

- User can provide:
  - Organization name
  - First name
  - Last name
  - Email
  - Password

- A new organization is created.
- Organization settings are created.
- A new administrator user is created.
- The user is associated with the new organization.
- The user's role is set to administrator.
- The password is securely hashed.
- The API returns authentication information after successful registration.
- Duplicate email addresses are rejected appropriately.
- Invalid registration data returns a useful validation error.

---

## US-002 — Log In

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:auth` `frontend` `backend` `security`

### User Story

As a JoeKnock user,
I want to securely log into my account,
so that I can access my organization's data.

### Acceptance Criteria

- User can enter email and password.
- Valid credentials authenticate successfully.
- Invalid credentials are rejected.
- Inactive users cannot log in.
- A valid JWT is returned after successful authentication.
- The authenticated user's organization is available through the authentication context.
- The application stores authentication information appropriately on the client.

---

## US-003 — Log Out

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:auth` `frontend` `backend`

### User Story

As a JoeKnock user,
I want to log out,
so that my account cannot be accessed from the current session.

### Acceptance Criteria

- User can log out from the application.
- Client authentication information is removed.
- Protected pages cannot be accessed after logout.
- The user is returned to the login screen.

---

## US-004 — View Current User

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:auth` `area:users` `frontend` `backend`

### User Story

As a JoeKnock user,
I want to view my account information,
so that I know which account and organization I am currently using.

### Acceptance Criteria

- Authenticated user can retrieve their own profile.
- Profile displays name and email.
- Profile displays role.
- Profile displays organization.
- User cannot retrieve another user's information through this endpoint unless authorized.

---

# Epic 2 — Organization & User Management

## US-005 — Manage Organization Information

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:settings` `backend` `frontend`

### User Story

As an administrator,
I want to manage my organization's basic information,
so that JoeKnock reflects the correct organization.

### Acceptance Criteria

- Administrator can view organization information.
- Administrator can update the organization name.
- Non-administrators cannot modify organization information.
- Organization changes apply only to the authenticated user's organization.

---

## US-006 — Create User

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:users` `backend` `frontend` `database`

### User Story

As an administrator or manager,
I want to create users within my organization,
so that representatives can use JoeKnock.

### Acceptance Criteria

- Authorized users can create a new user.
- User must belong to the administrator's organization.
- User must have:
  - First name
  - Last name
  - Email
  - Password
  - Role

- Duplicate accounts are rejected.
- Password is securely hashed.
- New users are active by default.
- Organization ID is determined by the authenticated user rather than trusted from the request.

---

## US-007 — View Organization Users

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:users` `frontend` `backend`

### User Story

As a manager or administrator,
I want to view users in my organization,
so that I can understand who has access to JoeKnock.

### Acceptance Criteria

- Authorized users can retrieve organization users.
- Users from other organizations are never returned.
- Users can be filtered by active status.
- Users can be filtered by role.
- Users can be filtered by team when applicable.

---

## US-008 — Update User

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:users` `frontend` `backend`

### User Story

As a manager or administrator,
I want to update user information,
so that user accounts remain accurate.

### Acceptance Criteria

- Authorized users can update permitted user fields.
- Name can be updated.
- Role can be updated when authorized.
- User cannot be moved between organizations.
- Unauthorized users cannot modify other users.

---

## US-009 — Deactivate User

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:users` `backend` `database` `security`

### User Story

As an administrator,
I want to deactivate a user,
so that former users cannot access JoeKnock while their historical interactions remain intact.

### Acceptance Criteria

- Administrator can deactivate a user.
- Deactivated users cannot log in.
- User remains in the database.
- Historical interactions continue to reference the user.
- User can be reactivated when appropriate.
- Deactivation records the appropriate timestamp.

---

# Epic 3 — Teams

## US-010 — Create Team

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:teams` `backend` `frontend` `database`

### User Story

As a manager or administrator,
I want to create teams,
so that representatives can be organized for visibility and management.

### Acceptance Criteria

- Authorized user can create a team.
- Team belongs to the current organization.
- Team requires a name.
- Team cannot belong to another organization.

---

## US-011 — View Teams

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:teams` `frontend` `backend`

### User Story

As a manager or administrator,
I want to view my organization's teams,
so that I can manage team membership.

### Acceptance Criteria

- Authorized user can view teams.
- Teams from other organizations are never returned.
- Team members can be displayed.

---

## US-012 — Add User to Team

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:teams` `area:users` `backend` `database`

### User Story

As a manager or administrator,
I want to add users to teams,
so that team-based visibility can work correctly.

### Acceptance Criteria

- Authorized user can add a user to a team.
- User and team must belong to the same organization.
- Duplicate team memberships are prevented.
- Team membership is stored through the `team_users` relationship.

---

## US-013 — Remove User from Team

**Priority:** P2

**Labels:**
`user-story` `priority:p2` `area:teams` `backend` `database`

### User Story

As a manager or administrator,
I want to remove users from teams,
so that team membership remains accurate.

### Acceptance Criteria

- Authorized user can remove a user from a team.
- The user account remains active.
- Historical interactions are unaffected.
- The team membership relationship is removed.

---

# Epic 4 — Organization Statuses

## US-014 — View Statuses

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:statuses` `frontend` `backend`

### User Story

As a sales representative,
I want to see my organization's available interaction statuses,
so that I can accurately record what happened at a property.

### Acceptance Criteria

- Authenticated user can retrieve active statuses.
- Only statuses belonging to the user's organization are returned.
- Inactive statuses are not presented as selectable new statuses.
- Statuses include display ordering information.

---

## US-015 — Create Status

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:statuses` `backend` `frontend` `database`

### User Story

As a manager or administrator,
I want to create custom statuses,
so that my organization can define its own canvassing workflow.

### Acceptance Criteria

- Authorized users can create statuses.
- Status belongs to the current organization.
- Status has a name.
- Status can have a description.
- Status has a display order.
- Status cannot be created for another organization.

---

## US-016 — Update Status

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:statuses` `backend` `frontend`

### User Story

As a manager or administrator,
I want to update a status,
so that the organization's workflow can evolve.

### Acceptance Criteria

- Authorized users can update permitted status fields.
- Historical interaction snapshots are not modified.
- Status remains associated with the same organization.

---

## US-017 — Deactivate Status

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:statuses` `backend` `frontend`

### User Story

As a manager or administrator,
I want to deactivate a status,
so that it is no longer available for new interactions while historical records remain intact.

### Acceptance Criteria

- Authorized users can deactivate a status.
- Deactivated status cannot be selected for new interactions.
- Existing interactions referencing the status remain intact.
- Status is not physically deleted.

---

# Epic 5 — Map & Property Discovery

## US-018 — View Map

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:map` `frontend`

### User Story

As a sales representative,
I want to see a map of the area I am canvassing,
so that I can navigate properties while working in the field.

### Acceptance Criteria

- Map is displayed as the primary application experience.
- Map supports panning.
- Map supports zooming.
- Properties can be represented as map markers.
- Map works effectively on a tablet-sized display.
- Map attribution is displayed appropriately.

---

## US-019 — View Current Location

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:map` `frontend`

### User Story

As a sales representative,
I want to see my current location on the map,
so that I know where I am while canvassing.

### Acceptance Criteria

- Application requests location permission.
- Current position is displayed on the map.
- Location updates as the representative moves.
- Application handles denied location permissions gracefully.
- The representative's location is visually distinguishable from property markers.

---

## US-020 — Follow Current Location

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:map` `frontend`

### User Story

As a sales representative,
I want the map to follow my current position,
so that I can walk through a neighborhood without manually repositioning the map.

### Acceptance Criteria

- Map can follow the representative's location.
- Map recenters as location changes while follow mode is active.
- User can stop following their location by interacting with the map.

---

## US-021 — View Property Markers

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:map` `area:properties` `frontend` `backend`

### User Story

As a sales representative,
I want properties with recorded interactions to appear on the map,
so that I can quickly understand what has already happened at nearby properties.

### Acceptance Criteria

- API returns properties within the visible map area.
- Property coordinates are available.
- Properties can display their current relevant status.
- Marker data respects organization visibility rules.
- Properties from other organizations are never displayed.

---

## US-022 — Filter Map Properties

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:map` `area:properties` `frontend` `backend`

### User Story

As a sales representative,
I want to filter properties by status and date range,
so that I can focus on relevant properties.

### Acceptance Criteria

- User can filter by status.
- User can filter by date range.
- Filters affect displayed property data.
- Filtering respects the user's visibility permissions.
- Filters can be cleared.

---

# Epic 6 — Geocoding & Property Identification

## US-023 — Identify Property from Map Location

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:geocoding` `area:map` `area:properties` `frontend` `backend`

### User Story

As a sales representative,
I want to select a location on the map and identify its address,
so that I can record an interaction without manually entering the property address.

### Acceptance Criteria

- User can select a location/property on the map.
- Application obtains latitude and longitude.
- Backend calls the configured geocoding service.
- Reverse geocoding returns an address when available.
- Address information is presented to the user.
- User can confirm the identified property.
- Geocoding errors are handled gracefully.

---

## US-024 — Search for Address

**Priority:** P2

**Labels:**
`user-story` `priority:p2` `area:geocoding` `area:map` `frontend` `backend`

### User Story

As a JoeKnock user,
I want to search for an address,
so that I can quickly locate a property on the map.

### Acceptance Criteria

- User can enter an address.
- Backend sends the request to the geocoding service.
- Matching results are returned.
- User can select a result.
- Selected result is displayed on the map.
- Invalid or unavailable addresses produce an appropriate message.

---

## US-025 — Cache Geocoding Results

**Priority:** P2

**Labels:**
`user-story` `priority:p2` `area:geocoding` `backend` `database`

### User Story

As a JoeKnock system administrator,
I want repeated geocoding requests to be minimized,
so that JoeKnock respects the geocoding provider's usage limits.

### Acceptance Criteria

- Application avoids unnecessary duplicate geocoding requests.
- Previously resolved property information can be reused where appropriate.
- Caching does not cause stale property information to overwrite confirmed user data.
- Geocoding requests remain within provider usage requirements.

### Note

Caching may be implemented after the core MVP workflow is functional.

---

# Epic 7 — Property Management

## US-026 — Create Property

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:properties` `backend` `database`

### User Story

As a sales representative,
I want JoeKnock to create a property when I encounter a location that is not already in the system,
so that I can record an interaction at that property.

### Acceptance Criteria

- Property can be created from confirmed address information.
- Property stores address information.
- Property stores latitude and longitude.
- Property belongs to the authenticated user's organization.
- Existing properties are checked before creating duplicates.
- Property creation does not require manual organization ID entry.

---

## US-027 — View Property

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:properties` `frontend` `backend`

### User Story

As a sales representative,
I want to view property information after selecting it on the map,
so that I can review its current information before recording an interaction.

### Acceptance Criteria

- Selecting a property retrieves its information.
- Address information is displayed.
- Current relevant interaction information is displayed.
- User can access the interaction workflow from the property view.
- Property information respects visibility permissions.

---

## US-028 — View Property Interaction History

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:properties` `area:interactions` `frontend` `backend`

### User Story

As a sales representative,
I want to see the interaction history for a property,
so that I know what has happened there previously.

### Acceptance Criteria

- Property displays associated interaction histories.
- Multiple interaction histories can exist for one property.
- Current interaction snapshots are identifiable.
- Historical snapshots can be retrieved when authorized.
- Interaction history remains associated with the correct property.

---

# Epic 8 — Field Interactions

## US-029 — Record New Interaction

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:interactions` `backend` `frontend` `database`

### User Story

As a sales representative,
I want to quickly record what happened when I interact with a homeowner,
so that I can preserve the result of the interaction without interrupting my field workflow.

### Acceptance Criteria

- User can start an interaction from a property.
- User can select an organization-defined status.
- User can enter notes.
- User can enter available contact information.
- Interaction date is recorded.
- Authenticated user is recorded.
- Interaction is associated with the correct property.
- Interaction is associated with the user's organization.
- A unique `interaction_group_id` is generated for a new interaction history.
- A unique interaction snapshot ID is generated.
- `initial_interaction_at` is set.
- `changed_at` is set.
- New snapshot is marked as current.

---

## US-030 — Save Interaction Draft

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:interactions` `frontend`

### User Story

As a sales representative,
I want my partially completed interaction to be protected from accidental data loss,
so that a dead battery, dropped connection, or accidental interruption does not force me to start over.

### Acceptance Criteria

- Interaction form can save a local draft.
- Draft is stored locally on the device.
- Draft can be restored after the form is reopened.
- Draft does not create a database interaction until the user saves/submits it.
- Draft can be discarded intentionally.
- Draft data is associated with the appropriate property.

---

## US-031 — Update Interaction

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:interactions` `backend` `frontend` `database`

### User Story

As a sales representative,
I want to update an interaction when information changes,
so that the current record reflects the latest information while preserving the original history.

### Acceptance Criteria

- User can edit an authorized interaction.
- Existing interaction snapshot is never overwritten.
- Existing snapshot is marked `is_current = false`.
- New snapshot is created.
- New snapshot uses the same `interaction_group_id`.
- New snapshot receives a new unique ID.
- `initial_interaction_at` remains unchanged.
- `changed_at` receives a new timestamp.
- New snapshot becomes `is_current = true`.
- Previous snapshot remains available in history.

---

## US-032 — View Interaction Snapshot

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:interactions` `frontend` `backend`

### User Story

As a user with permission to view an interaction,
I want to view the details of a specific interaction snapshot,
so that I can understand what information was recorded.

### Acceptance Criteria

- Snapshot can be retrieved by ID.
- Snapshot displays status.
- Snapshot displays interaction date.
- Snapshot displays notes when present.
- Snapshot displays contact information when present.
- Snapshot identifies the representative who recorded it.
- Snapshot identifies the associated property.

---

## US-033 — View Interaction History

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:interactions` `frontend` `backend` `database`

### User Story

As a manager or authorized user,
I want to view the complete history of an interaction,
so that I can understand how the record changed over time.

### Acceptance Criteria

- All snapshots in an interaction group can be retrieved.
- Snapshots are ordered chronologically.
- Each snapshot identifies when it was created/changed.
- Each snapshot identifies the user responsible for the change.
- Previous snapshots remain unchanged.
- Current snapshot can be identified.

---

# Epic 9 — Visibility & Authorization

## US-034 — Restrict Representative Visibility

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `security` `area:settings` `area:interactions` `backend`

### User Story

As an organization administrator,
I want to configure what representatives can see,
so that field information is shared according to our organization's workflow.

### Acceptance Criteria

Organization can configure:

```text
self
team
organization
```

For `self`:

- Representative sees their own interactions.

For `team`:

- Representative sees interactions associated with their team visibility.

For `organization`:

- Representative can see organization-wide interactions.

Managers and administrators retain their appropriate elevated visibility.

---

## US-035 — Enforce Organization Isolation

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `security` `backend` `database` `testing`

### User Story

As a JoeKnock organization,
I want my data isolated from other organizations,
so that another organization cannot access our properties, users, or interactions.

### Acceptance Criteria

- Every authenticated request has an organization context.
- Property access verifies organization ownership.
- Interaction access verifies organization ownership.
- User access verifies organization ownership.
- Team access verifies organization ownership.
- Status access verifies organization ownership.
- Organization settings cannot be accessed by another organization.
- Changing a resource ID in a request cannot bypass organization isolation.
- Cross-organization access attempts return an appropriate authorization/not-found response.

---

## US-036 — Enforce Role Permissions

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `security` `backend` `testing`

### User Story

As a JoeKnock organization,
I want actions restricted according to user roles,
so that representatives, managers, and administrators only perform authorized actions.

### Acceptance Criteria

### Representative

Can:

- View permitted properties.
- Create interactions.
- View permitted interactions.
- Create authorized interaction revisions.
- View applicable statuses.
- Use map functionality.
- Use geocoding functionality.

Cannot:

- Manage organization users.
- Manage teams.
- Manage organization settings.
- Manage statuses.

### Manager

Can:

- Perform representative functions.
- View team activity.
- Manage teams.
- Manage statuses.
- View activity reports.

### Administrator

Can:

- Perform manager functions.
- Manage organization settings.
- Manage organization information.
- Create users.
- Deactivate users.
- Manage organization configuration.

---

# Epic 10 — Reporting

## US-037 — View Activity Report

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:reports` `backend` `frontend`

### User Story

As a manager or administrator,
I want to view field activity over a selected date range,
so that I can understand canvassing activity and performance.

### Acceptance Criteria

- Authorized users can request activity data.
- Report supports date ranges.
- Report can filter by representative.
- Report can filter by team.
- Report can filter by status.
- Results are generated from interaction data.
- Historical revisions are not incorrectly counted as separate field interactions.
- Organization isolation is enforced.

---

## US-038 — View Activity by Status

**Priority:** P2

**Labels:**
`user-story` `priority:p2` `area:reports` `frontend` `backend`

### User Story

As a manager,
I want to see interactions grouped by status,
so that I can understand the results of canvassing activity.

### Acceptance Criteria

- Report can group activity by status.
- Counts are based on appropriate interaction records.
- Historical revisions are not double-counted.
- Results respect the selected date range.
- Results respect organization and user visibility permissions.

---

## US-039 — View Activity by Representative

**Priority:** P2

**Labels:**
`user-story` `priority:p2` `area:reports` `frontend` `backend`

### User Story

As a manager,
I want to see activity by representative,
so that I can understand team activity.

### Acceptance Criteria

- Report can group interactions by representative.
- Manager can filter by team.
- Results respect organization boundaries.
- Historical revisions are not counted as separate field interactions.

---

# Epic 11 — Map Interaction Workflow

## US-040 — Select Property from Map

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:map` `area:properties` `frontend`

### User Story

As a sales representative,
I want to select a property directly from the map,
so that I can begin an interaction without navigating through multiple screens.

### Acceptance Criteria

- User can tap/click a property.
- Selected property remains visually identifiable.
- Property information appears without navigating away from the map.
- Interaction controls are accessible from the property overlay.
- Map interaction is temporarily controlled while entering interaction information.
- User can cancel the interaction and return to the map.

---

## US-041 — Record Interaction Without Leaving Map

**Priority:** P0

**Labels:**
`user-story` `priority:p0` `area:map` `area:interactions` `frontend`

### User Story

As a sales representative,
I want to record an interaction from a map overlay,
so that I can capture information quickly while standing at the property.

### Acceptance Criteria

- Property remains visible while the interaction form is open.
- Interaction form appears as an overlay.
- Required fields are kept to a minimum.
- User can select a status.
- User can enter notes.
- User can enter contact information.
- User can save the interaction.
- Successful save returns the user to the map.
- Property marker reflects the updated interaction state.

---

## US-042 — Display Interaction Status and Count

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:map` `area:interactions` `frontend`

### User Story

As a sales representative,
I want to see property interaction status and counts on the map,
so that I can quickly understand the area's canvassing history.

### Acceptance Criteria

- Property markers can indicate their current relevant status.
- Interaction count can be displayed where appropriate.
- Counts are based on appropriate interaction histories rather than individual revisions.
- Display respects visibility permissions.

---

# Epic 12 — MVP Reliability & Security

## US-043 — Handle API Validation Errors

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `backend` `frontend` `testing`

### User Story

As a JoeKnock user,
I want clear feedback when I submit invalid information,
so that I can correct mistakes without losing my work.

### Acceptance Criteria

- Required fields are validated.
- Invalid data is rejected by the backend.
- API returns consistent error responses.
- Frontend displays useful validation messages.
- Invalid requests do not partially create database records.

---

## US-044 — Handle Network Failure During Interaction

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:interactions` `frontend` `testing`

### User Story

As a sales representative,
I want my interaction information protected when connectivity is interrupted,
so that I do not lose information while working in the field.

### Acceptance Criteria

- Failed API requests are detected.
- User receives an understandable error message.
- Local interaction draft remains available.
- User can retry submission.
- Duplicate interactions are prevented when a retry succeeds after an uncertain request state.

---

## US-045 — Protect Geocoding Service

**Priority:** P1

**Labels:**
`user-story` `priority:p1` `area:geocoding` `security` `backend`

### User Story

As a JoeKnock system administrator,
I want geocoding requests controlled through the JoeKnock backend,
so that the application does not expose or abuse the external geocoding service.

### Acceptance Criteria

- Frontend does not directly call Nominatim.
- JoeKnock backend handles geocoding requests.
- Requests require authentication.
- Backend validates coordinates/address input.
- Requests comply with Nominatim usage limits.
- Appropriate attribution is provided in the application.
- Provider can be replaced without changing the frontend API.

---

# MVP Priority Summary

## P0 — Critical

These stories represent the minimum functionality required for JoeKnock's core workflow.

```text
US-001  Register Organization
US-002  Log In
US-003  Log Out
US-006  Create User

US-014  View Statuses

US-018  View Map
US-019  View Current Location
US-021  View Property Markers

US-023  Identify Property from Map Location

US-026  Create Property
US-027  View Property
US-028  View Property Interaction History

US-029  Record New Interaction
US-030  Save Interaction Draft
US-031  Update Interaction

US-034  Restrict Representative Visibility
US-035  Enforce Organization Isolation
US-036  Enforce Role Permissions

US-040  Select Property from Map
US-041  Record Interaction Without Leaving Map
```

## P1 — High

These complete the broader MVP experience.

```text
US-004  View Current User
US-005  Manage Organization Information
US-007  View Organization Users
US-008  Update User
US-009  Deactivate User

US-010  Create Team
US-011  View Teams
US-012  Add User to Team

US-015  Create Status
US-016  Update Status
US-017  Deactivate Status

US-020  Follow Current Location
US-022  Filter Map Properties

US-032  View Interaction Snapshot
US-033  View Interaction History

US-037  View Activity Report

US-043  Handle API Validation Errors
US-044  Handle Network Failure During Interaction
US-045  Protect Geocoding Service
```

## P2 — Medium

These are useful but can be completed after the core workflow is operational.

```text
US-013  Remove User from Team

US-024  Search for Address
US-025  Cache Geocoding Results

US-038  View Activity by Status
US-039  View Activity by Representative

US-042  Display Interaction Status and Count
```

---

# Core MVP User Journey

The most important JoeKnock workflow is represented by the following stories:

```text
US-002
Log In
   │
   ▼
US-018
View Map
   │
   ▼
US-019
View Current Location
   │
   ▼
US-021
View Property Markers
   │
   ▼
US-040
Select Property
   │
   ▼
US-023
Identify Property
   │
   ▼
US-027
View Property
   │
   ▼
US-028
View Interaction History
   │
   ▼
US-041
Open Interaction Overlay
   │
   ▼
US-030
Save Local Draft
   │
   ▼
US-029
Record Interaction
   │
   ▼
US-031
Create New Immutable Snapshot
   │
   ▼
Return to Map
```

This workflow represents the central JoeKnock value proposition:

> **Knock. Click. Go.**

The representative should be able to identify the property, record the outcome, and continue canvassing with as little interruption as possible.

---

# Recommended GitHub Issue Structure

Each user story should become a GitHub Issue using the following format:

```markdown
# User Story

As a [user],
I want [action],
so that [benefit].

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes

Relevant implementation details.

## Related

- Database tables:
- API endpoints:
- Wireframe:
- ADRs:

## Definition of Done

- [ ] Implementation complete
- [ ] Acceptance criteria satisfied
- [ ] Backend validation implemented
- [ ] Frontend behavior implemented
- [ ] Tested
- [ ] Code reviewed
- [ ] Documentation updated where necessary
```

---

# Definition of Done

A user story is considered complete when:

- [ ] Acceptance criteria are satisfied.
- [ ] Frontend behavior is implemented where applicable.
- [ ] Backend/API behavior is implemented where applicable.
- [ ] Database changes are implemented where applicable.
- [ ] Authentication and authorization requirements are enforced.
- [ ] Error handling is implemented.
- [ ] Relevant tests have been completed.
- [ ] Code has been reviewed.
- [ ] Related documentation is updated.
- [ ] Changes are committed to Git.
- [ ] GitHub Issue is closed only after the implementation has been verified.

---

# Relationship to JoeKnock Architecture

The user stories are intentionally tied to the current MVP architecture.

### Core Tables

```text
organizations
organization_settings
users
teams
team_users
statuses
properties
interactions
```

### Core API Areas

```text
Authentication
Users
Teams
Statuses
Properties
Interactions
Map
Geocoding
Reporting
```

### Core Architectural Decisions

```text
JWT Authentication
Organization Data Isolation
Role-Based Authorization
Configurable Organization Statuses
Map-First Navigation
Leaflet Mapping
OpenStreetMap/Nominatim Geocoding
Immutable Interaction Snapshots
Interaction Groups
Local Interaction Drafts
Soft Deactivation of Users
No Separate Interaction Activity Log
```

The user stories should be treated as the functional requirements for the MVP. Architectural decisions determine **how** those requirements are implemented, while acceptance criteria determine **when** each story is considered complete.
