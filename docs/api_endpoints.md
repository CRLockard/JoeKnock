# JoeKnock MVP — API Endpoint Specification

## 1. Overview

The JoeKnock MVP API provides the backend services required for:

- Authentication
- Organization management
- User and team management
- Configurable statuses
- Property resolution and map data
- Field interactions
- Basic activity reporting

The API is designed around a simple organization-scoped model:

```text
Organization
    │
    ├── Users
    │      │
    │      └── Teams
    │
    ├── Organization Settings
    │
    ├── Statuses
    │
    └── Properties
           │
           └── Interaction Groups
                  │
                  └── Immutable Snapshots
```

The API enforces:

- Authentication
- Authorization
- Organization isolation
- Representative visibility rules
- Immutable interaction history
- Server-controlled ownership and organization relationships

The MVP intentionally avoids unnecessary CRUD and infrastructure endpoints.

---

# 2. API Conventions

## Base URL

```text
/api
```

## Authentication

Protected endpoints require a valid JWT:

```http
Authorization: Bearer <token>
```

The authenticated user's identity and organization are determined from the JWT.

Clients do not supply `user_id` or `organization_id` for protected operations.

## HTTP Methods

| Method   | Purpose                                            |
| -------- | -------------------------------------------------- |
| `GET`    | Retrieve data                                      |
| `POST`   | Create a resource or perform an operation          |
| `PATCH`  | Modify a mutable resource                          |
| `DELETE` | Remove a relationship where specifically permitted |

## Response Format

Successful requests return JSON.

Errors use an appropriate HTTP status code and consistent structure:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Property not found."
  }
}
```

---

# 3. Authentication

## POST `/api/auth/register`

### Purpose

Create the initial organization and administrator account during onboarding.

### Authentication

Public.

### Request

```json
{
  "organizationName": "Example Roofing",
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@example.com",
  "password": "password"
}
```

### Database Interaction

Creates:

- `organizations`
- `organization_settings`
- `users`

The newly created user becomes the initial organization administrator.

### Response

Returns authentication information and the newly created user.

---

## POST `/api/auth/login`

### Purpose

Authenticate an existing user.

### Authentication

Public.

### Request

```json
{
  "email": "john@example.com",
  "password": "password"
}
```

### Database Interaction

Reads:

- `users`
- `organizations`

The API verifies:

- User exists
- User is active
- Password is valid
- Organization is valid

### Response

Returns a JWT and authenticated user information.

---

## POST `/api/auth/logout`

### Purpose

Log the current user out of the application.

### Authentication

Authenticated.

### Database Interaction

None required for the MVP.

Because JWT authentication is stateless, the client removes the JWT after logout.

### Response

```json
{
  "message": "Logged out successfully."
}
```

---

# 4. Current User

## GET `/api/me`

### Purpose

Return information about the currently authenticated user.

### Authentication

Authenticated.

### Database Interaction

Reads:

- `users`
- `organizations`
- `teams`
- `team_users`

### Response

```json
{
  "id": "uuid",
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@example.com",
  "role": "rep",
  "organizationId": "uuid",
  "teams": []
}
```

---

# 5. Organizations

## GET `/api/organization`

### Purpose

Retrieve the authenticated user's organization.

### Authentication

Manager/Admin.

### Database Interaction

Reads:

- `organizations`

The organization is determined from the authenticated user.

---

## PATCH `/api/organization`

### Purpose

Update mutable organization information.

### Authentication

Admin.

### Request

```json
{
  "name": "Example Roofing"
}
```

### Database Interaction

Updates:

- `organizations`

The client does not provide `organization_id`.

---

# 6. Organization Settings

## GET `/api/organization/settings`

### Purpose

Retrieve organization-level application settings.

### Authentication

Manager/Admin.

### Database Interaction

Reads:

- `organization_settings`

---

## PATCH `/api/organization/settings`

### Purpose

Update organization-level application settings.

### Authentication

Admin.

### MVP Setting

```text
rep_visibility
```

Allowed values:

```text
own
team
organization
```

### Meaning

| Value          | Representative visibility                           |
| -------------- | --------------------------------------------------- |
| `own`          | Own interactions only                               |
| `team`         | Own interactions plus interactions from their teams |
| `organization` | Organization-wide interactions                      |

Managers and administrators retain access according to their role permissions.

---

# 7. Users

Users belong to exactly one organization.

Users are never deleted in the MVP.

Deactivation prevents account access while preserving existing historical records.

## GET `/api/users`

### Purpose

Retrieve users belonging to the authenticated user's organization.

### Authentication

Manager/Admin.

### Supported Filters

```text
?active=true
?role=rep
?teamId=<uuid>
```

### Database Interaction

Reads:

- `users`
- `teams`
- `team_users`

---

## GET `/api/users/:id`

### Purpose

Retrieve a specific organization user.

### Authentication

Manager/Admin.

The API verifies that the requested user belongs to the authenticated user's organization.

---

## POST `/api/users`

### Purpose

Create a new organization user.

### Authentication

Manager/Admin.

### Request

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "password": "password",
  "role": "rep"
}
```

