# JoeKnock MVP — Architecture Decision Summary

**Purpose:**
A concise reference for the major technical and architectural decisions made for the JoeKnock MVP.

This document is not the source of truth for implementation. The detailed ADRs, schema documentation, API contracts, testing strategy, and foundation specification remain authoritative.

The purpose of this document is to help the team quickly understand **what was decided, why it was decided, and what tradeoffs were accepted.**

Current implementation baseline in this document has been reconciled to the finalized MVP foundation (JavaScript + `pg` + `node-pg-migrate` + `express-validator` + Argon2id).

---

# 1. Technology Stack

## React

**Decision:** Use React for the frontend.

**Why:**
React is already familiar from the University of Michigan program and is well suited to JoeKnock's interactive, map-focused interface.

**Pros**

- Already familiar.
- Large ecosystem.
- Excellent component model.
- Good fit for interactive applications.
- Strong portfolio/capstone value.

**Cons**

- Requires managing frontend state and application structure.
- Can become overly complicated if too many libraries/patterns are introduced.

**Defense:**
"React gives us a familiar, well-supported component framework and is a strong fit for an interactive application like JoeKnock. It also lets us build on skills I've already developed rather than introducing unnecessary learning overhead."

---

# 2. JavaScript

**Decision:** Use JavaScript for both frontend and backend.

**Why:**
JoeKnock has several areas where incorrect data can create serious bugs, but the MVP prioritizes delivery speed, simplicity, and clear conventions over additional compile-time tooling.

**Pros**

- Lower setup/configuration overhead for a solo capstone.
- Faster onboarding for implementation tickets.
- Keeps frontend and backend language consistent.
- Supports the finalized foundation and repository structure.

**Cons**

- Less compile-time type enforcement.
- Requires disciplined API/schema/test-driven validation.

**Defense:**
"JavaScript keeps the MVP implementation focused and explainable while correctness is enforced through API contracts, schema constraints, and automated tests."

---

# 3. Vite

**Decision:** Use Vite as the frontend build tool.

**Why:**
JoeKnock is a traditional React frontend communicating with a separate Express API. It does not need the additional complexity of a full-stack framework.

**Pros**

- Fast development server.
- Fast builds.
- Simple configuration.
- Excellent React support.
- Works naturally with a separated API architecture.

**Cons**

- Does not provide backend/server functionality.
- Requires us to manage frontend/backend separately.

**Defense:**
"JoeKnock already has a separate Express API, so Vite gives us exactly what the frontend needs without introducing a framework like Next.js that solves problems we don't currently have."

---

# 4. Node.js + Express

**Decision:** Use Node.js LTS with Express for the backend.

**Why:**
The project already uses React/JavaScript concepts, so Node and Express allow us to maintain a consistent language and relatively simple backend architecture.

**Pros**

- Same language across frontend/backend.
- Familiar.
- Lightweight.
- Excellent REST API support.
- Middleware model fits authentication, validation, authorization, and errors.

**Cons**

- Less opinionated than frameworks such as NestJS.
- Requires us to establish our own project conventions.
- Easy to create inconsistent structure without discipline.

**Defense:**
"Express gives us enough structure to build a professional REST API while still making the underlying HTTP and middleware concepts visible. That's useful for both the project and my learning."

---

# 5. PostgreSQL

**Decision:** Use PostgreSQL as the database.

**Why:**
JoeKnock's data is highly relational. Users belong to organizations, teams belong to organizations, properties have interactions, and permissions depend on those relationships.

**Pros**

- Strong relational model.
- ACID transactions.
- Excellent constraints and foreign keys.
- Mature and widely used.
- Strong support for complex queries and reporting.

**Cons**

- More structure than a document database.
- Schema changes require migration discipline.

**Defense:**
"JoeKnock has relationships and ownership boundaries that are naturally relational. PostgreSQL gives us strong constraints and transactions, which are especially important for organization isolation and historical interaction data."

---

# 6. PostgreSQL Access and Migrations

**Decision:** Use `pg`/node-postgres for database access and `node-pg-migrate` for schema migrations.

**Why:**
Explicit SQL through `pg` keeps data behavior transparent and easier to reason about for organization isolation, interaction snapshots, and reporting.

**Pros**

