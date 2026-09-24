# Phase 2 — architecture plan

**Status: proposal for Ronald's review. Nothing here is built.** Building
starts when the decisions in §7 are made.

This plans how the BOYD'S Operations System becomes a logistics operations
system that can serve other companies, with BOYD'S as customer #1. It covers
multi-tenancy, mapping, the smallest product worth selling, and light mode.
Every figure below comes from the live codebase at commit `bb4f678`
(28 migrations).

---

## 1. The short version

- **Multi-tenancy comes first.** Every table added before tenancy exists is one
  more to convert and re-secure later, and mapping adds several tables.
- **It is mostly a security project, not a feature project.** The system
  already does what a small operator needs. The work is making sure one
  company can never see another's data, and proving it by test.
- **Isolation belongs in the database, as everything else here does.** Every
  row carries its company. Row level security checks it. Composite foreign keys
  make it impossible for a job in one company to point at another company's
  customer.
- **The main risk is functions that bypass row level security.** There are 33.
  Several are correct today only because BOYD'S is the only company:
  - `notify_partners` alerts every partner in the database.
  - `find_dispatch_conflicts` scans every job.
  - reference numbers count the whole table.

  Each must be rewritten and reviewed. A test must make any new one fail the
  build until it has been reviewed too.

- **Mapping follows tenancy**, and keeps the honesty rules. A route distance is
  an _estimate_ and never overwrites odometer miles. A failed address lookup
  says so. A position shows its age and is never extrapolated.
- **BOYD'S keeps working throughout.** Each step deploys only after the full
  gate and production verification pass. Each schema change is rehearsed on a
  restored copy of a production backup first.

---

## 2. Principles carried into Phase 2

Everything in `CLAUDE.md` still holds: whole-cent money, MISSING never zero,
NOT CONFIGURED with no fallback, estimates separate from actuals, DEMO never
becoming REAL, no automatic acceptance, and no fabricated integration. Two
more:

1. **Tenant isolation is enforced by the database.** The application may never
   be the only thing between one company's data and another's.
2. **BOYD'S is a customer, not a special case.** After migration, no code path
   knows it is BOYD'S. Its name, settings and branding are data, like any
   other company's.

---

## 3. Multi-tenancy

### 3.1 The model

A new `organisations` table: name, slug, status, timezone, currency, units,
and a verified domain for the public request form.

**Membership.** Today `users` is one row per person, with one role and a
globally unique `auth_user_id`. The smallest sound change is to add
`organisation_id` to `users`, so each row becomes _a person's membership of
one company_:

- **Option A (recommended for the first release): one company per sign-in.**
  Keep `auth_user_id` unique. The active company is simply the one the person
  belongs to. No company switcher, and no token claim to keep in step.
- **Option B: a person in several companies**, such as a contractor who drives
  for two operators. Make `(organisation_id, auth_user_id)` unique and add an
  "active company" selection. The cost is real: the active company must travel
  with every request and be checked in every policy.

Option A can move to Option B later without redesign. The reverse is harder.
**Decision 1.**

### 3.2 A company on every row

**31 of the 33 tables get `organisation_id`.** The two exceptions:

| Stays global             | Why                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `job_status_transitions` | The job state machine is the product's rules, not a company's data. It stays one table, maintained by migrations. |
| `industries`             | A shared, read-only catalogue.                                                                                    |

Per-company reference data: `job_types`, `service_areas`, `pricing_rules`. Each
company defines its own. A new company starts with a copy of a sensible default
set of job types, and **no** service areas or pricing, which read NOT
CONFIGURED exactly as BOYD'S did.

**Child tables carry it too:** `job_stops`, `quote_items`, `invoice_lines`,
`payments`, `customer_contacts` and the rest. Relying on a join back to the
parent inside every policy is slower, and easy to get wrong in one place.

**Composite foreign keys.** Every reference becomes
`(parent_id, organisation_id) → parent(id, organisation_id)`. With this, a job
in company A _cannot_ reference a customer, vehicle or driver in company B.
The database refuses the row, whatever the application does. This is the
strongest single guarantee in the plan.