The organization is derived from the authenticated user.

### Database Interaction

Creates:

- `users`

---

## PATCH `/api/users/:id`

### Purpose

Update mutable user information.

### Authentication

Manager/Admin.

### Possible Fields

```json
{
  "firstName": "Jane",
  "lastName": "Johnson",
  "role": "manager"
}
```

This endpoint does not handle:

- Team membership
- Activation/deactivation
- Organization changes
- Password changes
- Email changes

---

## PATCH `/api/users/:id/active`

### Purpose

Activate or deactivate a user.

### Authentication

Admin.

### Request

```json
{
  "isActive": false
}
```

### Behavior

When a user is deactivated:

- They cannot authenticate.
- They cannot create new interactions.
- They cannot edit existing interactions.
- Existing interaction groups remain unchanged.
- Existing snapshots remain unchanged.
- Historical `user_id` relationships remain intact.
- No interactions are reassigned.

There is no user deletion endpoint.

---

# 8. Teams

Teams organize users within an organization.

Users and teams have a many-to-many relationship through `team_users`.

A user may belong to zero, one, or multiple teams.

## GET `/api/teams`

### Purpose

Retrieve organization teams.

### Authentication

Manager/Admin.

---

## GET `/api/teams/:id`

### Purpose

Retrieve a team and its members.

### Authentication

Manager/Admin.

---

## POST `/api/teams`

### Purpose

Create a team.

### Authentication

Manager/Admin.

### Request

```json
{
  "name": "North Knoxville"
}
```

The organization is derived from the authenticated user.

---

## PATCH `/api/teams/:id`

### Purpose

Update team information.

### Authentication

Manager/Admin.

### Possible Fields

```json
{
  "name": "North Knoxville Team"
}
```

---

## POST `/api/teams/:id/users`

### Purpose

Add an organization user to a team.

### Authentication

Manager/Admin.

### Request

```json
{
  "userId": "uuid"
}
```

The API verifies that:

- The team belongs to the authenticated user's organization.
- The user belongs to the same organization.

---

## DELETE `/api/teams/:id/users/:userId`

### Purpose

Remove a user from a team.

### Authentication

Manager/Admin.

This removes only the `team_users` relationship.

It does not:

- Delete the user.
- Deactivate the user.
- Modify existing interactions.
- Reassign interactions.

A user with no team membership remains a valid organization user.

Teams themselves cannot be deleted in the MVP.

---

# 9. Statuses

Statuses define the organization's field-interaction workflow.

Statuses are organization-defined rather than hard-coded.

## GET `/api/statuses`

### Purpose

Retrieve active statuses available to the authenticated organization.

### Authentication

Authenticated.

---

## GET `/api/statuses/:id`

### Purpose

Retrieve a specific status.

### Authentication

Authenticated.

---

## POST `/api/statuses`

### Purpose

Create an organization status.

### Authentication

Manager/Admin.

### Request

```json
{
  "name": "Interested",
  "description": "Homeowner expressed interest.",
  "displayOrder": 1
}
```

The organization is derived from the authenticated user.

---

## PATCH `/api/statuses/:id`

### Purpose

Modify a status.

### Authentication

Manager/Admin.

### Possible Fields

- `name`
- `description`
- `display_order`

Existing interaction snapshots are not modified when a status changes.

---

## PATCH `/api/statuses/:id/active`

### Purpose