- Clear, explicit SQL behavior.
- Strong support for parameterized query safety.
- Migration history tracked through source-controlled files.
- No ORM abstraction mismatch when debugging complex joins/reporting.

**Cons**

- More manual SQL/query construction.
- Requires disciplined repository/query organization.

**Defense:**
"For this MVP, `pg` plus `node-pg-migrate` keeps the data layer explicit, testable, and aligned with the finalized foundation decisions."

---

# 7. REST API

**Decision:** Use REST with JSON under `/api`.

**Why:**
The application has clearly defined resources and operations, making REST straightforward and easy to understand.

**Pros**

- Simple mental model.
- Easy to test.
- Easy to document.
- Works naturally with Express.
- Easy for frontend and future integrations to consume.

**Cons**

- Can require multiple requests for some complex workflows.
- Less flexible than GraphQL for certain clients.

**Defense:**
"JoeKnock doesn't currently have the complexity or multiple-client requirements that would justify GraphQL. REST gives us a clear and predictable API that is easy to test and defend."

---

# 8. API Validation

**Decision:** Use `express-validator` for API boundary validation.

**Why:**
API requests come from outside the application and must be validated at runtime at the backend boundary.

**Pros**

- Tight integration with Express route handlers.
- Clear request-level validation and error responses.
- Keeps authoritative validation on the backend security boundary.

**Cons**

- Validation rules still require maintenance as contracts evolve.

**Defense:**
"`express-validator` keeps request validation close to route handling and enforces API contracts before business logic executes."

---

# 9. JWT Authentication

**Decision:** Use JWT bearer authentication with stateless logout.

**Why:**
This matches the established API design and keeps the MVP authentication architecture relatively simple.

**Pros**

- Stateless API authentication.
- Easy for frontend/API separation.
- No server-side session store required.
- Works well with protected REST endpoints.

**Cons**

- Revocation is more complicated.
- Token storage requires careful security considerations.
- A compromised token remains valid until expiration.

**Defense:**
"For the MVP, JWT keeps the API stateless and avoids introducing a session infrastructure we don't currently need. We are accepting the limitation that true server-side token revocation is outside the MVP."

---

# 10. localStorage for JWT

**Decision:** Store the JWT in localStorage for the MVP.

**Why:**
This provides persistent login behavior and is consistent with the simplicity of the MVP.

**Pros**

- Very simple implementation.
- Persists across page refreshes.
- Familiar frontend pattern.
- No server-side session infrastructure.

**Cons**

- Vulnerable to token theft if the application has a serious XSS vulnerability.
- Less secure than an appropriately designed HTTP-only cookie/session approach.

**Defense:**
"We're choosing simplicity for the MVP while acknowledging the security tradeoff. We mitigate risk through strict input validation, avoiding dangerous HTML injection patterns, minimal token payloads, and clearing auth state on logout."

---

# 11. Stateless Logout

**Decision:** Logout clears the client token; the server does not maintain a token blacklist.

**Why:**
The MVP does not need distributed session infrastructure or token revocation systems.

**Pros**

- Simple.
- Fast.
- No server-side session storage.
- Fits stateless JWT architecture.

**Cons**

- A stolen token remains valid until expiration.
- Cannot immediately revoke an individual token.

**Defense:**
"True server-side revocation would add infrastructure that isn't necessary for the MVP. We can introduce refresh-token rotation or server-side session management later if the product requires stronger revocation."

---

# 12. Organization Isolation

**Decision:** Every organization-owned resource is scoped by the authenticated user's organization.

**Why:**
JoeKnock is a multi-tenant application. Organization isolation is a fundamental security boundary.

**Pros**

- Prevents cross-customer data access.
- Simple security rule.
- Easy to test.
- Works consistently across resources.

**Cons**

- Every relevant query must enforce the organization scope.
- Requires disciplined backend implementation.

**Defense:**
"The organization ID comes from trusted authentication context rather than the client. Every organization-owned lookup includes the organization scope. This prevents a user from accessing another organization's resource simply by knowing its ID."

---

# 13. Roles

**Decision:** MVP roles are:

- `rep`
- `manager`
- `admin`

**Why:**
These roles represent the primary operational hierarchy without creating unnecessary permission complexity.

**Pros**

- Simple.
- Easy to understand.
- Sufficient for MVP.
- Easy to expand later.

