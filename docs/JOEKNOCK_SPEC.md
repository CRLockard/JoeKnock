# JoeKnock Product and Engineering Specification

This is the maintained authority for JoeKnock product behavior, approved future
requirements, architecture constraints, data/API semantics, and engineering
workflow. The README and Copilot instructions are entry points only. Code and
tests are evidence of implementation, not authority to change a requirement.

**Baseline reviewed:** `main` at `a9446a5` (PR #50 merge). This is a
documentation consolidation, not a new code or test result. Current open-PR
status and validation are recorded in
[Release status](#release-status-and-follow-up).

## Status labels and change control

- **Implemented on main** — present in the reviewed main branch; this does not
  imply a new runtime test was run during this documentation change.
- **Approved V1 contract** — current intended product behavior.
- **Approved V2 direction** — owner-approved product outcome, not implemented
  and not authorization to begin work.
- **Known gap** — an implementation or launch requirement remains open.
- **Undecided proposal** — not approved; do not treat as a requirement.
- **Historical / retired** — context only; it cannot override this document.

Implement only the scope explicitly requested. When this specification has an
internal conflict, use the resolution recorded below; when a behavior remains
undecided, stop only the affected work and ask for a decision. Update this
document when an approved product or contract change is made. Do not silently
change a requirement to match a defect or an old ticket.

## Product and scope

JoeKnock is a map-first tool for organizations to record field interactions
with properties, share authorized information, and report activity. A property
is a location record, not a lead, customer, or sales opportunity. V1 does not
provide a sales pipeline, revenue or commission tracking, scheduling,
reassignment, or downstream customer lifecycle.

The existing V1 stack is React 18, JavaScript, Vite, React Router, Leaflet,
Node.js, Express, PostgreSQL, `pg`, and `node-pg-migrate`. The backend owns
authorization, organization isolation, validation, business rules, and data
integrity. The frontend presents the workflow and may keep private browser
drafts; frontend checks are never the security boundary.

## Implemented V1 behavior and approved baseline

### Organization, identity, and permissions

All business data is organization-scoped. The backend derives the actor and
organization from verified authentication context; a supplied ID or hidden UI
control is not authorization. Cross-organization access must not reveal foreign
records.

V1 users belong to one organization and have representative, manager, or admin
roles. Current main includes the PR #49 stabilization behavior: protected data
routes use the active database user and current role, manager edits retain
original interaction ownership, and managers cannot assign roles or deactivate
users. Representative visibility is governed by the organization's `own`,
`team`, or `organization` setting; organization admins retain organization
scope. Representatives edit their own interactions, managers edit their own
and permitted shared-team interactions, and admins may edit any interaction
in their organization. Managers can currently read organization/settings,
manage teams and statuses, and create representatives; that current V1 surface
is broader than the approved V2 policy below. The last active admin cannot be
demoted or deactivated.

The current visibility setting affects reads: `own` limits representatives to
their own records; `team` adds records shared through team membership; and
`organization` permits organization-wide reads. Managers can see their own
and shared-team records under the narrower settings; admins can read all
organization records. Visibility does not expand edit authority.

V1 registration is an API flow that creates an organization and its first
admin and requires a valid client-supplied IANA timezone; it is not a public
signup screen. V1 login uses email/password and preserves exact password input.
The global email lookup and organization-scoped uniqueness do not support
shared accounts across organizations. Passwords are stored as hashes; never
log or expose credentials, tokens, connection strings, hashes, or personal
field notes.

### Map, properties, and interaction capture

The map is the main workspace. Property resolution is performed by the backend
through `POST /api/properties/resolve`; the frontend does not call geocoding
providers directly. Properties are organization-owned and reused by normalized
address. A property without a visible current interaction need not have a map
marker. V1 does not provide status/date map filters or marker counts.
When location permission is denied or GPS is unavailable, manual map use must
remain possible. Recenter resumes following the current location.

V1 uses OpenStreetMap tiles and public Nominatim reverse geocoding. PR #49 added
a configurable provider identity and timeout, bounded in-process caching,
sharing of identical in-flight requests, and database advisory-gate pacing
with cooldown. The gate coordinates processes sharing its database and may hold
a connection while waiting; deployment capacity/policy checks remain open.
There is no general property-edit endpoint or user-editable coordinate flow.

The interaction record is an immutable snapshot in a history scoped to
organization, representative, and property. Revisions preserve prior business
values, original ownership, and notes that were not changed. The current
snapshot is the normal user-facing view; a historical timeline/recovery screen
is not implemented. Stale revisions are rejected rather than silently
overwritten. A same-key create retry returns the original result; a request ID
is not an interaction identity.

Drafts are private, browser-local, and are not shared interactions until
explicitly submitted. Drafts are scoped by organization, user, property, and
snapshot when editing; failed writes preserve draft work. They are plaintext
on the local device, not cross-device storage. PR #49 added read-time seven-day
expiration and deliberate-logout cleanup; physical removal is not guaranteed
while a browser is closed.

Map selection claims its identity before asynchronous property lookup. Late
lookup, detail, save, or error results cannot replace a newer selection.
Confirmed writes remain bound to the captured user, organization, property,
and interaction; a later refresh failure must not resubmit a successful write.
On mobile, controls and feedback must remain reachable with landscape and the
keyboard open; real-device validation remains a launch check.

### Daily knocks, dates, reports, and CSV

PR #49 implemented the approved daily-knock model:

- Count at most one knock per organization, representative, property, and
  organization-local calendar date. Different representatives receive
  independent credit.
- The organization's timezone at submission determines the stored
  `knock_date` and `knock_timezone`; changing the setting later does not move
  existing knocks.
- A confirmed same-day return appends information to that day's history but
  adds no count. A new local day can create a new counted history. Edits,
  including edits to older histories, never add counts.
- `SAME_DAY_VISIT_EXISTS` requires explicit confirmation. A request-ID retry
  returns the original result even if the retry occurs after midnight.
- Legacy rows without the new knock fields are not backfilled and are excluded
  from date-filtered reports and exports. The original demo database is
  preserved; local development uses `joeknock_devclean`.

Reports and CSV exports filter by the stored `knock_date` and use the same
authorized, visibility-filtered counted-knock set. Reports include
representative totals and a per-representative property breakdown: each
property appears once for that representative with its in-range knock count.
Status totals use the latest saved status for each counted history; edits and
same-day returns do not add activity.

CSV contains one row per qualifying counted history. `interactionDate` is the
original frozen knock date (`YYYY-MM-DD`), while the row contains that history's
latest authorized saved details. Private drafts are excluded. Existing CSV
columns and formula mitigation remain; do not claim formula protection is
universal across spreadsheet importers. A last-edited column, historical/as-of
export, and legacy-row review export are not approved.

### Data and API constraints

V1 business tables are organizations, organization settings, users, teams,
team memberships, statuses, properties, and interaction snapshots; the
`daily_knocks` view exposes counted activity.

| Entity | Important data and relationships |
|---|---|
| Organization/settings | Organization identity; one settings row with representative visibility and IANA timezone. |
| User | Organization, email, password hash, names, role, active state; email is unique case-insensitively within an organization. |
| Team/membership | Organization-owned team and organization-scoped user relationship; membership does not define a user's role. |
| Status | Organization, name, optional description, display order, active state. Snapshots preserve historical `status_name`. |
| Property | Organization, normalized address, location coordinates; one normalized address per organization. |
| Interaction snapshot | History/group ID, property, organization, original owner, status, editor, initial/change times, current flag, contact fields, notes, and optional create request ID. |
| Daily knock | `knock_date`, `knock_timezone`, `counts_as_daily_knock`, and UTC event timestamps on interaction snapshots. |

Organization-scoped foreign keys and queries preserve tenant boundaries.
Interaction snapshots retain original ownership and historical status text.
Properties have no ordinary user-editable coordinates or general update
endpoint.

Important database invariants include one counted knock per
organization/representative/property/date, at most one current snapshot per
history, and idempotent request identity. The submission path serializes
concurrent work for the organization/representative/property key and the
database uniqueness constraint prevents duplicate daily counts. Reusing a
request ID for a different actor/property is a conflict; matching retries
return the original result. Transactional behavior must preserve a current
snapshot and reject stale edits. Historical immutability is enforced by
application behavior; do not claim a universal database immutability trigger.
No migration or destructive data change is authorized by this specification.

The following inventory describes V1 as implemented on main. M/A means current
manager/admin access; approved V2 restrictions above take precedence as a
future target. Auth means an active authorized user.

| Method and path | Access | Contract summary |
|---|---|---|
| `POST /auth/register` | Public | Atomically create organization/settings/first admin; return token and public user. |
| `POST /auth/login` | Public | Verify email/password and active user; return token and public user. |
| `POST /auth/logout` | Valid token claims | Confirm logout; client clears its session. Copied tokens are not globally revoked. |
| `GET /me` | Auth | Return current user's public profile and organization context. |
| `GET /organization` | M/A | Read current organization. |
| `PATCH /organization` | Admin | Update organization name. |
| `GET /organization/settings` | M/A | Read current visibility/timezone settings. |
| `PATCH /organization/settings` | Admin | Update permitted visibility/timezone fields. |
| `GET /users` | M/A | List scoped users, with supported active/role filters. |
| `POST /users` | M/A | Create a user; manager creation is limited to representatives. |
| `PATCH /users/:id` | M/A | Update allowed names/role under actor-target rules; no manager role assignment. |
| `PATCH /users/:id/active` | Admin | Activate/deactivate while preserving history and last-admin protection. |
| `GET /teams`, `GET /teams/:id` | M/A | Read organization teams and membership. |
| `POST /teams` | M/A | Create an organization team. |
| `POST /teams/:id/users` | M/A | Add a same-organization team member. |
| `DELETE /teams/:id/users/:userId` | M/A | Remove only the membership relationship. |
| `GET /statuses` | Auth | Read active selectable organization statuses. |
| `POST /statuses` | M/A | Create a status (V2 target restricts catalog management to admins). |
| `PATCH /statuses/:id` | M/A | Update status fields while retaining historical status text. |
| `PATCH /statuses/:id/active` | M/A | Activate/deactivate a status. |
| `GET /properties/:id` | Auth | Read a scoped property. |
| `POST /properties/resolve` | Auth | Resolve coordinates to a normalized organization property. |
| `GET /properties/:propertyId/interactions` | Auth + visibility | Read authorized current interaction summaries, not a timeline. |
| `POST /properties/:propertyId/interactions` | Auth | Create a visit with a required active status and optional contact/notes, or an explicitly confirmed same-day return. |
| `GET /interactions/:id` | Auth + visibility | Read current group state; an older snapshot ID resolves to current state. |
| `POST /interactions/:id` | Auth + edit authority | Revise with expected snapshot version; stale edits return conflict. |
| `GET /map/properties` | Auth + visibility | Return visible properties for requested bounds. |
| `GET /reports/activity` | M/A + visibility | Filter counted knocks by date and supported user/team/status filters. |
| `GET /exports/properties` | M/A + visibility | Export the same authorized counted-knock scope as CSV. |

`SAME_DAY_VISIT_EXISTS` requires explicit return confirmation. An invalid
organization timezone blocks a new visit with
`ORGANIZATION_TIMEZONE_INVALID`; registration/settings validate IANA timezones.
Reporting dates use inclusive `YYYY-MM-DD` ranges and stored `knock_date`.
Coordinates require latitude -90..90 and longitude -180..180. User names are
nonempty (up to 100 characters); status names up to 100; contact name/email up
to 255 and phone up to 50. Nullable contact fields may be cleared explicitly;
omitted revision fields retain their current values. A supplied client request
ID is a UUID.

Errors normally use `error.code`, `error.message`, optional `details`, and
`requestId`. Validation, authentication, authorization, not-found, conflict,
unresolved-property, rate-limit, and internal errors use endpoint-appropriate
HTTP status codes. Cross-organization resources must not be disclosed through
error details. The API does not promise that every endpoint rejects unknown
request fields.

Activity responses include the date range, applied filters, total knocks,
representative and status summaries. The legacy `totalStatusActivityGroups`
field remains for compatibility and equals the filtered total knocks. Status
activity uses the latest saved status on each counted history. CSV formula-like
values receive a quoted tab prefix without changing stored data; spreadsheet
importer behavior varies, so this is not a universal safety guarantee.

V1 bearer token/profile state is stored in browser local storage with an
in-memory fallback if storage is blocked. Logout clears local session/drafts
but does not revoke a copied, unexpired token for an active account. Address,
contact, notes, and location data can be sensitive; define retention, access,
device storage, and deletion before making public promises. Terms/privacy and
other legal documents need qualified review before public launch.

Protected operations must validate identifiers and derive ownership from
authenticated context. Validate inputs on the backend, use parameterized SQL,
return established error envelopes, and avoid diagnostic messages that disclose
other organizations' data. Endpoint-specific payloads and status codes follow
the current implementation; a global strict-unknown-field guarantee is not
approved.

## Approved V2 requirements — not implemented

These are approved product directions only. They do not approve a schema,
provider, migration, release date, or implementation.

### Shared accounts and onboarding

One sign-in identity may have memberships in multiple organizations, each with
its own role and active state. Owner signup creates an organization and its
first admin; employees normally join by invitation. Existing users may accept
another invitation or create another organization without a second identity.
Users with multiple memberships need an organization chooser and visible active
organization. Organization context is tab-specific. Admin authority remains
organization-scoped.

The future flow includes email verification, invitations, password recovery,
and notification emails. Existing-account invite acceptance must not
accidentally create another organization. Token lifetimes, verification order,
duplicate legacy-email proof, session storage/revocation, invitation recovery,
and migration/rollback mechanics remain undecided.

### Manager, team, status, and administrator boundaries

The approved V2 manager policy is narrower than V1 and is not implemented:

- Managers may add/remove representatives only on teams they currently belong
  to; they may not manage other managers or admins in teams.
- Managers may create teams for themselves and may delete only teams they
  created. Leaving a self-created team deletes that team and its memberships,
  after a clear warning. User records and fieldwork remain intact.
- Managers may invite representatives, but not managers or admins. They may
  not assign roles, view/edit organization settings or permissions, or
  deactivate users.
- Only admins manage the status catalog. Managers and representatives may
  still read and select active statuses for permitted field interactions.
- Before an admin deactivates a manager, the confirmation separately lists
  the manager by display name, their owned teams, and teams they only assist
  on. Keep the two categories separate and show an explicit `None` for an
  empty category. Cancel changes nothing. Proceed deactivates the manager,
  removes their owned teams and membership links, and removes only their
  membership from assisting teams. Users and recorded work remain intact.

Team deletion is an approved exception to older “no delete” wording, but no
team-deletion endpoint currently exists. Precise team-creation assignment,
admin team-deletion authority, and admin membership boundaries remain open.

Each organization will have one designated active main admin. Only that
person initiates a transfer; the recipient must accept, and an atomic handoff
keeps the incumbent protected until completion. Recipient eligibility,
verification/security checks, and the former main admin's resulting role are
undecided. This is separate from the implemented last-active-admin safeguard.

### Recovery and commercial direction

When a user-facing restore feature is approved and built, restoring older
values creates a new revision with restorer/time attribution; it does not
reactivate or rewrite the old row and does not add a knock. The history and
recovery experience, its permissions, and concurrency design are deferred.

The owner intends to offer a paid service and an organization-deactivation
option that turns the organization off and stops billing. Billing, payment
provider, cancellation timing, retention, reactivation, and effects on other
memberships are not designed or implemented.

## Undecided proposals and deferred features

Do not treat any of these as approved implementation details:

- The account-schema proposal (new account/supporting tables, token types,
  outbox, feature flags, grace periods, or migration sequencing).
- Production host/runtime, provider capacity and cross-process geocoding
  strategy, transactional email provider, backup retention, support ownership,
  browser/device support, or launch/legal requirements.
- Verification-before-organization-creation versus provisional organization
  creation; session lifetimes, account linking, recovery and logout semantics.
- Exact mobile bottom-sheet/side-panel design, target sizes, and unsaved-work
  switching prompts.
- Address search, map filters, marker status/counts, a user-facing interaction
  history, territories, heat maps, CRM integrations/webhooks, custom fields,
  scheduled exports, advanced analytics, leaderboards, and distance tracking.
- US-025's dedicated/shared geocoding-cache feature remains deferred; the
  bounded in-process cache and pacing added for provider safety are current
  reliability behavior, not a general cache product feature.
- Historical/as-of reports, backdating, legacy-data backfill/review, editable
  property coordinates, and broad property correction workflows.
- Help, editable profile/password, organization contact/billing fields, user
  phone fields, and team descriptions shown in old wireframes.

Password recovery and organization/account onboarding remain approved V2
directions even though their technical details are undecided. All other
mockup-only features remain deferred unless separately approved.

## Engineering and test policy

Use the existing Node 24 runtime and root/backend/frontend package manifests
and lockfiles. Restore dependencies reproducibly with `npm ci` in each package
root. Keep secrets in local environment configuration; never commit or print
credentials. The root `.env.example` is a template, not proof that its
development database target is safe for a particular machine.

Common root commands:

| Command | Purpose |
|---|---|
| `npm run dev` | Start backend and frontend development servers |
| `npm run lint` | Lint backend and frontend |
| `npm run test:unit` | Backend unit and frontend test suites |
| `npm run test:integration` | Backend integration suite |
| `npm test` | Unit/frontend and backend integration suites |
| `npm run test:e2e` | Playwright browser suite |
| `npm run build` | Build frontend; backend build is currently a no-op |

Integration and browser tests require a disposable isolated test database.
Validate the target before migrations; never run destructive cleanup against
an unverified URL and never expose connection strings in logs. The test migration guard is in PR #52, not in current main. It validates
`TEST_DATABASE_URL` with the shared safety check, requires the test-mode target
to match, and passes the validated URL explicitly to the migration runner.
It rejects development/mismatched targets before migration starts; intentional
development migrations keep using `DATABASE_URL`. Until PR #52 is merged,
explicitly ensure the test migration runner and test process target the same
disposable `TEST_DATABASE_URL`.

Test real PostgreSQL behavior where constraints/concurrency matter. Cover
tenant isolation, active users/roles, team and status permissions, daily knock
uniqueness, timezone/DST boundaries, idempotency, same-day returns, revisions
and conflicts, drafts, reports/CSV, provider failures, and asynchronous map
selection. Mock external providers. Browser emulation does not replace real
phone/keyboard/accessibility validation. Do not weaken tests to hide defects.

## Release status and follow-up

- `main` is at `a9446a5`, the regular merge of PR #50. PRs #49 and #50 are
  merged. Stabilization and daily-knock behavior are on main.
- [PR #52](https://github.com/CRLockard/JoeKnock/pull/52) is **open,
  unmerged, and not a draft**. Its two required `verify` checks were successful
  when checked for this consolidation. It contains the test-migration guard
  described above; the guard is therefore not part of main.
- [Issue #51](https://github.com/CRLockard/JoeKnock/issues/51) is open and
  tracks remaining dependency advisory/upgrades. The last dependency review
  found the audit was not clean; severity labels require exposure/usage
  assessment. Larger upgrade work includes React Router 7, the Vitest/Vite
  toolchain, and `node-pg-migrate` 9. No new audit was run for this
  documentation change.
- Earlier owner/Copilot reports say PR #49 and #50 validation passed on
  disposable or local environments. Those are historical results, not tests
  run for this documentation change. PR #52's passing CI is the current check
  performed here; no application tests were rerun.
- An earlier local inspection confirmed development uses
  `joeknock_devclean` and the original demo database is preserved; neither was
  rechecked or changed during this documentation task. Earlier checks found no
  active public deployment; hosting was not rechecked here. This document does
  not authorize database changes, deployment, or cleanup.
- Before real-team/public launch, complete applicable dependency work, verify
  backups/restore and hosting operations, assess provider capacity/policy,
  perform real-device accessibility checks, and obtain qualified legal review.

## Decisions and legacy conflicts resolved

| Older conflicting text | Consolidated rule |
|---|---|
| One knock per representative/property forever; edits or future activity could be counted differently | One count per organization + representative + property + stored organization-local date. Same-day returns and all edits add no count. |
| Export date could reflect edit time or latest interaction time | CSV `interactionDate` is the original knock date; row details are the latest saved details for that counted history. One row per counted history. |
| Managers may broadly manage teams/settings/statuses, or status editing is already admin-only | Current V1 access is broader; approved V2 manager restrictions and admin-only catalog management are targets, not shipped behavior. |
| MVP prohibits all deletion | Approved V2 exception allows deletion of manager-owned teams and memberships only; user/work records remain. No endpoint is implemented. |
| Last active admin and a designated main admin are the same control | V1 blocks removal of the last active admin. A designated main admin with accepted transfer is an approved V2 direction. |
| Old mockups or story tickets imply functionality is approved | Only requirements labeled implemented or approved here are standing requirements. Mockup-only items are deferred; old ticket-specific plans are retired. |

The established daily-knock and CSV decisions are settled; do not reopen them
through older prose. Any exception requires an explicit product decision and a
specification update.

## Superseded documentation and preserved decisions

The following tracked documents were consolidated into this file and removed
from the working documentation set. Their prior versions remain available in
Git history. The rows identify where their requirements or disposition were
preserved; they do not imply that every historical suggestion was approved.

| Former source | Preserved here | Disposition |
|---|---|---|
| `docs/api_endpoints.md` | Data/API constraints; route inventory | Current route groups and contract boundaries retained; old endpoint prose superseded. |
| `docs/ARCHITECTURE.md`, `docs/Architecture_Decision_Record.md` | Product scope; data/API constraints; engineering policy | Current stack and constraints retained; alternatives and obsolete decisions retired. |
| `docs/MASTER_PROJECT_SPEC.md`, `docs/product_requirements.md` | Product; V1 behavior; approved V2; deferred features | Current requirements consolidated; contradictory semantics explicitly resolved above. |
| `docs/table_Schema_decisions.md` | Data/API constraints; daily knock invariants | Current entity relationships and integrity requirements retained; proposed schema changes remain unapproved. |
| `docs/design_snapshot.md`, `docs/project_vision.md` | Product; map and interaction behavior; deferred features | Current purpose retained; mockup-only behavior deferred. |
| `docs/frontend_wireframes.md` | Map, mobile, and onboarding requirements | Current behavior retained; optional screens/features are deferred. Any separate image assets are unchanged. |
| `docs/user_stories.md`; existing `docs/implementation/tickets/US-*.md` | V1 workflow, roles, data integrity, reports, testing, deferred features | Unique current requirements absorbed. Old acceptance criteria/status are historical; US-022, US-024, US-025, US-033, US-042 and other mockup-only work remains deferred. |
| `docs/implementation/foundation/decision-summary.md`, `project-foundation-spec.md`, and `docs/implementation/implementation-spec-template.md` | Stack, architecture, development, data/API, and test policy | Old implementation plan and template retired; no longer an approval gate or source of truth. |
| `docs/testing/testing-strategy.md`, `docs/testing/test-matrix.md` | Engineering and test policy | Unique regression areas and real-database/browser requirements retained; old counts/statuses retired. |
| `docs/project_management_plan.md` | Release status and follow-up | Stale schedules and completion claims retired; open work is represented by current PR/issue state above. |
| `docs/CODE_REVIEW_STUDY_GUIDE.md` | Security and engineering policy | Project-relevant safeguards retained; educational examples retired as requirements. |

Old route names, ticket numbers, test counts, and schedules must not be copied
as current evidence. Required code, tests, migrations, configuration,
lockfiles, legal notices, and separate assets are outside this documentation
consolidation.