Activate or deactivate a status.

### Authentication

Manager/Admin.

### Request

```json
{
  "isActive": false
}
```

A deactivated status:

- Cannot be selected for new/current interaction snapshots.
- Remains associated with historical snapshots.
- Does not cause historical records to change.

There is no status deletion endpoint.

---

# 10. Properties

Properties represent physical addresses being canvassed.

Properties belong permanently to an organization in the MVP.

Properties cannot be manually edited or deleted.

## GET `/api/properties`

### Purpose

Retrieve properties visible to the authenticated user.

### Authentication

Authenticated.

### Supported Filters

- Status
- Date range
- Geographic/map bounds

### Authorization

The API applies:

- Organization isolation
- User role
- Representative visibility
- Team membership

---

## GET `/api/properties/:id`

### Purpose

Retrieve a specific property.

### Authentication

Authenticated.

The API verifies that the property belongs to the authenticated user's organization.

---

## POST `/api/properties/resolve`

### Purpose

Resolve a map-selected location into a JoeKnock property.

This is the primary property-creation workflow in the MVP.

### Authentication

Authenticated.

### Request

```json
{
  "latitude": 35.9,
  "longitude": -84.0
}
```

### Processing

The backend:

1. Sends the coordinates to the configured geocoding provider.
2. Retrieves the address.
3. Requires a valid address.
4. Normalizes the address.
5. Searches for the property within the authenticated organization.
6. Returns the existing property if one exists.
7. Creates a new property if none exists.
8. Returns the property.

### Important MVP Rules

- A property cannot exist without a valid address.
- The geocoder's returned address is used as the property's address.
- Users do not manually edit latitude/longitude.
- Users do not manually correct the address in the MVP.
- Duplicate properties are prevented within an organization using the normalized address.
- Properties are not deleted.
- Properties are not updated through a general `PATCH` endpoint.

---

# 11. Property Interactions (Current State)

## GET `/api/properties/:propertyId/interactions`

### Purpose

Retrieve the current interaction state associated with a property that the authenticated user is authorized to view.

### Authentication

Authenticated.

### Default Behavior

The endpoint returns current snapshots only.

The MVP does not provide a normal user-facing historical snapshot view.

Interaction history remains preserved in the database for reporting and authorized administrative/support use.

### Database Interaction

Reads:

- `interactions`
- `users`
- `statuses`

### Example Response

```json
{
  "propertyId": "uuid",
  "interactions": [
    {
      "interactionGroupId": "uuid",
      "userId": "uuid",
      "statusId": "uuid",
      "statusName": "Interested",
      "initialInteractionAt": "2026-08-08T15:30:00Z",
      "changedAt": "2026-08-08T15:35:00Z",
      "contactName": "John Smith",
      "contactPhone": "555-555-5555",
      "contactEmail": "john@example.com",
      "notes": "Wants follow-up Friday."
    }
  ]
}
```

Historical snapshots remain in the database but are not exposed through a normal history endpoint in the MVP.

---

# 12. Interactions

Interactions represent a representative's field interaction with a property.

The MVP uses immutable interaction snapshots.

## Interaction Identification

Three identifiers serve different purposes:

```text
property_id
    ↓
Which property?

interaction_group_id
    ↓
Which organization/property/representative interaction history?

id
    ↓
Which immutable snapshot?
```

### MVP Interaction Rule

An interaction group represents one interaction history for a specific:

- Organization
- Property
- Representative

During the MVP, there is one interaction group per organization + property + representative combination.

The first interaction by that representative creates the interaction group.

Subsequent saves to that interaction create new snapshots within the same group.

A future expiration/re-knock feature may allow additional interaction groups, but that is outside the MVP.

---

## POST `/api/properties/:propertyId/interactions`

### Purpose

Create the authenticated representative's first interaction with a property in their organization.

### Authentication

Authenticated.

### Request

```json
{
  "statusId": "uuid",
  "contactName": "John Smith",
  "contactPhone": "555-555-5555",
  "contactEmail": "john@example.com",
  "notes": "Homeowner interested in an inspection."
}
```

### Server-Controlled Fields

The client does not supply:

- `organization_id`
- `user_id`
- `interaction_group_id`
- `initial_interaction_at`
- `changed_at`
- `is_current`

