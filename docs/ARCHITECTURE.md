# JoeKnock Architecture

This document captures the implementation details that are useful for technical review but too detailed for the main portfolio README.

## 1. System overview

JoeKnock is a full-stack field operations application with a map-centric frontend and a PostgreSQL-backed API. The project is structured around a few core domain areas:

- authentication and authorization
- organization and user management
- teams and membership
- status definitions
- property resolution and property records
- interaction creation and revision
- map visibility and filtering
- reports and exports

The application is intentionally organized around a practical field workflow rather than a generic CRM lifecycle.

## 2. Repository structure

```text
JoeKnock/
├── .env.example
├── package.json
├── ddd/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── app.js
│   │   │   ├── auth/
│   │   │   ├── common/
│   │   │   ├── config/
│   │   │   ├── db/
│   │   │   ├── exports/
│   │   │   ├── interactions/
│   │   │   ├── map/
│   │   │   ├── middleware/
│   │   │   ├── organization/
│   │   │   ├── properties/
│   │   │   ├── reports/
│   │   │   ├── routes/
│   │   │   ├── statuses/
│   │   │   ├── teams/
│   │   │   └── users/
│   │   ├── migrations/
│   │   ├── scripts/
│   │   ├── tests/
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       ├── tests/
│       ├── playwright.config.js
│       └── package.json
├── docs/
├── Wireframes/
└── README.md
```

## 3. Frontend architecture

The frontend is a React application using Vite. It includes the main app shell, route-based navigation, auth state management, map features, settings pages, and report/export screens.

Key frontend files:

- `ddd/frontend/src/main.jsx`
- `ddd/frontend/src/app/App.jsx`
- `ddd/frontend/src/auth/AuthProvider.jsx`
- `ddd/frontend/src/auth/authStorage.js`
- `ddd/frontend/src/api/client.js`
- `ddd/frontend/src/pages/MapPage.jsx`
- `ddd/frontend/src/pages/SettingsPage.jsx`
- `ddd/frontend/src/pages/UsersPage.jsx`
- `ddd/frontend/src/pages/ActivityReportPage.jsx`

The frontend uses a shared API client for all HTTP calls. Authentication state is stored in localStorage and included as a Bearer token on protected requests.

## 4. Backend architecture

The backend uses Express and a service/repository pattern. Global app setup occurs in `ddd/backend/src/app.js`, and the API is mounted through `ddd/backend/src/routes/apiRoutes.js`.

### Request lifecycle

1. Global middleware runs first: request ID, Helmet, CORS, rate limiting, JSON parsing, and request logging.
2. Health checks are mounted at `/health`.
3. Protected domain routes are mounted under `/api`.
4. Each route validates input before handing control to a service.
5. A service enforces business logic and calls repository queries.
6. Repository functions read or write to PostgreSQL.
7. Results are serialized into API responses.

The main backend entry points are:

- `ddd/backend/src/server.js`
- `ddd/backend/src/app.js`
- `ddd/backend/src/routes/apiRoutes.js`
- `ddd/backend/src/middleware/authMiddleware.js`
- `ddd/backend/src/common/errors.js`

## 5. Authentication and authorization

Authentication and authorization are implemented in the backend and are tied directly to the JWT claims.

### JWT claims

The token includes:

- `sub`: user ID
- `organizationId`: authenticated organization
- `role`: `rep`, `manager`, or `admin`

This is generated in `ddd/backend/src/auth/jwt.js` and validated in `ddd/backend/src/middleware/authMiddleware.js`.

### Login

The login flow verifies the user password using Argon2 and issues a signed JWT if the account is active.

Relevant files:

- `ddd/backend/src/auth/authService.js`
- `ddd/backend/src/auth/authRoutes.js`
- `ddd/backend/src/auth/password.js`
- `ddd/backend/src/auth/jwt.js`

### Role restrictions

Route-level role restrictions are implemented in route modules such as:

- `organization/organizationRoutes.js`
- `users/usersRoutes.js`
- `teams/teamsRoutes.js`
- `statuses/statusesRoutes.js`
- `reports/reportsRoutes.js`
- `exports/exportsRoutes.js`

### Visibility

Visibility is not only a route concern. Several repository queries enforce organization and role-sensitive visibility logic in SQL. This includes map markers and interaction visibility by property and role.

## 6. Database design

The database is PostgreSQL. Schemas are managed through node-pg-migrate under `ddd/backend/migrations`.

### Core tables

| Table                   | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `organizations`         | tenant boundary for each organization          |
| `organization_settings` | visibility settings and timezone               |
| `users`                 | application users and their role/active status |
| `teams`                 | team definitions within an organization        |
| `team_users`            | link between users and teams                   |
| `statuses`              | workflow statuses used by the field team       |
| `properties`            | permanent location records                     |
| `interactions`          | visit history and snapshot records             |