### 3.3 Row level security

- A helper, `current_org_id()`, resolves the signed-in person's company.
- `is_partner()`, `is_driver()`, `is_admin()` and `current_app_user_id()`
  resolve _within_ that company.
- Every one of the 58 table policies and 3 storage policies gains
  `organisation_id = current_org_id()`.
- The two owner-permission views (`driver_jobs`,
  `driver_vehicle_maintenance`) filter by company explicitly, since they bypass
  row level security by design.
- The user-management guardrails (D-048) become per company. "The last active
  admin" means the last one _in that company_.

### 3.4 The 33 functions that bypass row level security

These run with the owner's rights, so row level security does not protect
them. Each must be reviewed and, where it reads other rows, filtered by company:

| Kind                 | Functions                                                                                                                                                       | What changes                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security helpers     | `is_partner`, `is_driver`, `is_admin`, `current_app_user_id`, `current_app_user_role`, `my_assigned_job_ids`                                                    | Resolve within the current company.                                                                                                                        |
| **Would leak today** | `notify_partners`, `notify_on_job_request`, `notify_on_job_milestone`, `notify_partners_of_incident`                                                            | Notify partners **of the row's company only**. As written, a request to company B would alert company A's partners.                                        |
| **Would leak today** | `find_dispatch_conflicts`, `enforce_dispatch_rules`                                                                                                             | Check conflicts within the company. As written, one company's jobs would block another's dispatch, and reveal them.                                        |
| Numbering            | `assign_incident_number`, `create_public_job_request` numbering                                                                                                 | Per-company counters (§3.5).                                                                                                                               |
| Public entry point   | `create_public_job_request`                                                                                                                                     | Takes the company from the verified domain or form link, never from the caller's input alone (§3.8).                                                       |
| Row-local triggers   | the `enforce_*` guards, `write_audit_log`, `rollup_job_expenses`, `recalculate_invoice_*`, `sync_*`, `maintenance_to_cost_entry`, `fuel_transaction_to_expense` | Mostly act on the row being changed. Each is still checked: any that reads _other_ rows gets a company filter, and any row it writes inherits the company. |
| Driver actions       | `driver_advance_job`, `driver_record_mileage`, `record_my_sign_in`                                                                                              | Check the job or row belongs to the caller's company as well as to the caller.                                                                             |

**The standing guard:** a test lists every elevated-rights function with a
reviewed note on why it is company-safe. A new function not on the list fails
the build. This works the same way `function-permissions.test.ts` already
guards what the public can execute.

### 3.5 Uniqueness and numbering

17 unique constraints apply across the whole database. Thirteen are
identifiers: every reference number (customer, job, lead, quote, invoice,
contract, request, incident), vehicle codes, job-type and industry codes,
storage paths, and user emails. The other four are relationships that are
already safe: one driver record and one partner record per person, one sign-in
per person, and one main contact per customer. Per company:

- Reference numbers and vehicle codes become unique **per company**:
  `(organisation_id, job_number)`, and so on.
- **Seven number generators** count the whole table to make the next number.
  Across companies that would reveal a competitor's volume, and numbers would
  jump. Counting also races: two jobs created at the same moment get the same
  number, and one fails. They are replaced by a per-company counter table,
  incremented under a row lock. That also fixes the race BOYD'S has today.
- User email stays unique while each sign-in has one company (Option A).

### 3.6 Storage

File paths become `<organisation>/jobs/<job>/…`. The three storage policies
check the first folder is the caller's company, in addition to today's checks.
BOYD'S existing files are moved under its prefix during migration, and the
`documents` rows are updated in the same step.

### 3.7 Settings, business decisions and branding

- **A per-company settings row** holds today's open business decisions:
  minimum contribution, target margin, labour and vehicle cost basis, service
  radius, medical limits, payment terms, quote validity. Every column is
  nullable and reads NOT CONFIGURED when empty, exactly as now. No default is
  ever copied from BOYD'S.