The API determines these values.

For a first interaction:

```text
initial_interaction_at = current interaction time
changed_at = current time
is_current = true
```

### Duplicate Interaction Handling

Before creating a new interaction group, the API checks whether the authenticated user already has an interaction group for the property.

If one exists, the API does not create a second group.

The representative must update the existing interaction through `POST /api/interactions/:id`.

---

# 13. Get Individual Interaction

## GET `/api/interactions/:id`

### Purpose

Retrieve the current interaction snapshot represented by the requested interaction ID.

### Authentication

Authenticated.

### Authorization

The API verifies:

- Interaction belongs to the authenticated user's organization.
- User has permission to view the interaction.

The response contains the current interaction data required by the UI.

---

# 14. Save Changes to an Interaction

## POST `/api/interactions/:id`

### Purpose

Save changes to an existing interaction.

This operation creates a new immutable interaction snapshot.

The API does not modify the existing snapshot's field values.

### Authentication

Authenticated.

### Authorization

Only the representative who owns the interaction group can modify it.

Managers and administrators are view-only when accessing another representative's interaction.

### Request

```json
{
  "statusId": "uuid",
  "contactName": "John Smith",
  "contactPhone": "555-555-5555",
  "contactEmail": "john@example.com",
  "notes": "Homeowner wants us to follow up Friday."
}
```

### Processing

The API:

1. Retrieves the current snapshot.
2. Verifies edit permission.
3. Creates a new snapshot.
4. Copies the previous snapshot's values.
5. Applies submitted changes.
6. Preserves `initial_interaction_at`.
7. Sets a new `changed_at`.
8. Sets the previous snapshot's `is_current` to `false`.
9. Sets the new snapshot's `is_current` to `true`.
10. Preserves the same `interaction_group_id`.
11. Preserves the same `user_id`.
12. Stores the current `status_name` alongside the `status_id`.

### Notes

Existing notes are carried forward when an interaction is edited.

For example:

```text
Snapshot 1
Notes: "Homeowner wants a call Friday."
```

If the representative changes only the status, the new snapshot remains:

```text
Snapshot 2
Notes: "Homeowner wants a call Friday."
```

If the representative edits the note, the new snapshot contains the edited note.

---

# 15. Immutable Interaction Rules

The following endpoints do not exist:

```text
PATCH /api/interactions/:id
DELETE /api/interactions/:id
```

Interaction snapshots are immutable.

Changes are represented by creating a new snapshot through:

```text
POST /api/interactions/:id
```

The previous snapshot remains in the database.

There is no user-facing interaction-history endpoint in the MVP.

---

# 16. Map Data

## GET `/api/map/properties`

### Purpose

Retrieve map-ready property data within the requested geographic area.

### Authentication

Authenticated.

### Query Parameters

```text
north
south
east
west
```

Optional:

```text
status
dateFrom
dateTo
```

Example:

```text
GET /api/map/properties
    ?north=35.99
    &south=35.85
    &east=-83.80
    &west=-84.10
```

### Database Interaction

Reads:

- `properties`
- Current `interactions`
- `statuses`
- `users`
- `teams`

### Response

Returns only the information required to render map markers efficiently.

Example:

```json
[
  {
    "propertyId": "uuid",
    "latitude": 35.9,
    "longitude": -84.0,
    "status": "Interested",
    "interactionCount": 1
  }
]
```

### Authorization

The map uses the same visibility rules as the rest of the application.

The map cannot bypass organization or representative visibility restrictions.

---

# 17. Geocoding

Geocoding is an internal backend service in the MVP.

The React application does not communicate directly with the external geocoding provider.

There are no public geocoding endpoints.

Geocoding remains an internal backend implementation detail used by property resolution.

The workflow is:

```text
React Application
       │
       ↓
POST /api/properties/resolve
       │
       ↓
JoeKnock Backend
       │
       ↓
Geocoding Provider
       │
       ↓
Address + Coordinates
       │
       ↓
Property Resolution
```

This keeps the provider hidden behind the JoeKnock API and allows the provider to be replaced later without changing the frontend.

---

# 18. Reporting

## GET `/api/reports/activity`

### Purpose

Provide activity data for the MVP reporting interface.

### Authentication

Manager/Admin.