**Cons**

- Role-based permissions can become restrictive as the product grows.
- More granular permissions may eventually be necessary.

**Defense:**
"Three roles cover the MVP's primary permission boundaries. More granular permission systems can be introduced if real-world requirements justify them."

---

# 14. Visibility vs. Edit Permission

**Decision:** Visibility and editing are separate authorization decisions.

Managers/admins do **not** automatically receive permission to edit another representative's interaction simply because they can view it.

**Why:**
Viewing organizational data and modifying another user's historical work are different operations.

**Pros**

- Safer authorization model.
- Protects historical records.
- Explicit permissions.
- Easier to reason about.

**Cons**

- Requires more deliberate authorization logic.
- May require additional workflows later for managerial corrections.

**Defense:**
"Having visibility into data doesn't automatically mean having permission to change it. Separating those concerns gives us a safer and more predictable authorization model."

---

# 15. Immutable Interaction Snapshots

**Decision:** Interactions are immutable historical snapshots.

When an interaction changes, a new interaction record is created rather than modifying the historical record.

**Why:**
JoeKnock needs a trustworthy history of what happened at a property.

**Pros**

- Historical accuracy.
- Natural audit trail.
- Previous states remain available.
- Easier to determine what changed and when.
- Reduces reliance on a separate activity-log table.

**Cons**

- More database records.
- Queries must distinguish current vs. historical snapshots.
- Updates require creating new records.

**Defense:**
"An interaction represents an event in the field. Changing the record should not erase what was previously recorded. Immutable snapshots preserve that history naturally."

---

# 16. No Separate Interaction Activity Log in MVP

**Decision:** Do not create a separate interaction activity-log table.

**Why:**
Immutable interaction snapshots already provide the historical record required by the MVP.

**Pros**

- Less schema complexity.
- Fewer writes.
- No duplicate audit information.
- History is represented directly by interaction records.

**Cons**

- More care is required when querying snapshot history.
- A future generalized audit system may still be needed.

**Defense:**
"Because interactions are immutable, the interaction history already tells us what changed and when. Adding another activity table would duplicate information without providing enough MVP value."

---

# 17. Vitest

**Decision:** Use Vitest as the primary JavaScript test runner.

**Why:**
It provides one modern testing ecosystem for frontend and backend unit/integration testing.

**Pros**

- Fast.
- Lightweight and compatible with JavaScript-first projects.
- Strong Vite integration.
- Familiar testing model.
- Reduces tool fragmentation.

**Cons**

- Different from some traditional Jest-based environments.
- Some ecosystem integrations may still be more mature in Jest.

**Defense:**
"Vitest gives us one consistent test runner across the JavaScript MVP while fitting naturally with Vite."

---

# 18. Supertest

**Decision:** Use Supertest for backend API/integration testing.

**Why:**
We want to test the actual Express HTTP layer rather than only testing individual functions.

**Pros**

- Simple.
- Works directly with Express.
- Tests routes, middleware, status codes, and responses.
- Excellent for authentication and organization-isolation tests.

**Cons**

- Primarily focused on HTTP/API testing.
- Browser behavior still requires an E2E tool.

**Defense:**
"Supertest lets us exercise the API the way a client actually uses it without requiring a real browser. That makes it ideal for route-level integration testing."

---

# 19. Playwright

**Decision:** Use Playwright for end-to-end testing.

**Why:**
Some JoeKnock workflows cannot be meaningfully tested through API calls alone, especially authentication and map-driven workflows.

**Pros**

- Real browser testing.
- Cross-browser support.
- Good debugging tools.
- Tests complete user workflows.

**Cons**

- Slower than unit/integration tests.
- More setup.
- Browser tests can be more fragile.

**Defense:**
"We don't need Playwright for everything. We use it for a small number of critical workflows where testing the actual browser experience provides value."

---

# 20. ESLint

**Decision:** Use ESLint for static code analysis.

**Why:**
Automated checks catch common mistakes and enforce project conventions.

**Pros**

- Mature ecosystem.
- Configurable.
- Catches common defects.
- Good editor integration.

**Cons**

- Configuration can become excessive.
- Rules can create unnecessary friction if poorly chosen.

**Defense:**
"ESLint is a low-cost guardrail. We're using it to catch problems automatically rather than relying entirely on code review."