- **Locale** (timezone, currency, distance and fuel units) moves from code to
  the company. The first release should accept US settings only (Decision 7).
  The formatting code already takes these as inputs.
- **Branding.** "BOYD'S" appears in 108 source files. In the operations app it
  becomes the company's name, plus a logo and accent colour. The product itself
  needs its own name (Decision 6).

### 3.8 Public website and intake

The public website is BOYD'S marketing site. Turning it into a per-company
website builder is a large project, and not what a small operator is first
paying for. Recommended (Decision 3):

- The BOYD'S website stays as it is.
- Every company gets a hosted request form at its own link (for example
  `/r/<company>`) and, optionally, its own domain. The company is resolved from
  the verified domain or slug on the server.

### 3.9 Audit, notifications and AI

`audit_logs` and `notifications` gain `organisation_id`; each company sees only
its own. The AI assistant already reaches data only through the signed-in
person's session, so row level security scopes it automatically. Its prompts
use the company's name instead of "BOYD'S".

### 3.10 Migrating BOYD'S live data

A sequence of small migrations, never one large one:

1. **Back up** with `scripts/backup-database.sh`.
2. Add `organisations` and a nullable `organisation_id` everywhere. Create the
   BOYD'S organisation and backfill every row. Nothing reads the new column yet,
   so behaviour is unchanged.
3. Make the column required, add the composite foreign keys, and add the
   per-company unique constraints and counters.
4. Replace the policies, helpers and elevated-rights functions with
   company-aware versions, all in one migration.
5. Move stored files under the company prefix.

Before production, each step is rehearsed on **a restored copy of the
production backup**, using the existing restore script. Afterwards,
`verify-production.sql` is extended with tenancy checks: every business table
has the column, it is required, and no policy lacks the company check.

### 3.11 Proving isolation

**The cross-company isolation matrix.** The test database seeds two complete
companies. Then, for **every table**, as **every role** (admin, partner,
driver, public), it tries to read, insert, update and delete the other
company's rows. The expected result is zero, every time.

The table list is read from the database catalogue, not typed in, so a table
added later is covered automatically. This follows the same pattern as
`supabase-privileges.test.ts`.

It also tests the specific leaks in §3.4:

- a request to company B notifies only B's partners
- company A's jobs never block company B's dispatch
- company A's numbers never move when company B creates records

---

## 4. Mapping, after tenancy

The maps adapter already exists (`src/integrations/maps/`), with `geocode`,
`route` and `vehiclePosition` and an honest _unavailable_ state. Phase 2 adds a
live adapter for the chosen provider (Decision 4) and uses it in three steps.

**Step 1: addresses to coordinates.** When a customer location or job stop is
saved, it is looked up and the coordinates stored along with a status:
`RESOLVED`, `UNRESOLVED` or `NOT_LOOKED_UP`. A failed lookup stays `UNRESOLVED`
and is shown as such; the system never guesses a position. The columns already
exist on `job_stops` and `customer_locations`.

**Step 2: route distance.** Route miles fill `estimated_miles_tenths`, recording
that the provider was the source and when. **They never overwrite
`actual_miles_tenths`, which comes from the odometer.** This keeps the
estimate/actual separation the financial engine depends on.

**Deadhead (empty miles) estimates** become possible from each vehicle's
sequence of jobs: the distance from one job's last drop to the next job's first
collection. They are labelled estimates. The odometer-recorded empty miles
stay the actual figure.

**Step 3: live position.** This is a separate decision (Decision 5), because it
is not only software:

- A web app can report position **only while it is open on the driver's
  phone**. Dependable background tracking needs a native app or a hardware
  tracker in the van.
- Positions go in their own table (company, vehicle, driver, coordinates,
  accuracy, time, source), are kept for a limited period, and are recorded only
  while the driver is on duty. A driver's consent is recorded.
- The map shows **"last known position, N minutes ago"**, never an
  extrapolated one. Driver proximity and job handoffs build on this later.

**Route optimisation is not in scope.** It is a large field, and small
operators get most of the value from accurate distances and honest empty-mile
figures first.

---