### Query Parameters

```text
dateFrom
dateTo
userId
teamId
statusId
```

Example:

```text
GET /api/reports/activity?dateFrom=2026-08-01&dateTo=2026-08-09
```

### Database Interaction

Reads from:

- `interactions`
- `properties`
- `users`
- `teams`
- `statuses`

No reporting-specific database tables are required.

---

## Knock Counting

The MVP distinguishes between the initial interaction and later snapshot changes.

The initial knock is determined using:

```text
initial_interaction_at
```

A knock is counted only when the representative first creates an interaction group for that organization + property + representative combination.

Changing an interaction does not create another knock.

### Example

```text
Aug 1 — Rep A knocks Property 123
Aug 2 — Rep A edits status
Aug 4 — Rep A edits notes
```

This represents:

```text
1 knock
```

not three.

A future expiration/re-knock system may introduce new interaction groups, but this is outside the MVP.

---

## Status Reporting

Snapshots can be used to determine the current state and changes occurring within a reporting period.

Historical snapshots must not be counted as additional physical knocks.

The MVP does not maintain a separate activity-log table.

---

# 19. Authorization Rules

Every protected endpoint enforces organization boundaries.

A user cannot access another organization's resources by changing a UUID in the request.

Authorization applies to:

- Users
- Teams
- Statuses
- Properties
- Interactions
- Reports
- Organization settings

### Organization Isolation

Every organization-owned resource is resolved within the authenticated user's organization.

For example:

```text
GET /api/properties/{id}
```

must not expose a property belonging to another organization.

---

# 20. Representative Visibility

The MVP supports three organization-level visibility settings.

## `own`

A representative sees:

- Their own interactions.

## `team`

A representative sees:

- Their own interactions.
- Interactions belonging to users on any team they belong to.

A representative belonging to no teams sees only their own interactions.

## `organization`

A representative sees:

- Organization-wide interactions.

### Important

Visibility does not grant editing permission.

A representative may be able to **see** another representative's interaction without being able to modify it.

---

# 21. Interaction Editing Permissions

The MVP intentionally keeps interaction ownership simple.

### Representative

Can:

- View permitted interactions.
- Create their own interactions.
- Edit their own interactions.

Cannot edit another representative's interaction.

### Manager

Can:

- View permitted interactions.
- Create their own interactions.
- Edit their own interactions.

Managers are view-only when viewing another representative's interaction.

### Administrator

Can:

- View permitted interactions.
- Create their own interactions.
- Edit their own interactions.

Administrators are view-only when viewing another representative's interaction.

The MVP does not include:

- Lead ownership transfer
- Lead reassignment
- Credit reassignment
- Manager override editing
- Lead claiming

---

# 22. User Deactivation

Deactivation changes account access only.

```text
Rep A
  ↓
Deactivated
```

Existing data remains:

```text
Rep A
  │
  ├── Interaction Group 1
  │      ├── Snapshot 1
  │      └── Snapshot 2
  │
  └── Interaction Group 2
         └── Snapshot 1
```

Nothing is reassigned or deleted.

The deactivated user:

- Cannot log in.
- Cannot create interactions.
- Cannot edit interactions.
- Remains associated with historical records.

---

# 23. Data Deletion

The MVP intentionally provides **no deletion functionality for organization data**.

There are no hard-delete or soft-delete workflows for:

- Organizations
- Users
- Teams
- Statuses
- Properties
- Interactions
- Interaction snapshots

The only relationship deletion endpoint is:

```text
DELETE /api/teams/:id/users/:userId
```

which removes a team membership relationship.

This does not delete either resource.

---

# 24. Final Endpoint List

## Authentication

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
```

## Current User

```text
GET    /api/me
```

## Organization

```text
GET    /api/organization
PATCH  /api/organization

GET    /api/organization/settings
PATCH  /api/organization/settings
```

## Users

```text
GET    /api/users
GET    /api/users/:id
POST   /api/users
PATCH  /api/users/:id
PATCH  /api/users/:id/active
```

## Teams

```text
GET    /api/teams
GET    /api/teams/:id
POST   /api/teams
PATCH  /api/teams/:id
POST   /api/teams/:id/users
DELETE /api/teams/:id/users/:userId
```

## Statuses

```text
GET    /api/statuses
GET    /api/statuses/:id
POST   /api/statuses
PATCH  /api/statuses/:id
PATCH  /api/statuses/:id/active
```

## Properties

```text
GET    /api/properties
GET    /api/properties/:id
POST   /api/properties/resolve
```

## Interactions

```text
GET    /api/properties/:propertyId/interactions
POST   /api/properties/:propertyId/interactions

