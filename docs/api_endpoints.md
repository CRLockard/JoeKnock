# JoeKnock MVP — API Endpoint Specification

## Overview

The JoeKnock MVP API provides the backend services required for authentication, organization management, user and team management, property management, field interactions, configurable statuses, map data, geocoding, and basic activity reporting.

The API is built around the following core relationship:

```text
Organization
    │
    ├── Users
    │      │
    │      └── Teams
    │
    ├── Statuses
    │
    └── Properties
           │
           └── Interactions
                  │
                  └── Immutable Snapshots
```

The API enforces organization isolation, authentication, authorization, and representative visibility rules.

---

# API Conventions

## Base URL

```text
/api
```

## Authentication

Protected endpoints require a valid JWT.

```http
Authorization: Bearer <token>
```

The authenticated user's identity and organization are determined from the JWT rather than being supplied by the client.

## HTTP Methods

| Method   | Purpose                                          |
| -------- | ------------------------------------------------ |
| `GET`    | Retrieve data                                    |
| `POST`   | Create a resource or perform an action           |
| `PATCH`  | Modify an existing mutable resource              |
| `DELETE` | Remove a relationship/resource where appropriate |

## Response Format

Successful requests return JSON.

Errors use appropriate HTTP status codes and a consistent error structure.

Example:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Property not found."
  }
}
```

---

# 1. Authentication

Authentication endpoints handle account registration, login, and logout.

## POST `/api/auth/register`

### Purpose

Create the initial organization and administrator account during onboarding.

### Authentication

Public

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

Returns the newly created user and authentication information.

---

## POST `/api/auth/login`

### Purpose

Authenticate an existing user.

### Authentication

Public

### Request

```json
{
  "email": "john@example.com",
  "password": "password"
}
```

### Database Interaction

Reads from:

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

End the current authenticated session.

### Authentication

Authenticated

### Database Interaction

If server-side session tracking is implemented, the session is invalidated.

If JWT authentication remains fully stateless, logout is primarily handled by removing the token from the client.

### Response

```json
{
  "message": "Logged out successfully."
}
```

---

# 2. Current User

## GET `/api/me`

### Purpose

Return information about the currently authenticated user.

### Authentication

Authenticated

### Database Interaction

Reads from:

- `users`
- `organizations`
- `team_users`
- `teams`

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

# 3. Organizations

Organization creation occurs during registration.

Administrative endpoints manage the current organization.

## GET `/api/organization`

### Purpose

Retrieve the current organization's information.

### Authentication

Manager/Admin

### Database Interaction

Reads from:

- `organizations`

---

## PATCH `/api/organization`

### Purpose

Update organization information.

### Authentication

Admin

### Database Interaction

Updates:

- `organizations`

### Example Request

```json
{
  "name": "Example Roofing"
}
```

The organization ID is determined from the authenticated user's JWT and is not supplied by the client.

---

# 4. Organization Settings

## GET `/api/organization/settings`

### Purpose

Retrieve organization-specific application settings.

### Authentication

Manager/Admin

### Database Interaction

Reads from:

- `organization_settings`

---

## PATCH `/api/organization/settings`

### Purpose

Update organization settings.

### Authentication

Admin

### Database Interaction

Updates:

- `organization_settings`

### MVP Setting

#### `rep_visibility`

Allowed values:

```text
own
team
organization
```

Meaning:

| Value          | Visibility                                         |
| -------------- | -------------------------------------------------- |
| `own`          | Representative sees only their own interactions    |
| `team`         | Representative sees interactions from their teams  |
| `organization` | Representative sees organization-wide interactions |

Managers and administrators retain access according to their role permissions.

---

# 5. Users

Users are organization members.

Users are deactivated rather than permanently deleted so historical interaction records retain their original user relationship.

## GET `/api/users`

### Purpose

Retrieve users belonging to the current organization.

### Authentication

Manager/Admin

### Database Interaction

Reads from:

- `users`
- `team_users`
- `teams`

### Supported Filters

```text
?active=true
?role=rep
?teamId=<uuid>
```

---

## GET `/api/users/:id`

### Purpose

Retrieve a specific user.

### Authentication

Manager/Admin

### Database Interaction

Reads from:

- `users`
- `team_users`
- `teams`

The API verifies that the requested user belongs to the authenticated user's organization.

---

## POST `/api/users`

### Purpose

Create or invite a new user into the organization.

### Authentication

Manager/Admin

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

### Database Interaction

Creates:

- `users`

The `organization_id` is determined from the authenticated administrator rather than the request body.

---

## PATCH `/api/users/:id`

### Purpose

Update mutable user information.

### Authentication

Manager/Admin

### Database Interaction

Updates:

- `users`

### Possible Fields

```json
{
  "firstName": "Jane",
  "lastName": "Johnson",
  "role": "manager"
}
```

Email and password changes may be handled through dedicated authentication flows if required.

---

## PATCH `/api/users/:id/active`

### Purpose

Activate or deactivate a user.

### Authentication

Admin

### Request

```json
{
  "isActive": false
}
```

### Database Interaction

Updates:

- `users.is_active`
- `users.deactivated_at`

The user is not physically deleted.

This preserves the user's relationship to historical interaction records.

---

# 6. Teams

Teams organize users within an organization.

Users and teams have a many-to-many relationship through `team_users`.

## GET `/api/teams`

### Purpose

Retrieve teams belonging to the current organization.

### Authentication

Manager/Admin

### Database Interaction

Reads from:

- `teams`
- `team_users`
- `users`

---

## GET `/api/teams/:id`

### Purpose

Retrieve a specific team and its members.

### Authentication

Manager/Admin

### Database Interaction

Reads from:

- `teams`
- `team_users`
- `users`

---

## POST `/api/teams`

### Purpose

Create a new team.

### Authentication

Manager/Admin

### Request

```json
{
  "name": "North Knoxville"
}
```

### Database Interaction

Creates:

- `teams`

The `organization_id` is determined from the authenticated user.

---

## PATCH `/api/teams/:id`

### Purpose

Update a team's information.

### Authentication

Manager/Admin

### Database Interaction

Updates:

- `teams`

---

## POST `/api/teams/:id/users`

### Purpose

Add a user to a team.

### Authentication

Manager/Admin

### Request

```json
{
  "userId": "uuid"
}
```

### Database Interaction

Creates:

- `team_users`

The API verifies that both the team and user belong to the same organization.

---

## DELETE `/api/teams/:id/users/:userId`

### Purpose

Remove a user from a team.

### Authentication

Manager/Admin

### Database Interaction

Deletes the appropriate relationship from:

- `team_users`

This does not delete or deactivate the user.

---

# 7. Statuses

Statuses define the organization's field-interaction workflow.

Statuses are configurable rather than hard-coded into the application.

## GET `/api/statuses`

### Purpose

Retrieve active statuses available to the current organization.

### Authentication

Authenticated

### Database Interaction

Reads from:

- `statuses`

---

## GET `/api/statuses/:id`

### Purpose

Retrieve a specific status.

### Authentication

Authenticated

### Database Interaction

Reads from:

- `statuses`

---

## POST `/api/statuses`

### Purpose

Create a new organization status.

### Authentication

Manager/Admin

### Request

```json
{
  "name": "Interested",
  "description": "Homeowner expressed interest.",
  "displayOrder": 1
}
```

### Database Interaction

Creates:

- `statuses`

The `organization_id` is determined from the authenticated user.

---

## PATCH `/api/statuses/:id`

### Purpose

Update a status.

### Authentication

Manager/Admin

### Database Interaction

Updates:

- `statuses`

### Possible Fields

- `name`
- `description`
- `display_order`

Historical interaction snapshots are not changed when a status is edited.

---

## PATCH `/api/statuses/:id/active`

### Purpose

Activate or deactivate a status.

### Authentication

Manager/Admin

### Request

```json
{
  "isActive": false
}
```

### Database Interaction

Updates:

- `statuses.is_active`

Existing historical interactions remain unchanged.

---

# 8. Properties

Properties represent physical locations being canvassed.

A property can have multiple separate interaction histories.

## GET `/api/properties`

### Purpose

Retrieve properties visible to the current user.

This is one of the primary endpoints used by the map interface.

### Authentication

Authenticated

### Database Interaction

Reads from:

- `properties`
- `interactions`
- `users`
- `teams`
- `statuses`

### Supported Filters

The endpoint supports filtering by:

- Status
- Date range
- Geographic/map bounds

Example:

```text
GET /api/properties?status=Interested
```

### Authorization

The API applies:

- Organization isolation
- User role
- Representative visibility settings
- Team membership

A user cannot retrieve another organization's properties.

---

## GET `/api/properties/:id`

### Purpose

Retrieve a specific property.

### Authentication

Authenticated

### Database Interaction

Reads from:

- `properties`

The API verifies that the property belongs to the user's organization.

---

## POST `/api/properties`

### Purpose

Create a new property.

This normally occurs when a representative selects a property/address that does not already exist in JoeKnock.

### Authentication

Authenticated

### Request

```json
{
  "addressLine1": "123 Main Street",
  "addressLine2": null,
  "city": "Knoxville",
  "state": "TN",
  "postalCode": "37923",
  "country": "USA",
  "latitude": 35.1234567,
  "longitude": -84.1234567
}
```

### Database Interaction

Creates:

- `properties`

The `organization_id` is determined from the authenticated user.

### Duplicate Handling

The API should attempt to match an existing property using the normalized address before creating a duplicate property.

---

## PATCH `/api/properties/:id`

### Purpose

Update mutable property information.

### Authentication

Authenticated

### Database Interaction

Updates:

- `properties`

Property updates do not modify historical interaction snapshots.

---

# 9. Property Interaction History

## GET `/api/properties/:propertyId/interactions`

### Purpose

Retrieve interaction history associated with a property.

### Authentication

Authenticated

### Database Interaction

Reads from:

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
      "currentSnapshot": {
        "id": "uuid",
        "statusName": "Interested",
        "interactionAt": "2026-08-08T15:30:00Z",
        "changedAt": "2026-08-08T15:35:00Z"
      }
    }
  ]
}
```

