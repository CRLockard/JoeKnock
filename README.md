# JoeKnock

> Knock. Click. Go.

JoeKnock is a full-stack capstone project built for field operations teams that need to manage properties, track activity, and keep organization-scoped records aligned with team and role-based permissions. The app combines a map-driven workflow with an authenticated backend so users can locate properties, record visits, and review the current state of those records within a shared organization.

## Key Features

- Map-first property workflow using React, React Router, and Leaflet
- Property resolution from map coordinates with normalized address handling
- Duplicate prevention and organization-scoped property records
- Interaction history with current-state snapshot logic
- Team, user, and status management within an organization
- Activity reporting and export support for operational review
- Role-based access for rep, manager, and admin users

## Technology Stack

| Layer          | Technologies                                                          | Role in the project                                      |
| -------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Frontend       | React 18, Vite, React Router, Leaflet, React Leaflet                  | User interface, map workflows, route-based navigation    |
| Backend        | Node.js, Express, Helmet, CORS, express-validator, express-rate-limit | API server, validation, auth enforcement, business logic |
| Database       | PostgreSQL, pg, node-pg-migrate                                       | Persistent storage and schema management                 |
| Authentication | Argon2, JWT                                                           | Password verification and authenticated session identity |
| Testing        | Vitest, Playwright, Supertest                                         | Automated validation for backend and frontend behavior   |
| Tooling        | ESLint, Prettier, concurrently                                        | Local development, linting, and multi-service startup    |

## Architecture Overview

JoeKnock follows a simple full-stack structure:

- the React frontend handles the user experience and map interaction workflow
- the Express backend exposes protected API routes and enforces access rules
- PostgreSQL stores organization, user, team, status, property, and interaction data
- services and repositories separate business logic from data access

A typical request flow looks like this:

1. The frontend loads auth state from local storage and sends a Bearer token with API requests.
2. The backend validates the JWT and attaches the authenticated user context to the request.
3. Protected routes delegate to domain services such as auth, users, teams, statuses, map, properties, interactions, reports, and exports.
4. Services call repositories that read and write PostgreSQL while enforcing organization and role-scoped visibility.
5. Structured responses are returned to the frontend and rendered in the UI.

```text
React frontend
  │
  ├── pages / UI screens
  ├── API client with Bearer JWT
  └── map + interaction workflows
       │
       ▼
Express API
  │
  ├── request validation
  ├── auth middleware
  ├── route modules
  └── service / repository layer
       │
       ▼
PostgreSQL
  │
  ├── organizations
  ├── users / teams
  ├── statuses
  ├── properties
  └── interactions
```

Detailed implementation notes, route structure, and schema information are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Technical Challenges

The project addresses several engineering concerns that are visible in the repository and relevant to a software engineering review:

- Authentication and role-based permissions across protected routes
- Organization and team visibility rules that prevent cross-tenant access
- Geocoding, address normalization, and property deduplication logic
- Interaction history and current-state snapshot behavior for historical versus active records
- Frontend/backend communication and shared auth state in a map-driven workflow

## Running Locally

### Prerequisites

- Node.js 18+
- PostgreSQL running locally
- A development database and a separate test database

### Environment variables

The project expects environment values from the repository root `.env` file, with defaults documented in [.env.example](.env.example).

Required names include:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `TEST_DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `LOG_LEVEL`
- `VITE_API_BASE_URL`

Do not commit private credentials or live connection strings.

### Setup

```bash
git clone https://github.com/CRLockard/JoeKnock.git
cd JoeKnock
cp .env.example .env
npm install
npm install --prefix ddd/backend
npm install --prefix ddd/frontend
```

Create the local PostgreSQL databases referenced in `.env`, then run:

```bash
cd ddd/backend
npm run migrate:up
```

Optional local seed account:

```bash
npm run seed:dev
```

Start the application:

```bash
cd ../..
npm run dev
```

The backend defaults to port `3000`, and the frontend is served by Vite on port `5173`.

## Testing

The project includes automated backend tests for auth, validation, permissions, organization isolation, property workflows, interactions, reporting, and team/user management. Based on the verified backend suite run, the project passed 233 tests across 35 test files with exit code 0.

```bash
cd ddd/backend
npm test -- --run
```

This verified run covers the backend validation and business logic in the repository. Frontend Vitest tests and Playwright-based browser checks were not part of that verified run and are not claimed as passing in this document.

## Deployment

JoeKnock was previously deployed on Render as part of its development and demonstration. The hosted instance is no longer active following the expiration of the free hosting period in September 2026. The application can still be run locally using the setup instructions above.

## Future Improvements

These are reasonable next steps based on the current application structure, but they are not represented as completed functionality in the repository:

- stronger production deployment and environment management
- more advanced audit logging and admin review workflows
- mobile-first UX refinements for smaller screens
- map clustering and larger dataset handling
- additional reporting and analytics capabilities
- optional cookie-based authentication if the app evolves toward a more production-focused deployment model

## Additional Technical Documentation

For implementation details, schema notes, endpoint structure, and deeper technical review, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

This project was completed as a full-stack software engineering capstone and is intended to demonstrate practical engineering work in application architecture, backend logic, database design, and user-facing workflows.