GET    /api/interactions/:id
POST   /api/interactions/:id
```

## Map

```text
GET    /api/map/properties
```

## Reporting

```text
GET    /api/reports/activity
```

---

# 25. Total MVP Endpoint Count

| Area           | Endpoints |
| -------------- | --------: |
| Authentication |         3 |
| Current User   |         1 |
| Organization   |         4 |
| Users          |         5 |
| Teams          |         6 |
| Statuses       |         5 |
| Properties     |         3 |
| Interactions   |         4 |
| Map            |         1 |
| Reporting      |         1 |
| **Total**      |    **33** |

---

# 26. API-to-Database Summary

| API Area              | Primary Tables                                             |
| --------------------- | ---------------------------------------------------------- |
| Authentication        | `users`, `organizations`, `organization_settings`          |
| Current User          | `users`, `teams`, `team_users`                             |
| Organization          | `organizations`                                            |
| Organization Settings | `organization_settings`                                    |
| Users                 | `users`, `team_users`                                      |
| Teams                 | `teams`, `team_users`, `users`                             |
| Statuses              | `statuses`                                                 |
| Properties            | `properties`                                               |
| Property Interactions | `interactions`, `properties`, `users`, `statuses`          |
| Map                   | `properties`, `interactions`, `statuses`, `users`, `teams` |
| Geocoding             | External provider; no JoeKnock table                       |
| Reporting             | `interactions`, `properties`, `users`, `teams`, `statuses` |

---

# 27. Core API Architecture

```text
                         ORGANIZATION
                              │
             ┌────────────────┼────────────────┐
             │                │                │
           USERS            TEAMS           STATUSES
             │                │
             └───────┬────────┘
                     │
                 VISIBILITY
                     │
                     ▼
                 PROPERTIES
                     │
                     ▼
              INTERACTION GROUP
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
      SNAPSHOT    SNAPSHOT    SNAPSHOT
          │          │          │
          └──────────┼──────────┘
                     │
              CURRENT SNAPSHOT
                     │
             ┌───────┴───────┐
             ▼               ▼
            MAP           REPORTING
```

The core architectural rules are:

1. Every user belongs to one organization.
2. Every property belongs to one organization.
3. Every interaction belongs to a property and organization.
4. `property_id` identifies the property.
5. `interaction_group_id` identifies the organization/property/representative interaction history.
6. `id` identifies an individual immutable interaction snapshot.
7. Interaction snapshots are never deleted.
8. Changes create new interaction snapshots.
9. `initial_interaction_at` represents the first knock for that organization/property/representative interaction history.
10. `changed_at` represents when the current snapshot was saved.
11. An organization/property/representative combination has one interaction group during the MVP.
12. A future expiration/re-knock system is outside the MVP.
13. Users are deactivated rather than deleted.
14. Teams are not deleted.
15. Statuses are organization-defined rather than hard-coded.
16. Deactivated statuses remain available to historical snapshots.
17. Organization data is never deleted in the MVP.
18. Team membership can be removed without affecting historical interaction records.
19. Visibility and editing permissions are separate concepts.
20. Only the owner of an interaction group can edit it.
21. Managers and administrators are view-only when viewing another representative's interaction.
22. There is no lead ownership or credit reassignment system.
23. Map data follows the same authorization rules as normal property data.
24. Geocoding is handled internally by the JoeKnock backend.
25. A property requires a valid address.
26. The geocoder's returned address is used as the property's address in the MVP.
27. Latitude and longitude are not user-editable.
28. Properties cannot be manually edited or deleted in the MVP.
29. Reporting is generated from existing property and interaction data.
30. No separate activity-log table is required.
31. Historical interaction snapshots remain available in the database even though the MVP primarily displays current state.
32. The API never trusts client-supplied organization or user ownership identifiers.
33. All organization-owned resources are protected by organization-level authorization.