---

# 21. Prettier

**Decision:** Use Prettier for formatting.

**Why:**
Formatting should be automated instead of being a source of code-review disagreement.

**Pros**

- Consistent code.
- Minimal configuration.
- Eliminates formatting debates.
- Excellent editor support.

**Cons**

- Limited control over certain formatting decisions.

**Defense:**
"Formatting isn't where engineering judgment should be spent. Prettier gives everyone the same format automatically."

---

# 22. dotenv + Typed Configuration

**Decision:** Use environment variables loaded through dotenv and validated by a typed configuration module.

**Why:**
Configuration and secrets should not be hardcoded into the application.

**Pros**

- Simple.
- Familiar.
- Keeps secrets outside source control.
- Allows separate development/test/production configurations.

**Cons**

- Local environment management remains manual.
- More sophisticated secret-management infrastructure may eventually be needed.

**Defense:**
"This is enough for an MVP while keeping configuration separate from code. A production deployment can later move secrets into a dedicated secret manager."

---

# 23. Database Migrations

**Decision:** Database schema changes are performed through source-controlled `node-pg-migrate` migrations.

**Why:**
The database needs to evolve predictably across development, testing, and production.

**Pros**

- Reproducible.
- Version controlled.
- Reviewable.
- Easy to apply to new environments.

**Cons**

- Migration mistakes can be difficult to undo.
- Requires discipline around schema changes.

**Defense:**
"A database schema is part of the application. Migrations allow us to version it alongside the code rather than relying on undocumented manual changes."

---

# 24. Dedicated Test Database

**Decision:** Tests use a dedicated database separate from development and production.

**Why:**
Automated tests must never risk corrupting real development or production data.

**Pros**

- Safe.
- Repeatable.
- Supports integration testing.
- Makes database behavior testable.

**Cons**

- Requires additional setup.
- Test data must be created and cleaned up.

**Defense:**
"Integration tests need to exercise the real database, but they should never share a database with normal development or production."

---

# 25. Test Isolation

**Decision:** Use a hybrid isolation strategy: transaction rollback where practical, deterministic cleanup where transactions do not fit.

**Why:**
Tests need to be independent without creating excessive infrastructure for the MVP.

**Pros**

- Fast.
- Prevents test-order dependencies.
- Lower complexity than creating a fresh database for every test.

**Cons**

- Some scenarios cannot easily use transaction rollback.
- Cleanup must be carefully implemented.

**Defense:**
"This gives us reliable isolation without the operational overhead of spinning up a new database for every test. If the project grows and parallelism becomes important, the strategy can evolve."

---

# 26. API Error Contract