The endpoint can return current snapshots by default and historical snapshots when requested by the UI.

---

# 10. Interactions

Interactions represent field interactions with a property.

Interactions use immutable snapshots.

A property may have multiple separate interaction histories.

## POST `/api/properties/:propertyId/interactions`

### Purpose

Create a completely new interaction at a property.

This is used when a representative has a new field interaction with the property.

### Authentication

Authenticated

### Request

```json
{
  "statusId": "uuid",
  "interactionAt": "2026-08-09T15:30:00Z",
  "contactName": "John Smith",
  "contactPhone": "555-555-5555",
  "contactEmail": "john@example.com",
  "notes": "Homeowner interested in an inspection."
}
```

### Database Interaction

Creates a new row in:

- `interactions`

The API generates:

- `id`
- `interaction_group_id`

The API determines:

- `organization_id`
- `user_id`
- `initial_interaction_at`
- `changed_at`
- `is_current`

For a brand-new interaction:

```text
initial_interaction_at = interaction_at
is_current = true
```

---

## GET `/api/interactions/:id`

### Purpose

Retrieve a specific immutable interaction snapshot.

### Authentication

Authenticated

### Database Interaction

Reads from:

- `interactions`
- `properties`
- `users`
- `statuses`

---

## POST `/api/interactions/:id/revisions`