## 5. The smallest product worth selling

A product judgment for Ronald to challenge, not a fact.

**Already built, and the core of what a small operator pays for:**

- jobs, including multi-drop
- dispatch that prevents double-booking
- a driver app with proof of delivery and signatures
- customer records, quotes, invoices and payments
- incidents and user management
- **honest per-job profitability**: contribution, contribution per mile and
  empty miles, with no invented figures. This is the differentiator. Most small
  operators do not know which jobs lose money.

**Needed before a second company can use it:**

1. Multi-tenancy (§3), with companies created by an admin (Decision 2).
2. Company settings and basic branding (§3.7).
3. Route distance and address lookup (§4, steps 1–2), so estimated miles and
   pricing inputs are not typed by hand.
4. Email to customers (confirmations, invoices), which needs an email provider
   account.
5. Export of invoices and jobs (CSV, and later an accounting-package format).
   Operators live in their accounting software.

**Later, if customers ask:** live tracking, customer self-service tracking
links, AI assistance, route optimisation, and self-serve sign-up and billing.

---

## 6. Light mode

Independent of the rest, but best done alongside company branding (§3.7),
because both need the same change. Components use _palette_ colour names
(`bg-boyd-navy-950`) in 78 files; they need _role_ names (`bg-surface`,
`text-muted`) with a light and a dark value each. Once that is in place, light
mode and a company's accent colour are both configuration. The accessibility
suite runs in both modes, and the orange-button contrast (D-044) is rechecked
against white.

---

## 7. Decisions needed from Ronald

These are business decisions. Each has a recommendation, but the call is yours.

1. **One company per sign-in** for the first release?
   _Recommended: yes_ (§3.1).
2. **How new companies join:** you create each one, or they sign up
   themselves? _Recommended: you create them, at first._ Self-serve sign-up
   needs billing, abuse controls and support.
3. **Public websites:** BOYD'S keeps its site, and other companies get a hosted
   request form? _Recommended: yes_ (§3.8).
4. **Maps provider:** Google Maps or Mapbox. Both need an account and a card;
   costs scale with use.
5. **Live location:** none for now, phone-while-open, or hardware trackers? And
   the policy for drivers' consent. _Recommended: none until steps 1–2 of
   mapping are in use._
6. **The product's name.** It cannot be "BOYD'S" once other companies use it.
   Pricing for customers can wait.
7. **US only at first?** _Recommended: yes._ Other currencies and units later.

---

## 8. Milestones

Each one ends with the full gate, production verification, and a backup taken
before any migration. BOYD'S keeps running throughout.

| #   | Milestone                                                                       | Deployable? | Visible change for BOYD'S                     |
| --- | ------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| M1  | Company column everywhere, backfilled; composite keys; per-company counters     | Yes         | None. The number race is fixed.               |
| M2  | Company-aware policies, helpers and the 33 functions; isolation matrix          | Yes         | None                                          |
| M3  | Company settings, role-based colour tokens, light mode, company name in the app | Yes         | Light mode; settings screen edits real values |
| M4  | Admin-created second company; hosted request form                               | Yes         | None                                          |
| M5  | Address lookup and route distance (needs Decision 4)                            | Yes         | Estimated miles filled automatically          |
| M6  | Live position (needs Decision 5)                                                | Yes         | Last-known van position                       |

M1 and M2 are the heart of it, and they change nothing BOYD'S can see. That is
the point: the foundation moves while the business keeps running on it.

---

## 9. Risks

| Risk                                    | Mitigation                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One company sees another's data         | Row level security on every table, composite foreign keys, the isolation matrix, and the elevated-rights function guard.                                                       |
| A migration damages live BOYD'S data    | Backup first. Rehearse on a restored copy of production. Small, reversible steps. Production verification after each.                                                          |
| Slower queries                          | An index on `organisation_id` for every table, with composite indexes where queries filter by company and date. BOYD'S volumes are small; the matrix run times any regression. |
| Scope creep toward an enterprise system | §5 is the boundary. Anything outside it waits until a paying customer asks.                                                                                                    |