### Notable constraints and indexes

- unique index on `(organization_id, lower(email))` for users
- unique index on `(organization_id, normalized_address)` for properties
- partial unique index enforcing one current interaction per `interaction_group_id`
- uniqueness for `client_request_id` within an organization when present
- foreign key constraints tying properties, interactions, and team membership to the organization boundary

### Example data model behavior

The interaction model is implemented as current-snapshot logic rather than a simple row mutation:

- a new interaction creates an `interaction_group_id`
- the initial snapshot is marked as current
- revising an interaction clears the current flag and creates a new snapshot
- repository queries select the visible current snapshot or a visible historical snapshot depending on the action

This is implemented in:

- `ddd/backend/migrations/1724100000000_create_interactions_table.js`
- `ddd/backend/src/interactions/interactionsService.js`
- `ddd/backend/src/interactions/interactionsRepository.js`

## 7. API endpoint groups

The backend mounts all domain APIs under `/api` via `buildApiRoutes`.

### Auth and identity

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

### Organization and settings

- `GET /api/organization`
- `PATCH /api/organization`
- `GET /api/organization/settings`
- `PATCH /api/organization/settings`

### Users and teams

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/active`
- `GET /api/teams`
- `POST /api/teams`
- `POST /api/teams/:id/users`
- `DELETE /api/teams/:id/users/:userId`

### Statuses

- `GET /api/statuses`
- `POST /api/statuses`
- `PATCH /api/statuses/:id`
- `PATCH /api/statuses/:id/active`

### Map and property workflow

- `GET /api/map/properties`
- `POST /api/properties/resolve`
- `GET /api/properties/:id`
- `POST /api/properties/:propertyId/interactions`
- `GET /api/properties/:propertyId/interactions`
- `GET /api/interactions/:id`
- `POST /api/interactions/:id`

### Reports and exports

- `GET /api/reports/activity`
- `GET /api/exports/properties`

### Health

- `GET /health`

## 8. Services and repositories

The actual project structure follows a layered pattern.

### Service layer

Examples include:

- `ddd/backend/src/auth/authService.js`
- `ddd/backend/src/map/mapService.js`
- `ddd/backend/src/properties/propertiesService.js`
- `ddd/backend/src/interactions/interactionsService.js`
- `ddd/backend/src/reports/reportsService.js`
- `ddd/backend/src/exports/exportsService.js`

Services handle validation-aligned business rules, permission checks, and orchestration.

### Repository layer

Examples include:

- `ddd/backend/src/auth/authRepository.js`
- `ddd/backend/src/map/mapRepository.js`
- `ddd/backend/src/properties/propertiesRepository.js`
- `ddd/backend/src/interactions/interactionsRepository.js`
- `ddd/backend/src/reports/reportsRepository.js`

Repositories are the point where SQL queries and visibility logic are implemented.

## 9. Environment and configuration

The backend reads environment variables from the repository root `.env` file using `ddd/backend/src/config/env.js` and `ddd/backend/src/db/client.js`.

The root `.env.example` file documents the expected variables:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `TEST_DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `LOG_LEVEL`
- `VITE_API_BASE_URL`

The frontend reads `VITE_API_BASE_URL` from the Vite environment in `ddd/frontend/src/config/env.js`.

## 10. Data flow examples

### Example: map marker request

1. Frontend calls `GET /api/map/properties` with the current map bounds.
2. `authMiddleware` validates the JWT and attaches `req.auth`.
3. `buildMapRoutes` calls `listVisiblePropertyMarkers`.
4. `mapService` reads organization settings and calls repository queries.
5. The repository filters markers based on organization and rep visibility rules.
6. Marker data is returned to the frontend and rendered on the map.

### Example: resolve property and create interaction

1. Frontend calls `POST /api/properties/resolve` with latitude and longitude.
2. Backend resolves the location through the geocoding provider.
3. Address normalization and deduplication occur before storing data.
4. Frontend then submits an interaction using `POST /api/properties/:propertyId/interactions`.
5. The interaction service creates or revises a current snapshot depending on the operation.
6. Visibility and current-state indexes enforce the integrity of the model.

## 11. Testing evidence

The repository includes a live vitest suite and frontend tests. A recent verified backend run produced the following result:

- 35 test files passed
- 233 tests passed
- exit code 0

The actual commands used are in the project package files.

## 12. Deployment notes

The repository does not currently include a verified deployment configuration or live URL. Prior project context may mention Render, but the codebase itself should be treated as local-development oriented unless deployment files or a current live environment are provided.

This section should be confirmed with the project owner before being treated as a final public deployment statement.