### Purpose

Create a new snapshot/revision of an existing interaction.

This endpoint is used when an existing interaction needs to be changed.

### Authentication

Authenticated

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

### Database Interaction

The API:

1. Retrieves the existing snapshot.
2. Gets its `interaction_group_id`.
3. Verifies the user has permission to modify the interaction.
4. Marks the current snapshot as `is_current = false`.
5. Creates a new interaction snapshot.
6. Reuses the same `interaction_group_id`.
7. Sets the new snapshot's `is_current = true`.
8. Preserves `initial_interaction_at`.
9. Sets a new `changed_at`.

The previous snapshot remains in the database.

### Example

```text
Interaction Group A
│
├── Snapshot 1
│   Status: No Answer
│
├── Snapshot 2
│   Status: Interested
│
└── Snapshot 3
    Status: Follow Up
    is_current = true
```

---

## GET `/api/interactions/:interactionGroupId/history`

### Purpose

Retrieve every snapshot belonging to a specific interaction history.

### Authentication

Authenticated

### Database Interaction

Reads from:

- `interactions`

All returned snapshots have the same:

```text
interaction_group_id
```

This endpoint allows authorized users and support/admin functionality to inspect how an interaction evolved.

---

# 11. Map Data

The map is a core part of the JoeKnock MVP.

The map endpoint provides the property and interaction information needed to render map markers efficiently.

## GET `/api/map/properties`

### Purpose

Retrieve map-ready property data within a geographic area.

### Authentication

Authenticated

### Query Parameters