**Decision:** Use a consistent JSON error structure:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message"
  }
}
```

**Why:**
Frontend code should not need to understand a different error format for every endpoint.

**Pros**

- Predictable.
- Easy to test.
- Easy for frontend consumers.
- Separates machine-readable error codes from human messages.

**Cons**

- Requires discipline across endpoints.
- Some errors may need additional metadata later.

**Defense:**
"A consistent error contract reduces frontend complexity and makes API behavior predictable."

---

# 27. Validation at the API Boundary

**Decision:** Validate untrusted API input before it reaches business logic.

**Why:**
Frontend validation improves UX but cannot be trusted for security.

**Pros**

- Protects backend.
- Clear boundary.
- Consistent errors.
- Prevents malformed data from reaching services/database.

**Cons**

- Some validation may exist in both frontend and backend.
- Business rules still require separate checks.

**Defense:**
"The frontend is controlled by the user and therefore cannot be a security boundary. The API must validate its own input."

---

# 28. Route → Controller → Service → Database

**Decision:** Use a relatively simple layered backend structure:

**Route → Controller → Service → DB**

**Why:**
This provides separation of responsibilities without creating excessive abstraction.

**Pros**

- Easy to understand.
- Easy to test.
- Keeps HTTP concerns separate from business logic.
- Avoids unnecessary architecture layers.

**Cons**

- Requires discipline around layer responsibilities.
- Very simple endpoints may feel like they have extra files.

**Defense:**
"We want enough structure to keep the application maintainable, but not so many abstraction layers that a small capstone becomes enterprise architecture."

---

# 29. Frontend API Client Using `fetch`

**Decision:** Use the native `fetch` API for frontend HTTP requests.

**Why:**
It is already familiar and avoids introducing an unnecessary HTTP library.

**Pros**

- Already familiar.
- No additional dependency.
- Native browser API.
- Easy to defend in a technical review.

**Cons**

- Requires some wrapper code for consistent error handling/auth headers.
- Less convenience than Axios.

**Defense:**
"Fetch provides everything we need for this application, and I already understand it. Adding Axios would give us convenience but not enough additional value to justify another dependency."

---

# 30. Foundation Before Feature Tickets

**Decision:** Build and verify the technical foundation before implementing US-001 and subsequent feature tickets.

**Why:**
Authentication, database access, testing, validation, error handling, and organization isolation are dependencies for almost every feature.

**Pros**

- Reduces rework.
- Establishes consistent patterns early.
- Makes feature tickets smaller.
- Gives Copilot clear implementation boundaries.

**Cons**

- Delays visible feature development slightly.
- Some foundation work cannot be demonstrated immediately to users.

**Defense:**
"We're not trying to build an entire framework before building the product. We're establishing only the infrastructure that multiple features depend on, so we don't have to retrofit it later."

---

# 31. Copilot's Role

**Decision:** Copilot is the implementation assistant, not the architecture owner.

**Why:**
The goal is for Corey to understand and defend the architecture rather than simply accept generated code.

**Copilot should:**

- Read the ticket first.
- Read relevant source-of-truth documentation.
- Inspect existing code.
- Implement only approved scope.
- Add tests.
- Report test results.
- Stop when architecture conflicts arise.

**Copilot should not:**

- Invent architecture.
- Resolve major contradictions silently.
- Add unnecessary dependencies.
- Perform unrelated refactoring.
- Expand MVP scope.

**Defense:**
"AI is useful for implementation speed, but architectural decisions still need human ownership. Copilot helps me build the system; it doesn't decide what system I'm building."

---

# 32. Documentation Source-of-Truth Strategy

**Decision:** Maintain explicit source-of-truth documents rather than allowing implementation tickets to become architectural authorities.

The general hierarchy is:

1. Product requirements (what JoeKnock should do)
2. API contracts + database schema (technical contracts)
3. Foundation specification (implementation baseline)
4. ADRs (architectural rationale)
5. Implementation specifications
6. GitHub Issues/tasks

**Why:**
Implementation tickets should translate approved decisions into work, not redefine the architecture.

**Pros**

- Reduces contradictions.
- Makes tickets easier to regenerate/update.
- Gives Copilot reliable context.
- Easier to review.

**Cons**

- Documentation requires maintenance.
- Multiple documents can still drift if changes aren't propagated.

**Defense:**
"We're separating the question of 'what system are we building?' from 'what work needs to be done?' That keeps implementation tickets from becoming accidental architecture documents."

---

# 33. Geocoding — Finalized MVP Contract

**Status:** Finalized.

Geocoding is an internal backend capability.

MVP frontend geocoding-related behavior uses:

`POST /api/properties/resolve`

MVP does not expose public `/api/geocoding/*` endpoints.

This keeps provider behavior behind the JoeKnock backend and prevents coupling frontend contracts to provider-specific APIs.

---

# 34. Overall Architecture Philosophy

The decisions above follow a common principle:

> **Use the simplest architecture that gives JoeKnock strong correctness, security, testability, and maintainability without introducing infrastructure the MVP does not need.**

That means:

- PostgreSQL rather than a document database because the data is relational.
- `pg` + `node-pg-migrate` rather than an ORM abstraction.
- Express rather than a heavier backend framework.
- REST rather than GraphQL.
- Native `fetch` rather than another HTTP dependency.
- JWT rather than a distributed session system.
- Immutable interactions rather than a separate audit system.
- Vitest + Supertest + Playwright rather than a collection of overlapping tools.
- Simple role-based authorization rather than a generalized permission engine.
- A simple layered backend rather than excessive abstraction.

The objective is **not** to build the most sophisticated possible system.

The objective is to build a system whose technical decisions are:

1. Appropriate for the product.
2. Secure enough for the MVP.
3. Testable.
4. Maintainable.
5. Explainable.
6. Defensible in a technical review.
7. Capable of evolving when the product requires it.