Example:

```text
GET /api/map/properties
    ?north=35.99
    &south=35.85
    &east=-83.80
    &west=-84.10
```

Optional filters:

```text
status
dateFrom
dateTo
```

### Database Interaction

Reads from:

- `properties`
- current `interactions`
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
    "interactionCount": 2
  }
]
```

### Authorization

The endpoint must enforce:

- Organization isolation
- User role
- Representative visibility
- Team membership

---

# 12. Geocoding

Geocoding supports the map-first workflow.

JoeKnock should keep the geocoding provider behind the backend API rather than having the React application communicate directly with the provider.

This allows the provider to be changed later without requiring changes to the frontend.

The general flow is:

```text
React Application
       │
       ↓
JoeKnock API
       │
       ↓
Geocoding Provider
       │
       ↓
Address / Coordinates
```

## GET `/api/geocoding/reverse`

### Purpose

Convert geographic coordinates into an address.

This is used when a representative taps a location/house on the map and JoeKnock needs to determine the corresponding street address.

### Authentication

Authenticated

### Query Parameters

```text
lat
lng
```

Example:

```text
GET /api/geocoding/reverse?lat=35.900000&lng=-84.000000
```

### External Service Interaction

The JoeKnock backend sends the latitude and longitude to the configured geocoding provider.

The frontend does not communicate directly with the provider.

### Example Response

```json
{
  "address": {
    "addressLine1": "123 Main Street",
    "addressLine2": null,
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

### Intended MVP Workflow

```text
Rep taps house on map
        ↓
GET /api/geocoding/reverse
        ↓
Address returned
        ↓
Check whether property exists
        ↓
Existing property?
    ↙          ↘
  YES           NO
   ↓             ↓
Load property   Create property
   ↓             ↓
Start/record interaction
```

---

## GET `/api/geocoding/search`

### Purpose

Convert a street address or address search into geographic coordinates.

This provides the reverse operation of `/api/geocoding/reverse`.

### Authentication

Authenticated

### Query Parameters

```text
address
```

Example:

```text
GET /api/geocoding/search?address=123 Main Street Knoxville TN
```

### External Service Interaction

The JoeKnock backend sends the address to the configured geocoding provider.

### Example Response

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

### Intended Uses

- Address search
- Locating a property on the map
- Creating a property from an address
- Future navigation/search functionality

---

# 13. Reporting / Activity Data

The MVP does not require a separate reporting database or reporting tables.

Reports are generated from existing property and interaction data.

## GET `/api/reports/activity`

### Purpose

Retrieve field-activity data for the reporting interface.

### Authentication

Manager/Admin

### Query Parameters

```text
dateFrom
dateTo
userId
teamId
statusId
```

### Example

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

### Possible Results

The endpoint can provide:

- Total interactions
- Interactions by representative
- Interactions by team
- Interactions by status
- Properties contacted
- Activity by date

Historical snapshots must be handled carefully so revisions are not accidentally counted as separate field visits.

Only appropriate interaction records should be counted as actual field interactions.

---

# 14. Authorization Rules

All protected endpoints must enforce organization boundaries.

A user must never be able to access another organization's data simply by changing an ID in the URL.

For example:

```text
GET /api/properties/another-org-property-id
```

must not expose the property.

Every resource lookup must verify that the resource belongs to the authenticated user's organization.

This applies to:

- Properties
- Interactions
- Users
- Teams
- Statuses
- Organization settings
- Reports

Geocoding requests must also require authentication so the JoeKnock API cannot be abused as an unrestricted public proxy for the external geocoding provider.

---

# 15. Role Permissions

## Representative

Can:

- View permitted properties
- Create interactions
- View permitted interactions
- Create revisions for interactions they are authorized to modify
- View their own profile
- View applicable statuses
- Use map functionality
- Use geocoding functionality

Cannot:

- Manage organization users
- Manage teams
- Manage organization settings
- Manage statuses

---

## Manager

Can:

- Perform all representative functions
- View team activity
- View users
- Manage teams
- Manage statuses
- View activity reports

---

## Administrator

Can:

- Perform all manager functions
- Manage organization settings
- Manage organization information
- Create users
- Deactivate users
- Manage organization-level configuration

---

# 16. Immutable Interaction Rules

The following endpoints are intentionally NOT provided:

```text
PATCH  /api/interactions/:id
DELETE /api/interactions/:id
```

Interaction snapshots are immutable.

Changes create new snapshots through:

```text
POST /api/interactions/:id/revisions
```

This preserves the historical interaction record.

The interaction's `interaction_group_id` remains the same across all revisions.

---

# 17. Interaction Data Model Relationship

The interaction model uses three levels of identification:

```text
property_id
    ↓
Which property?

interaction_group_id
    ↓
Which field interaction/history at that property?

id
    ↓
Which immutable snapshot/version of that interaction?
```

Example:

```text
123 Main Street
│
├── Interaction Group A
│   ├── Snapshot 1 — No Answer
│   ├── Snapshot 2 — Interested
│   └── Snapshot 3 — Follow Up
│
└── Interaction Group B
    ├── Snapshot 1 — No Answer
    └── Snapshot 2 — Not Interested
```

This allows the same property to have multiple field interactions while preserving the history of changes made to each interaction.

---

# 18. API-to-Database Summary

| API Area              | Primary Tables                                             |
| --------------------- | ---------------------------------------------------------- |
| Authentication        | `users`, `organizations`, `organization_settings`          |
| Current User          | `users`, `teams`, `team_users`                             |
| Organizations         | `organizations`                                            |
| Organization Settings | `organization_settings`                                    |
| Users                 | `users`, `team_users`                                      |
| Teams                 | `teams`, `team_users`, `users`                             |
| Statuses              | `statuses`                                                 |
| Properties            | `properties`                                               |
| Property Interactions | `interactions`, `properties`, `users`, `statuses`          |
| Map                   | `properties`, `interactions`, `statuses`, `users`, `teams` |
| Geocoding             | External geocoding provider; no JoeKnock table required    |
| Reporting             | `interactions`, `properties`, `users`, `teams`, `statuses` |

---

# 19. Complete Endpoint List

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
POST   /api/properties
PATCH  /api/properties/:id
```

## Interactions

```text
GET    /api/properties/:propertyId/interactions
POST   /api/properties/:propertyId/interactions

GET    /api/interactions/:id
POST   /api/interactions/:id/revisions
GET    /api/interactions/:interactionGroupId/history
```

## Map

```text
GET    /api/map/properties
```

## Geocoding

```text
GET    /api/geocoding/reverse
GET    /api/geocoding/search
```

## Reporting

```text
GET    /api/reports/activity
```

---

# 20. Total MVP Endpoint Count

| Area           | Endpoints |
| -------------- | --------: |
| Authentication |         3 |
| Current User   |         1 |
| Organization   |         4 |
| Users          |         5 |
| Teams          |         6 |
| Statuses       |         5 |
| Properties     |         4 |
| Interactions   |         5 |
| Map            |         1 |
| Geocoding      |         2 |
| Reporting      |         1 |
| **Total**      |    **37** |

---

# 21. Core API Architecture

The JoeKnock MVP API follows this relationship:

```text
Organization
     │
     ├── Users
     │     │
     │     └── Teams
     │
     ├── Organization Settings
     │
     ├── Statuses
     │
     └── Properties
             │
             └── Interactions
                    │
                    ├── Interaction Group
                    │       │
                    │       ├── Snapshot 1
                    │       ├── Snapshot 2
                    │       └── Snapshot 3
                    │
                    ├── User
                    └── Status


Map
 │
 ├── Properties
 │
 └── Geocoding
       │
       ├── Coordinates → Address
       └── Address → Coordinates
```

The core architectural rules are:

1. Every user belongs to an organization.
2. Every property belongs to an organization.
3. Every interaction belongs to a property and organization.
4. `property_id` identifies the property.
5. `interaction_group_id` identifies the interaction history.
6. `id` identifies the individual immutable snapshot.
7. Interaction snapshots are never deleted.
8. Changes create new interaction snapshots.
9. Users are deactivated rather than physically deleted.
10. Statuses are organization-defined rather than hard-coded.
11. API authorization enforces organization boundaries.
12. Representative visibility determines which interactions a representative can see.
13. Map data is filtered through the same authorization rules as normal property data.
14. Geocoding is handled through the JoeKnock backend rather than directly from the frontend.
15. Reverse geocoding converts map coordinates into an address.
16. Forward geocoding converts an address into coordinates.
17. Geocoding does not require a dedicated JoeKnock database table.
18. Reporting is generated from existing property and interaction data rather than a separate activity-log table.
