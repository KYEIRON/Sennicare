# BOYD'S — Decision Log

Format: decision · date · reason · alternatives considered · impact.

---

## D-001 — BOYD'S lives in `/BOYDS`, fully isolated from Sennicare

**Date:** 2026-08-24
**Decision:** Create BOYD'S as a self-contained project at the repository root in
`/BOYDS`, with its own `CLAUDE.md`, documentation, dependencies, configuration,
and database. No file outside `/BOYDS` is modified.
**Reason:** Inspection showed Sennicare is a static HTML/CSS/JS site in
`/website` with no build system, no `package.json`, and no database at the
repository root. A sibling directory therefore has zero technical surface area
against it — no shared dependency tree, no shared config, no shared runtime.
**Alternatives:** a separate repository (cleaner still, but Ronald asked for this
repository); a `packages/` monorepo with shared tooling (would create exactly the
coupling the instruction forbids).
**Impact:** BOYD'S can be extracted into its own repository at any time by moving
one directory. The boundary is structural, not a matter of care.

## D-002 — One Next.js application, three route groups

**Date:** 2026-08-24
**Decision:** Serve the public website, the operations OS, and the driver
application from one Next.js application using route groups `(site)`, `(ops)`,
`(driver)`.
**Reason:** They share a domain model and a database; separating them into three
deployments would triple operational burden for no isolation gain. The real
isolation boundary is Postgres RLS plus server-side authorisation, which is
identical either way. Route groups give each surface its own layout, navigation,
and middleware posture — which is what "clearly separated from the internal
operations interface" requires in practice.
**Alternatives:** three applications in a monorepo (premature for a
one-van company, revisit with a dedicated engineering team); one application with
no route grouping (would blur the surfaces).
**Impact:** One deployment, one dependency set. If BOYD'S later needs the public
site on a separate infrastructure footprint, `(site)` extracts cleanly because it
shares only `services/` and `types/`.

## D-003 — Money as integer cents, distance as integer tenths of a mile

**Date:** 2026-08-24
**Decision:** All monetary values are `bigint` cents in Postgres and a branded
`Cents` number in TypeScript. Distances are integer tenths of a mile. Percentages
are basis points. Formatting happens once, at display.
**Reason:** Floating-point arithmetic loses money. For a business whose central
principle is accurate contribution measurement, that is disqualifying.
**Alternatives:** Postgres `numeric` (accurate, but arrives in JavaScript as a
string and invites accidental `parseFloat`); a decimal library (a dependency and
a discipline problem in every file).
**Impact:** Every developer must convert at the edges. `src/lib/money.ts` is the
only place conversion happens, and the branded type makes a raw number a compile
error.

## D-004 — `Calculation<T>` result type instead of nullable numbers

**Date:** 2026-08-24
**Decision:** Financial functions return
`{ OK } | { DATA_INCOMPLETE } | { NOT_CALCULABLE }` rather than a number,
a null, or a thrown error.
**Reason:** The instruction is emphatic that incomplete data must never be
guessed and division by zero must never produce a silent figure. A discriminated
union makes the compiler enforce that every caller handles "we do not know". A
nullable number would let `?? 0` reintroduce the exact failure being guarded
against.
**Alternatives:** nullable returns (too easy to defeat); exceptions (incomplete
data is an expected state, not an error).
**Impact:** Slightly more verbose call sites. This is the single most important
correctness decision in the project.

## D-005 — Contribution is derived, never stored

**Date:** 2026-08-24
**Decision:** Store revenue and each cost component on `jobs`; do not store
contribution, contribution per mile, or margin. Derive them, and expose them for
reporting through the `job_profitability` view.
**Reason:** A stored total can drift out of agreement with its inputs. Given the
rule that revenue must never be presented as profit, a stale stored figure is a
direct route to the failure mode the business most wants to avoid.
**Alternatives:** stored generated columns (Postgres cannot express the
estimated/actual/missing logic in a generated column); application-maintained
totals (drift).
**Impact:** Reports compute on read. At BOYD'S data volumes this is free; if it
ever stops being free, a materialised view is the answer, not a stored column.

## D-006 — Cost pairs with a derived state

**Date:** 2026-08-24
**Decision:** Every cost is three columns: `_estimated_cents`, `_actual_cents`,
and a `_state` (`ESTIMATED` / `ACTUAL` / `MISSING`) set by trigger.
**Reason:** The requirement that an estimate is never silently replaced by an
actual needs both values to persist. Deriving the state in the database rather
than the application removes any chance of the flag disagreeing with the data.
**Alternatives:** one column plus a boolean (loses the estimate, so no
estimate-vs-actual variance analysis is possible); a separate cost table (more
correct for many cost lines per job, but heavier than V1 warrants — revisit if
jobs grow multiple costs per category).
**Impact:** Wider `jobs` table; complete cost history; variance analysis
available for free later.

## D-007 — Three-adapter integration pattern

**Date:** 2026-08-24
**Decision:** Every integration has `live`, `unavailable`, and `fake` adapters.
`fake` is reachable only from the test suite, asserted by a test.
**Reason:** The rule against faking functionality and the rule against getting
blocked on credentials both have to hold at once. This pattern satisfies both:
development proceeds fully, and an unconfigured capability announces itself
honestly instead of pretending.
**Alternatives:** feature flags (drift out of sync with reality); mock servers in
development (a fake that can escape into production).
**Impact:** Every integration costs one extra small file. Ronald can see, on a
settings page, exactly which capabilities are live and which are waiting on an
account.

## D-008 — North Carolina is data, not code

**Date:** 2026-08-24
**Decision:** Service areas, service types, and pricing rules are database rows.
No US state, metro, or service name is a constant in the codebase.
**Reason:** The instruction explicitly forbids hardcoding North Carolina and
names five expansion targets. Location-specific website pages are generated from
`service_areas`, so expanding to South Carolina is a row, not a release.
**Alternatives:** a constants file (fails the requirement); per-state code
branches (fails it worse).
**Impact:** A little more indirection in V1, and a near-zero-cost expansion path.

## D-009 — Automatic job acceptance disabled at the database level

**Date:** 2026-08-24
**Decision:** `company_settings.auto_acceptance_enabled` defaults to `false`, and
the AI decision path refuses to run when any required input is unavailable.
**Reason:** Automatic acceptance without real availability, location, and pricing
data would commit BOYD'S to work it cannot verify it can perform profitably.
Making the default a database value rather than a code constant means enabling it
is a deliberate, audited act.
**Alternatives:** a code constant (easy to flip by accident); no flag at all
(nothing to audit when the capability eventually arrives).
**Impact:** The capability can be built and tested ahead of time without any risk
of it acting.

## D-010 — Undecided business policy is a type, not a null

**Date:** 2026-08-24
**Decision:** Open business decisions are represented by `Configured<T>`, which is
either `CONFIGURED` or `NOT_CONFIGURED`. `fromNullable()` is the only sanctioned
way to read a policy from a nullable column, and it deliberately has **no
overload that accepts a fallback value**.
**Reason:** Ronald has confirmed all eight open decisions stay NOT CONFIGURED
until the partners make them. A plain nullable column would let a single `?? 0`
anywhere in the codebase silently invent a business policy — precisely what the
instruction forbids. Removing the fallback parameter means inventing a default
requires deliberately writing new code, not forgetting to handle a null.
**Alternatives:** nullable columns with a convention (conventions decay);
seeded "sensible defaults" (explicitly prohibited).
**Impact:** A figure depending on an undecided policy displays `NOT CONFIGURED`
and names the decision needed. `BUSINESS_SETTINGS` enumerates all eight, and a
test asserts the list, so a setting cannot be quietly dropped.

## D-011 — Driver labour economics are separate from partner compensation

**Date:** 2026-08-24
**Decision:** Two unrelated concepts, two unrelated types, in `src/types/economics.ts`.
`DriverLabourCostBasis` is a **management costing** question — what it costs
BOYD'S economically to have driving done. `PartnerCompensationTreatment` is a
**legal and accounting** question — how Moh is actually paid. The financial
engine consumes only the first and has no access to the second.
Additionally, every contribution figure carries a `LabourCostTreatment` of
`LABOUR_COSTED` or `BEFORE_LABOUR_COST`.
**Reason:** Ronald's instruction: the system must calculate the economic cost of
driver labour for profitability analysis without assuming how Moh is legally
compensated as a partner. These genuinely are different questions — an
owner-operator can rationally exclude partner labour from job cost for pricing
purposes while still being paid through distributions. Conflating them would
either understate the true cost of a job or misrepresent the partnership.
**Alternatives:** one "driver cost" field (conflates the two, and forces an
assumption about the partnership onto every profitability figure); excluding
labour entirely (would overstate contribution and produce unsound pricing).
**Impact:** `EXCLUDED_FROM_JOB_COST` is a first-class, legitimate option that is
explicitly **not** the same as a zero cost. Contribution computed on that basis
is labelled `BEFORE_LABOUR_COST` everywhere it appears, so it can never be
mistaken for a fully-costed result. When the partners decide a labour basis, only
that setting changes — no schema change and no recalculation of history.

## D-012 — True vehicle cost per mile is derived, never declared

**Date:** 2026-08-24
**Decision:** Vehicle cost per mile is computed from `VehicleCostEntry` rows —
real recorded costs for fuel, insurance, finance, depreciation, maintenance,
repairs, tyres, registration and other operating costs — divided by real
recorded mileage. The result, `DerivedCostPerMile`, carries `linesIncluded`,
`linesExcludedForMissingData`, `milesBasis`, and the period it covers. There is
no field anywhere for a manually entered flat cost-per-mile rate.
**Reason:** Ronald's instruction: track the underlying costs separately and
derive true cost per mile rather than relying permanently on a manually entered
single rate. A typed-in rate is a guess that looks like a measurement, and every
job's contribution would inherit that guess invisibly.
**Alternatives:** a manual rate with an optional derivation (the manual value
would remain in use indefinitely); a manual rate as a temporary bootstrap
(nothing in the data would mark which jobs used it).
**Impact:** Until cost entries exist, vehicle allocation is `MISSING` — never
`$0`, because a missing cost is not a free cost and treating it as zero would
overstate contribution. A partial derivation is a real number but is always
presented with the cost lines it actually covers, so a fuel-and-insurance-only
figure can never be read as the vehicle's full cost per mile.

## D-013 — Pinned toolchain: Next 16, TypeScript 6, ESLint 9

**Date:** 2026-08-24
**Decision:** Next.js 16.3.2, React 19.2.8, TypeScript 6.0.3, ESLint 9,
Tailwind CSS 4, Zod 4, Vitest 4.
**Reason:** Next 15.1.6 carries a published security vulnerability (CVE-2025-66478)
and was upgraded before any code was written on top of it. TypeScript 7 and
ESLint 10 were both trialled and reverted: `typescript-eslint` does not yet
support the TS 7 compiler API, and ESLint 10 breaks the React plugin bundled with
`eslint-config-next`. Working linting is worth more than the newest major
version, and the alternative was disabling lint — unacceptable in a codebase
handling money and customer data. `npm audit` reports zero vulnerabilities.
**Alternatives:** TS 7 with lint disabled (rejected); staying on Next 15
(rejected — known vulnerability).
**Impact:** Revisit TypeScript 7 and ESLint 10 when `typescript-eslint` and
`eslint-plugin-react` support them. Recorded here so the pin is understood as
deliberate rather than neglect.

## D-014 — The design mockup is authoritative for visuals, never for data

**Date:** 2026-08-24
**Decision:** Treat the supplied dashboard mockup as a visual specification only
— layout, hierarchy, navigation, structure, colour, KPI presentation, map
placement, cards, tables, quick actions. Every figure in it is an illustrative
placeholder and none may be seeded, copied, or assumed. Where an interface needs
data before real BOYD'S data exists, it shows `DEMO DATA` or `NOT CONFIGURED`.

Enforced by three mechanisms rather than by discipline:

1. `Provenanced<T>` in `src/lib/provenance.ts` — every displayed figure carries
   `REAL` or `DEMO`. There is deliberately no function that strips provenance,
   no default, and no way to suppress the `DEMO DATA` label at the display edge.
   Any illustrative input makes a combined result illustrative, mirroring the
   rule for incomplete data.
2. `assertReal(value, context)` — a hard guard for invoicing, reporting,
   pricing, and AI answers. It throws rather than returning a Result, because
   demonstration data reaching a real business calculation is a programmer error,
   not a business condition.
3. `tests/guards/no-mockup-data.test.ts` — a standing test that scans all runtime
   source and fails the build on any mockup figure: the revenue, contribution and
   cost totals, fuel price and volume, contribution per mile, mileage, MPG, job
   and request numbers, vehicle model, and phone number.

**Reason:** Ronald's instruction, 2026-08-24: _"Never allow illustrative data to
appear as real operational data."_ The failure mode is quiet and compounding — a
figure copied from a mockup into a component looks entirely reasonable, survives
into a seed file, and is eventually read off a dashboard and believed. After that
there is no way to tell by looking which figures were real. The whole point of
this system is that its numbers can be trusted.

**Alternatives:** a documented convention (the exact kind of rule that erodes
once several people are building screens); labelling demo data only in the
component that renders it (a later refactor moves the value and loses the label);
banning demo data entirely (unworkable — layout work needs something on screen
before real jobs exist).

**Impact:** Building a screen against the mockup's design now requires stating
where each figure came from. The guard test caught a genuine instance
immediately — a mockup revenue figure quoted inside the very module that defines
the rule — which is fair evidence the convention alone would not have held.

## D-015 — Driver column limits enforced by trigger, not by column GRANT

**Date:** 2026-08-24
**Decision:** A driver may update only their own `phone` on their driver record.
Row selection is enforced by an RLS policy; column restriction is enforced by a
`BEFORE UPDATE` trigger that checks `is_partner()`.
**Reason:** The obvious approach — `REVOKE UPDATE` then
`GRANT UPDATE (phone)` — does not work here. Supabase authenticates partners and
drivers as the same `authenticated` database role, so a grant narrow enough to
restrain a driver would equally restrain a partner from maintaining licence
details. The trigger can distinguish them because it evaluates the caller's
BOYD'S role, not their database role.
**Alternatives:** separate database roles per BOYD'S role (fights the Supabase
model and complicates every connection); enforcing it only in application code
(leaves the database open, which is precisely the layer meant to survive an
application bug).
**Impact:** Column-level rules on any table where partners and drivers both hold
write access follow this pattern. Proved by integration tests: a driver updating
`license_number` or `active` is rejected; a partner doing the same succeeds.

## D-016 — Row level security tested against real PostgreSQL

**Date:** 2026-08-24
**Decision:** BOYD'S RLS policies are tested by applying the real migrations to a
real PostgreSQL database and issuing queries as each role, with
`request.jwt.claim.sub` set exactly as Supabase sets it. A local harness
(`supabase/test-harness/`) recreates the `auth` schema, `auth.uid()` and the
Supabase roles so migrations run unmodified. The migrations are never altered to
accommodate testing.
**Reason:** RLS is the authoritative authorisation boundary. A mocked policy
proves nothing about what Postgres will actually do, and this is the layer that
has to hold when application code is wrong.
**Alternatives:** trusting the policies by inspection (this is how privilege
escalation bugs ship); testing only through the application layer (tests the
guards, not the boundary beneath them).
**Impact:** The suite fails with actionable instructions when no database is
reachable — it never skips. A run that quietly did not exercise the security
boundary would report success while proving nothing, which is worse than a
failure.

## D-017 — Uniform sign-in failure messages

**Date:** 2026-08-24
**Decision:** A wrong password, an unknown email address, and a valid Supabase
Auth account with no BOYD'S user record all return the same message: "Those
sign-in details were not recognised." Only a recognised-but-inactive account is
told something different, and only after authentication succeeds.
**Reason:** Distinguishing the cases would let anyone with the sign-in page
confirm whether a given email address has a BOYD'S account, which is both a
privacy leak about the partners and a shortlist for a password attack.
**Alternatives:** specific messages (friendlier, and enumerable).
**Impact:** Slightly less helpful for a partner who mistypes their address. The
sign-in page states that accounts are created by a partner and there is no public
sign-up, which covers the genuine confusion this could otherwise cause.

## D-018 — Protected routes are never statically prerendered

**Date:** 2026-08-24
**Decision:** The `(ops)` and `(driver)` layouts declare
`dynamic = 'force-dynamic'` and `revalidate = 0`.
**Reason:** With no database configured at build time the auth guard
short-circuits before touching cookies, so Next.js saw no dynamic signal and
prerendered both protected areas as static pages. Harmless while they are
placeholders; a serious problem the moment they render real data, because a
cached copy of a signed-in partner's page could be served to someone else.
**Alternatives:** relying on the guard to make the route dynamic (it does — but
only once the database is configured, which is exactly the kind of conditional
safety that fails quietly).
**Impact:** Protected pages are evaluated per request. Asserted by a standing
guard test.

## D-019 — The Phase 3 job lifecycle supersedes the original list

**Date:** 2026-08-24
**Decision:** Adopt the lifecycle given in the Phase 3 instruction, which differs
from the one in the original master build instruction and in `docs/DATABASE.md`:

| Original                                   | Phase 3                               |
| ------------------------------------------ | ------------------------------------- |
| `DRAFT` / `QUOTE_REQUESTED` / `ACCEPTED`   | `REQUESTED` / `REVIEW` / `APPROVED`   |
| `EN_ROUTE_TO_COLLECTION` / `AT_COLLECTION` | `EN_ROUTE_TO_PICKUP` / `AT_PICKUP`    |
| `COLLECTED`                                | `PICKED_UP`                           |
| —                                          | `DECLINED`, `FAILED`, `ON_HOLD` added |
| `INVOICED` / `PAID`                        | deferred to Phase 9                   |

**Reason:** A genuine conflict between two authoritative sources. The Phase 3
instruction is the later and more specific statement of what BOYD'S wants, and
`CLAUDE.md` ranks an explicit business decision above the original document. The
conflict was flagged to Ronald rather than resolved silently.
**Alternatives:** keeping the original names (would contradict a direct
instruction); supporting both (two vocabularies for one concept is how a system
starts lying to itself).
**Impact:** `docs/DATABASE.md` is superseded on this point. Adding `INVOICED` and
`PAID` in Phase 9 is `ALTER TYPE ... ADD VALUE` plus new transition rows — no
rewrite. Every permitted transition is a row in `job_status_transitions`,
mirrored in TypeScript, with a test asserting the two are identical.

## D-020 — Column-level protection uses triggers throughout

**Date:** 2026-08-24
**Decision:** Where partners and drivers both hold write access to a table but
must be able to change different columns, the restriction is a `BEFORE UPDATE`
trigger keyed on `is_driver()`, not a column `GRANT`.
**Reason:** Established in D-015 for `drivers` and extended here to `jobs`.
Supabase authenticates both roles as `authenticated`, so a grant cannot tell them
apart. The first attempt keyed the guard off `is_partner()`, which is false for
the service role and for migrations too — so legitimate server-side writes were
rejected with a message about drivers. The rule is "a driver may not write
these", so the guard tests for a driver.
**Impact:** Row level security decides which rows; the trigger decides which
columns. Proved by integration tests: a driver changing a price, an assignment
or internal notes is rejected; recording field progress succeeds.

## D-021 — Dispatch conflicts are checked at commitment, not on every update

**Date:** 2026-08-24
**Decision:** `enforce_dispatch_rules()` runs when a vehicle, driver or schedule
changes, or when a job crosses from an uncommitted status into a committed one —
not on every subsequent status change.
**Reason:** The first version re-validated availability on every progress update.
So a van marked into `MAINTENANCE` mid-job — exactly what happens when it breaks
down — blocked the driver from recording what was happening. That is backwards:
the van is already out on the road, and refusing to record reality does not
bring it back. It would push a partner towards editing data to work around the
software, which is how records stop being trustworthy.
**Impact:** Double-booking prevention is unchanged — every route by which a
resource becomes committed still passes the check. A breakdown mid-job can now be
recorded honestly.

## D-022 — The driver application lives under /driver

**Date:** 2026-08-24
**Decision:** Driver routes are `/driver/today` and `/driver/jobs/[id]`; partner
routes keep `/jobs/[id]`.
**Reason:** Next.js route groups do not contribute a path segment, so
`(driver)/jobs/[id]` and `(ops)/jobs/[id]` both resolved to `/jobs/[id]` and the
build refused them as parallel pages. A distinct prefix is also clearer
operationally: a link in a message is unambiguous about which application it
opens.
**Impact:** `homeRouteFor('DRIVER')` returns `/driver/today`. A standing guard
test (`tests/guards/driver-boundary.test.ts`) additionally asserts the driver
source contains no price, cost, contribution or margin reference, never imports
the profitability engine, and never reads the `jobs` table directly.

## D-023 — The AI's limits are architectural, not instructional

**Date:** 2026-08-24
**Decision:** BOYD'S AI reaches data only through a registry of named tools.
Each declares a Zod schema and a minimum role, runs through the caller's
session-bound client, and returns the same `Calculation` states the rest of the
system uses. The public receptionist is constructed with `publicTools` only —
internal tools are **absent from its registry**, not merely denied to it. The
surface is chosen server-side from the session; no request parameter can move a
caller between them.
**Reason:** A prompt is guidance, and a model can be talked out of guidance. The
instructions tell the AI not to invent a price; the architecture makes it
impossible for the public AI to reach one. The distinction between absent and
denied matters too: a denied tool is something an attacker can probe for and
learn from, an absent one is not there to find.
**Alternatives:** one registry with role checks (a check is a line of code that
can be forgotten on the next tool); giving the AI read-only database access
(fastest to build, and it would hand a language model the customer list).
**Impact:** Adding an internal tool is deliberate. The AI is handed
`DATA INCOMPLETE` rather than a number it could round off, so it can only report
what it was actually given. The conversation loop is bounded — four tool rounds,
forty messages — because an unbounded public AI is a bill and a database load
anyone can trigger.

## D-024 — An untagged AI statement is treated as DATA_INCOMPLETE

**Date:** 2026-08-24
**Decision:** `parseTaggedResponse` classifies any statement the model produces
without a `FACT` / `ESTIMATE` / `RECOMMENDATION` / `DATA INCOMPLETE` prefix as
`DATA_INCOMPLETE`.
**Reason:** The tag is what tells a partner whether a figure can be relied on.
Defaulting an untagged statement to `FACT` would mean the one case where the
model ignored its instructions is also the case that looks most authoritative.
Failing the other way costs a little confidence in a correct answer and prevents
a wrong one being trusted.
**Impact:** A model that drops its tags produces cautious output rather than
confident-looking output.

## D-025 — Unconfigured integrations have no approximate fallback

**Date:** 2026-08-24
**Decision:** The maps, email and SMS adapters fail explicitly when no provider
is configured. There is no straight-line distance standing in for a route, no
last-known position standing in for a live one, and no "queued" that reports as
"sent".
**Reason:** An approximation in maps does not stay in maps: an estimated
distance flows into a fuel estimate, into a cost, into a price, and reaches a
customer as a number nobody could trace back to a guess. An email believed sent
but never sent is an invoice BOYD'S waits for and never chases. The failure is
silent in both cases, which is what makes it dangerous.
**Impact:** Mileage is entered manually, and the interface says why. Outbound
messages become notifications a partner acts on. Every caller has handled the
unavailable case from the start, so connecting a real provider changes one file.

## D-026 — Stored numbers are parsed at the engine boundary

**Date:** 2026-08-24
**Decision:** `parseStoredCents` and `parseStoredMiles` convert a stored value
into a branded quantity, accepting a number or a digit-string and returning
`null` for anything else. `JobFinancialRow` types every numeric column as
`number | string | null`.
**Reason:** Found by the end-to-end test. PostgreSQL returns `bigint` columns as
**strings** — their range exceeds what JavaScript can represent safely, so the
driver refuses to guess — and every money and distance column in BOYD'S is a
bigint. The financial engine threw on the first real row it was given. Unit
tests had passed throughout because their fixtures used numbers.

The empty-string case is the sharper half. `Number('')` is `0`, so a blank
column would have become a recorded cost of zero: the exact "missing treated as
free" failure the entire system exists to prevent, arriving through a type
coercion rather than through anyone's decision. The parser rejects it
explicitly, along with decimals and scientific notation.
**Alternatives:** configuring the driver to parse bigints globally (fixes the
integration tests and not Supabase's JSON responses, which are a separate path);
coercing with `Number()` (accepts the empty string, and that is the bug).
**Impact:** A value the system cannot read exactly is `MISSING`, so it surfaces
as `DATA INCOMPLETE`. A silently wrong cost would show a confident, incorrect
contribution; an absent one shows that something needs recording.

## D-027 — The end-to-end test runs against the database, not the browser

**Date:** 2026-08-24
**Decision:** The required full-lifecycle test (`full-job-lifecycle.test.ts`)
runs against real PostgreSQL, performing each step as the person who would
really perform it — Ronald through a partner session, Moh through a driver
session. A Playwright suite covering the same journey through the interface is
deferred until a Supabase project exists.
**Reason:** BOYD'S has no Supabase project yet, so a browser test would have
nothing to authenticate against. Waiting would have left the most important test
in the system unwritten during the phase that most needed it. The database test
exercises every trigger, policy, constraint and state transition, and runs each
step under the right session — so it proves the workflow and the security
boundary together.
**Impact:** It caught two real bugs on its first run: the bigint parsing above,
and a missing-proof case the unit tests could not have reached. What it does not
cover is the interface layer, which the Playwright suite will add.

## D-028 — Rate limiting is in-memory, and honest about it

**Date:** 2026-08-24
**Decision:** An in-process limiter on the delivery request form (5/hour), the
AI endpoint (30/hour) and sign-in (10 per 15 minutes), keyed on the caller's
forwarded IP address.
**Reason:** All three are reachable by anybody. Without a limit, the request form
is a route to burying real enquiries in noise, the AI endpoint is a route to
running up a bill on BOYD'S account, and sign-in is a route to guessing a
password at leisure. An in-memory limiter is genuinely useful on a single
deployment and honest about what it is: it resets on restart and does not span
instances.
**Alternatives:** a distributed limiter (needs shared storage BOYD'S does not
have, and building it now would mean building the storage too); no limit
(leaves the AI endpoint as an open cost).
**Impact:** Only this file changes when BOYD'S outgrows it. The forwarded IP is
explicitly not trusted for anything but rate limiting — a client can send any
header, and someone who spoofs one to get a fresh allowance has achieved only
that. Unidentifiable callers share one bucket, which limits more rather than
less.

## D-029 — Function EXECUTE is revoked from PUBLIC explicitly

**Date:** 2026-08-24
**Decision:** Migration 0023 revokes `EXECUTE` from `PUBLIC`, `anon` and
`authenticated` on every function BOYD'S wrote, then grants back only what is
needed. `create_public_job_request` is the single public entry point.
**Reason:** Found by a security review, not by any test. PostgreSQL grants
`EXECUTE` on every new function to `PUBLIC` by default. BOYD'S had carefully
revoked table access from `anon` and then handed it every `SECURITY DEFINER`
function in the schema. Two mattered:

- `notify_partners(...)` — an anonymous visitor could raise fabricated
  notifications, burying real ones and, at 2am, waking the partners for work
  that does not exist.
- `find_dispatch_conflicts(...)` — returns job numbers and detail, so an
  anonymous caller could enumerate BOYD'S schedule.

**Two things were tried and rejected.** A blanket revoke across the whole schema
broke ordinary queries: it caught the `citext` extension's comparison functions,
which `anon` needs to read a citext column at all. And `ALTER DEFAULT
PRIVILEGES ... REVOKE EXECUTE FROM PUBLIC` is a silent no-op — PostgreSQL stores
an empty ACL as NULL, indistinguishable from the built-in default, so revoking
the only default privilege records nothing. It is deliberately **not** in the
migration: a line that looks like protection and is not is worse than no line.

The four RLS helpers (`is_partner`, `is_driver`, `current_app_user_id`,
`current_app_user_role`) _are_ granted to `anon`, because policies call them
during evaluation as the querying role and the query fails outright without it.
For an anonymous caller they return `false` and `null` — the answer the policies
need, and nothing the caller did not already know.

**Impact:** The guarantee is a test.
`tests/integration/function-permissions.test.ts` enumerates every function
`anon` may execute and asserts the exact list, so a new function added without a
revoke fails the build and is named in the failure.

---

## D-030 — Converting an enquiry never fills in an address

**Decision:** The convert-to-job form requires a complete collection and
delivery address and defaults nothing. Where the enquiry supplied a field, it is
prefilled; where it did not, the partner enters it.

**Why:** `job_stops` requires an address, a city, a state and a ZIP. The
straightforward way to satisfy that from a partial enquiry is a fallback —
`state ?? 'NC'`, `zip ?? '00000'`, `'Address to confirm'`. That was written and
then removed. A hardcoded `NC` violates the rule that the operating state is
data rather than a constant, and a ZIP of `00000` is not a missing value once it
is stored: it looks like an address, it prints on a job sheet, and it is what
Moh drives to. A phone enquiry that says only "Charlotte to Concord" is not a
deliverable address, and the honest response is to ask the partner for the rest.

For the same reason the conversion will not create a customer from an enquiry
that carries neither a company nor a contact name. There is nothing to name the
record after, so it returns an error instead of inventing `Unnamed customer`.

**Impact:** Converting a vague enquiry takes one extra step — confirming the
address with the customer — which is the step that would otherwise be skipped.

---

## D-031 — A job created from an enquiry has no price

**Decision:** `convertRequestToJob` creates the job at `APPROVED` with
`won_price_cents` left null. Pricing is a separate, deliberate act.

**Why:** `APPROVED` says a partner has agreed BOYD'S will do the work; it does
not say the van is free that day, so the job still has to be scheduled. And the
enquiry carried no agreed price. Writing zero would be worse than writing
nothing: a job priced at zero reports itself as a pure loss the moment any cost
lands on it, and it would drag the contribution figures down as though BOYD'S
had agreed to work for free. Null reaches the financial engine as
`DATA_INCOMPLETE`, which is the truth.

**Impact:** `tests/integration/request-conversion.test.ts` asserts the created
job is `APPROVED` and that its price is null rather than zero.

---

## D-032 — An incident report is immutable to the driver, and says so

**Decision:** A driver can file an incident report and read his own. He has no
update or delete policy, and an immutability trigger sits behind that. The form
tells him this before he sends it.

**Why:** The report is Moh's account of what happened, and its value to an
insurer, a customer or a partner rests entirely on it being what he said at the
time. A record that can be quietly revised afterwards is not evidence of
anything. Making the constraint visible in the form matters as much as enforcing
it: a driver who knows he cannot amend it writes it properly the first time,
and one who discovers the restriction afterwards feels caught out.

Corrections are a partner action and leave the original in the audit trail.

**Impact:** `tests/integration/incidents.test.ts` proves the row is untouched
after a driver's update and still present after his delete, and that another
driver's report is invisible to him.

---

## D-033 — The three yes/no questions have no default answer

**Decision:** "Was anyone hurt", "were the police involved" and "was anyone else
involved" are required radio buttons, stored as `not null` booleans. There is no
pre-selected value and no checkbox.

**Why:** A checkbox left unticked records `false`. That is a claim — that nobody
was hurt — made by nobody, and it is the first question an insurer asks. The
form makes the driver answer. "Not recorded" and "no" are different answers, and
the database cannot hold the first, so the interface has to guarantee the
second is real.

**Impact:** Three extra taps on a form Moh fills in rarely, in exchange for a
record BOYD'S can stand behind.

---

## D-034 — An incident has no cost until someone establishes one

**Decision:** `incidents.cost_cents` is nullable and is not on the driver's
form. A partner records it later. The interface shows `NOT ESTABLISHED` for
null, never `$0.00`.

**Why:** At the roadside nobody knows what a bump cost. A figure entered under
pressure becomes a fact in the reporting a week later. And zero is not a missing
value: it is the assertion that the incident cost BOYD'S nothing, which is
almost never true and, once written, is nobody's job to revisit.

The review form only writes the cost when one was given, so saving a status
change does not erase a figure established earlier.

**Impact:** Incident costs stay absent from profitability until they are real,
which is the same rule every other cost in BOYD'S follows.

---

## D-035 — Partners are told about an incident by a trigger, not by the action

**Decision:** `notify_partners_of_incident()` is an `after insert` trigger on
`incidents`.

**Why:** A report filed from the van is useless sitting unread, and the moment
notification is the application's job it can be forgotten in a code path, skipped
by a bulk insert, or lost to an error after the write succeeds. In the database
it cannot be reached around: if the report exists, the notification exists.

It also cannot be forged. `notify_partners` is executable by nobody
(D-029) — the trigger runs as its definer, so a notification can only come from
a real inserted row.

Severity maps deliberately: `MINOR` raises `ATTENTION`, `SERIOUS` and `CRITICAL`
raise `URGENT`. Everything urgent stops being urgent if a scraped mirror is.

**Impact:** `tests/integration/incidents.test.ts` files a report as a driver and
asserts the partner's notification exists, with the right severity for each
level.

---

## D-036 — A customer's contribution is shown, and shown as incomplete

**Decision:** The customer record shows revenue and contribution across that
customer's completed jobs, through the same `Calculation` engine the Command
Centre uses. A customer with any unrecorded cost reads `DATA INCOMPLETE`, not a
number.

**Why:** "Is this customer worth keeping" is the question the record exists to
answer, and revenue alone answers it wrongly — a busy customer at a bad price
looks like the best one on the page. But a contribution figure assembled from
partly-recorded costs is worse than none: it always flatters, because the
missing part is always a cost.

The figure comes from `features/command-centre/summary`, not from arithmetic
written into the page. No component re-implements a formula.

**Impact:** Early on, most customers will read `DATA INCOMPLETE`. That is the
honest state, and the badge names the jobs whose costs are missing, so it also
says what to do about it.

---

## D-037 — A multi-drop run is one job

**Decision:** The New Job form takes as many stops as the work has. It opens
with two, because most BOYD'S work is one collection and one delivery, but
neither the count nor the types are fixed. The server takes each stop's
sequence from its position on screen, not from anything the browser sends.

**Why:** The data model and `createJobSchema` have allowed multi-stop work from
the start; only the form was fixed at two. That gap had a cost: a one-collection
four-delivery run would have to be entered as four jobs, which invents three
collections that never happened and splits one run's mileage, fuel and time
across records that cannot be reconciled afterwards. Every profitability figure
downstream would be wrong, and wrong in the flattering direction, because each
invented job carries a full price and a fraction of the cost.

Taking the sequence from screen order rather than a posted field means a
tampered form cannot produce a delivery before its collection. The schema checks
that rule again afterwards regardless.

**Impact:** `tests/unit/multi-stop-jobs.test.ts` covers one-to-many, many-to-one,
a call-in on the way, and the four shapes of run that could not be driven.

---

## D-038 — A contract can exist without a rate

**Decision:** `contracts.agreed_rate_cents` is nullable, the form leaves it
blank by default, and a blank is stored as null.

**Why:** "Two runs a week, rate to be settled" is a real agreement and worth
recording — it is how BOYD'S knows what work is coming. Storing it at zero
would tell the profitability engine BOYD'S agreed to work for nothing, and
unlike a missing cost, a zero rate reads as a decision someone made.

The database refuses the other half-agreed states outright: a contract cannot
be `ACTIVE` without a start date, cannot end before it starts, and cannot carry
a negative rate.

**Impact:** Contracts had a table and a display panel but no way to create one,
and the panel was hidden when empty — so there was no path to a contract at
all. There is now, on the Invoices screen.

---

## D-039 — The test database imitates hosted Supabase, not plain PostgreSQL

**Decision:** The test harness now applies migrations as a non-superuser role
with `BYPASSRLS`, reproduces Supabase's default grants to `anon`,
`authenticated` and `service_role`, provides a `storage` schema with row level
security already on, and passes the signed-in user the way current PostgREST
does (`request.jwt.claims`, not `request.jwt.claim.sub`).

**Why:** The old harness applied migrations as a superuser and granted nothing
by default. Every one of those differences can hide a failure that only
appears in production. A superuser ignores every policy. Without Supabase's
default grants, a view or sequence that a migration forgot to revoke looks
private in the tests and is public in production. And with no storage schema,
nothing tested file uploads at all.

Making the harness honest found two security holes and a launch blocker on the
first run (D-040, D-041). 304 tests had passed against the old harness while all
three existed.

**Assumptions it rests on**, written at the top of
`supabase/test-harness/00_supabase_stub.sql`: Supabase's `postgres` role is not
a superuser but has `BYPASSRLS`; it can create policies on `storage.objects`;
`pgcrypto` is preinstalled in `extensions`. The first is load-bearing, since
forced row level security, the audit and notification triggers, and the two
owner-permission views all depend on it. So the production preflight checks it
on the real project before any migration runs, and stops if it is false.

**Impact:** `tests/integration/supabase-privileges.test.ts` also checks the
harness itself: if the migrations were ever applied as a superuser again, the
suite fails rather than quietly proving less.

---

## D-040 — Close the default grants Supabase gives the public role

**Decision:** Migration 0025 revokes Supabase's default grants from the two
driver views and the audit sequence, and changes the default so future tables,
views, sequences and functions are closed to `anon` and `authenticated` unless
a migration grants them.

**Why:** Earlier migrations revoked the defaults on every table but not on the
two views or on `audit_logs_id_seq`. Against the faithful harness:

- An anonymous visitor could insert maintenance records against any vehicle
  through `driver_vehicle_maintenance`. The view runs with its owner's rights
  and PostgreSQL can write through it, so the row bypassed row level security.
  Supabase's REST API exposes views in `public`, so on a live project this was
  one web request. Maintenance records feed cost per mile and every profit
  figure. A signed-in driver could do the same for any van.
- Anyone could call `setval` on the audit sequence. Resetting it makes every
  audited write collide with an existing id and fail. This was demonstrated
  against the test database: a sequence change survives a rollback, so it
  stayed broken until the database was rebuilt. Supabase's REST API does not
  expose `setval`, so this was defence in depth rather than an open door.

Closing future defaults means the next object added without explicit grants is
unreachable, not public. Every existing migration already grants explicitly, so
nothing that works today stops working.

**Impact:** `supabase-privileges.test.ts` asserts the exact set of relations the
public can reach (`job_types` and `service_areas`, read-only), that no signed-in
role can write through a view, and that no API role holds a sequence.

---

## D-041 — The document store is created by a migration

**Decision:** Migration 0026 creates the private `boyds-documents` bucket and the
policies on `storage.objects`. Partners can reach every file. A driver can upload
to and read only `jobs/<their job id>/...`. Nobody can delete a filed proof of
delivery except a partner. The public can reach nothing.

**Why:** Uploads run under the signed-in user's own session, so they are subject
to row level security on `storage.objects`. Supabase turns that on and ships no
policies. Before this migration there was no bucket and no storage policy
anywhere in the repository. The deployment runbook said to create the bucket by
hand but gave no policies, so on a real project every signature and photo from
the van would have been refused. Proof of delivery is required before
`POD_RECEIVED`, so no job could have been completed.

If a bucket was already created in the dashboard, the migration forces it
private rather than trusting it. It deliberately does not run `alter table
storage.objects enable row level security`: Supabase has already done that, and
the statement fails on a hosted project because Supabase's storage role owns the
table.

**Impact:** `tests/integration/document-storage.test.ts`, ten tests, run under
the same user sessions the app uses.

---

## D-042 — Correction: D-009 was never implemented

**Decision:** D-009 said automatic acceptance was disabled by a
`company_settings.auto_acceptance_enabled` column defaulting to `false`. No
migration ever created `company_settings`, and no code reads such a flag. The
documentation that repeated the claim (the roadmap, the AI, security, database
and business specification documents) has been corrected.

**What is actually true:** automatic acceptance is disabled because **no
automatic decision path exists in the code.** Nothing can accept, decline or
schedule a job except a partner. That is a stronger guarantee than a flag, not a
weaker one: there is no code that could run if the flag were ever flipped.

**Why not build the table now:** a flag that nothing reads is protection in name
only. It is the same mistake D-029 refused to make with a no-op
`ALTER DEFAULT PRIVILEGES`: a line that looks like protection and is not is worse
than no line. When automatic acceptance is eventually built, the flag arrives
with it, defaulting to off at the database, in the same migration as the code it
controls.

**How it was found:** while writing the production verification script, checking
every safeguard the documentation claims against the real schema.

---

## D-043 — What a backup holds, and what it deliberately leaves out

**Decision:** `scripts/backup-database.sh` dumps the data only: the `public`
schema and the sign-in accounts, stamped with the migration version. It leaves
out the schema and `job_status_transitions`. Restores go into an empty project,
in one transaction, with triggers paused.

**Why:** The migrations are the schema. A backup that also carried the schema
would be a second, older source of truth that a restore could quietly roll the
database back to. `job_status_transitions` _is_ the job state machine, so an old
copy restored into a newer schema would reinstate old rules without anyone
noticing. The migration version in the header lets the restore refuse a target
older than the backup.

Triggers are paused because they would otherwise fight a faithful restore. The
state machine refuses a job inserted directly at `COMPLETED`. The audit trail
would record every restored row as a fresh change, burying the real history.
This is the method Supabase's own restore procedure uses.

Uploaded files are not in the database and cannot be in this backup. That is
stated in the script, the runbook and here, because a backup that silently
leaves out every proof of delivery is the kind of gap discovered on the worst
possible day.

**Impact:** Rehearsed end to end. Row counts identical on all 33 tables,
sequences positioned exactly, and the restored database accepted new audited
work.

---

## D-044 — Accessibility fixes keep the brand colour and change the text

**Decision:** The primary call-to-action button keeps the brand orange
(`#ea580c`) exactly and uses deep navy text instead of white. The secondary text
colour `light-500` moves from `#64748b` to `#8090a6`.

**Why:** White on the brand orange measures 3.55:1, below WCAG AA's 4.5:1, on
the most important button on every page. The two fixes were to darken the orange
or to change the text. The mockup is authoritative for colour, so the orange
stayed. Navy on orange measures 5.47:1, and 6.94:1 on hover.

`light-500` measured 3.3 to 4.1:1 against the navy backgrounds. It is the colour
of footers, hints and captions across both the site and the operations app.
`#8090a6` is 4.8:1 or better on every navy surface text sits on, and is still
clearly dimmer than `light-400`, so the visual hierarchy survives.

**Impact:** `e2e/accessibility.spec.ts` scans every page in the sitemap, so a
page added later is covered the day it is added.

---

## D-045 — People are records an admin manages, not code

**Decision:** Every person is a row in `users`, added, invited, re-roled,
deactivated and reactivated from the Team screen by an ADMIN. Nothing in the
code names Ronald or Moh. The one exception is the very first admin, created
once by `scripts/bootstrap-first-admin.sql`, because nobody exists yet to invite
them. That script takes the email as a value typed in at run time, and refuses
to run a second time.

**Why:** A small business adds people: a second driver, a dispatcher, a new
partner. If each needed a developer, the software would become the bottleneck.
The roles and the `users.manage` capability already existed; this puts a
screen and a safe database path behind them rather than inventing a second
system.

---

## D-046 — A person can exist before their email does

**Decision:** `users.email` is nullable, but only while no sign-in account is
linked (`users_signin_needs_email`), and nobody can be ACTIVE without one
(`users_active_needs_signin`).

**Why:** Moh's real email address was not available. The choices were to block
his record, to invent an address, or to record him without one. Blocking would
have held up his partner and driver records and everything that hangs off them.
Inventing an address is forbidden, and it would also send an invitation
somewhere. Recording him without one is honest, and the two constraints stop the
missing email mattering: without an email he cannot be given a sign-in, and
without a sign-in he cannot be active.

When the address arrives, adding it links everything already recorded (his
partner record, his driver record, any jobs assigned to him) to his sign-in, on
the same row. No migration and no code change is involved.

---

## D-047 — Only an admin manages people, at the database

**Decision:** Migration 0027 replaces the partner write policies on `users` and
`partners` with admin-only ones.

**Why:** The application reserved user management for ADMIN, but the database
let any PARTNER update any user row, including their own role. A partner could
have made themselves an admin with one UPDATE, and the authoritative layer was
the one that allowed it. The database is meant to be at least as strict as the
screen. Now it is.

Driver records keep partner write access: licence details and the active flag
are operational records partners maintain day to day.

---

## D-048 — Guardrails live in a trigger, so no path avoids them

**Decision:** A trigger on `users` refuses four things:

- anyone changing their own role or status
- demoting or deactivating the last active admin
- re-pointing a linked sign-in account
- changing the email of someone who can already sign in

**Why:** Row level security decides _whether_ an admin may update a row. It
cannot express "not your own role" or "not the last admin". Those are rules
about the change itself. In a trigger they hold for the Team screen, for a
future screen, and for someone typing SQL into the dashboard. The last-admin
rule holds even for a superuser: a business with no admin could only be
recovered by a developer.

The trigger's messages are written to be shown to an admin as they are, and the
Team screen passes them through.

---

## D-049 — The service role key manages sign-in accounts and nothing else

**Decision:** The key is read in one module, `src/integrations/auth-admin/`,
which creates sign-in accounts, sends password links and blocks or unblocks
sign-in. People's records are written through the acting admin's own session.

**Why:** The key bypasses row level security. Using it to write `users` would
make the Team screen a second authorisation path that nobody tests, and the
audit trail would record no one as the actor. Confining it to Supabase Auth's
own admin API means the database's rules decide who may change a person, and
the log shows who did.

The adapter follows the live / unavailable / fake pattern. With no key
configured, the Team screen still adds and manages people and says plainly that
invitations cannot be sent. It never reports an invitation that did not go.

---

## D-050 — The audit trail was silently skipping users, partners and incidents

**Decision:** Migration 0027 adds audited columns for `users`, `partners` and
`incidents` to `audited_columns_for()`.

**Why:** The audit trigger records an update only for the columns listed per
table. These three had no list: a role change, a deactivation, or a partner
correcting a driver's incident report was recorded as nothing. For incidents
this contradicted D-032, which promised corrections leave the original on the
record. (The original _is_ captured when the report is filed, since inserts are
logged in full; it was later edits that vanished.)

**How it was found:** by the user-management test asserting that a role change
was audited. The fix covers incidents too, and there is now a test for each.

---

## D-051 — Email links work with Supabase's default templates

**Decision:** `/auth/confirm` accepts the three shapes an invitation or reset
link can arrive in: `?token_hash=` (BOYD'S own template), `?code=` (a reset
requested from the sign-in page), and a session in the `#fragment` (an
invitation or password-setup email sent with Supabase's default template). The
fragment is read in the browser by `/sign-in/link`, which accepts only
`invite` and `recovery` and clears the tokens from the address bar first.

**Why:** Supabase no longer lets a free-tier project change its email templates
unless it has its own email provider (the API answers "Email template
modification is not available for free tier projects using the default email
provider"). The runbook's template step therefore cannot be done on the
production project, and with the default template every invitation and every
password reset landed on "link invalid". Found on the live project by
generating an invitation link (no email sent) and following it: Supabase
redirected to `/auth/confirm#access_token=…&type=invite`.

When BOYD'S sets up a business email provider, the templates in
`docs/DEPLOYMENT.md` can be applied; both paths keep working.

---

## D-052 — Turbopack scope hoisting is off

**Decision:** `next.config.ts` sets `experimental.turbopackScopeHoisting: false`.

**Why:** On the first production deployment, `/settings` failed for Ronald with
`ReferenceError: unavailableMaps is not defined`. The source is correct; the
compiled page was not. Turbopack (Next 16.3.6, the newest 16.x) inlined
`getMaps()`, `getEmail()` and `getSms()` into the page and dropped the
declarations they return. Reproduced locally by signing in against the live
project with a production build: 500 with scope hoisting, 200 without it.
Turning off minification also avoided it, but would have enlarged every
bundle; scope hoisting is the stage at fault.

Only a signed-in partner reaches Settings, so no existing test could see it. A
guard test (`tests/guards/next-config.test.ts`) keeps the setting in place; it
should be removed only after a Next upgrade is shown to render `/settings` for
a signed-in partner.

---

## D-053 — A driver has no direct read of jobs or vehicles

**Decision:** Migration 0028 removes the driver policies on `jobs` and
`vehicles`. A driver reads their work through `driver_jobs` and
`driver_vehicle_maintenance` as before, and writes to a job only through
`driver_advance_job()` and `driver_record_mileage()`. Policies that needed "the
jobs assigned to me" (documents, job stops, the POD storage folders) use
`my_assigned_job_ids()`, which returns ids only. The driver insert policies on
expenses, fuel, mileage and incidents now also require the named job to be the
driver's own.

**Why:** Found during the live production verification. Business rule 28 says a
driver can never read a price or a cost, and CLAUDE.md §8 says not even by a
direct database query. The driver app already read only `driver_jobs`, but the
base-table policy `jobs_select_assigned` still let a signed-in driver's own
token select every column of their jobs (quoted and won price, every estimated
and actual cost), and `vehicles_select_own` exposed their van's purchase price,
insurance cost and policy number. Proved on the live database in a transaction
that was rolled back. Partners and drivers share the `authenticated` role, so a
column GRANT could not separate them; removing the row access is the only
database-level fix.

`scripts/verify-production.sql` check 17 stops if a driver policy returns to
either table.

---

## D-054 — Every business record belongs to one company (Phase 2, M1)

**Decision:** Migration 0029 adds `organisations` and a required
`organisation_id` to every business table. BOYD'S is the first company and
owns every record that existed before. A new record takes its parent's
company, else the signed-in person's; if neither exists the insert is
refused. Composite `(id, organisation_id)` foreign keys, generated from the
catalogue, make a reference from one company's record to another's
impossible at the database. `industries` and `job_status_transitions` stay
shared reference lists.

**Why:** Phase 2 decision: small logistics companies and 3PLs each get their
own space, with BOYD'S as customer #1. Isolation that depends on application
code being right everywhere is not isolation; the database must refuse it.
The app does not name a company on inserts: the database decides it, so no
code path can put a record in the wrong company.

**Not yet:** row level security is still role-based, not company-based. That
is milestone 2, and no second company may be created before it.

---

## D-055 — Reference numbers come from one counter per company

**Decision:** `organisation_counters` holds one row per company, kind and year.
`issue_reference_number()` increments it in one atomic statement;
`next_reference_number()` is what the app calls, for partners only, for their
own company only. Numbers are unique per company, not across companies.
Counters start from the highest number already issued in the system's own
format. Each company has a prefix (`B` for BOYD'S); past 9999 a number grows
(`BC-10000`) rather than being cut short.

**Why:** The app counted rows and added one. Two partners creating a job at
the same moment got the same number, and a deleted record made the next number
repeat an old one. With several companies a shared count would also reveal
one company's volume to another.

---

## D-056 — Incident reports are numbered BIR-, not BI-

**Decision:** New incident reports are `BIR-YYYY-NNNN`. Existing incident
numbers are left as they are. The old sequence is kept, unused, so backups
taken before the change still restore.

**Why:** Incidents and invoices were both `BI-YYYY-NNNN`, so "BI-2026-0003"
could mean either — on the phone, in an email, in a dispute.

---

## D-057 — The public form names its company; the old form works only while one company exists

**Decision:** `create_public_job_request` takes the company's slug first. The
website supplies it from `SITE_ORGANISATION_SLUG`; without it the form says it
cannot record requests and sends nothing. Unknown or suspended companies are
refused with the same message. A temporary copy of the old, slug-less
function stays so the live website keeps working between the database upgrade
and the website redeploy; it refuses the moment a second company exists and is
removed in milestone 4.

**Why:** An anonymous visitor belongs to no company, so the form must say whom
it is for. A request form is public by nature — anyone may send a request to
any company that has one — so the slug grants nothing: the visitor still reads
nothing back.

---

## D-058 — Notifications go only to the record's own company

**Decision:** `notify_partners()` requires the company and notifies only that
company's active partners and admins (0031). Each notification trigger passes
the company of the row that caused it.

**Why:** It notified every partner in the database. With a second company,
BOYD'S partners would have been told about another company's requests,
customers and incidents.

---

## D-059 — Restoring an old backup into a newer schema

**Decision:** `scripts/restore-database.sh` restores a backup taken before
companies into the current schema by giving every record to the one company
there is — refusing if there is more than one — and then brings the
reference counters up to the restored records. A backup taken after companies
carries its own. Both paths, and the upgrade of a populated 0028 database,
are rehearsed by `tests/integration/upgrade-to-companies.test.ts` using the
real backup and restore scripts.

**Why:** Found in the rehearsal: the pre-company backup BOYD'S would take
before this upgrade could not be restored into the upgraded project. A
backup that cannot be restored is not a backup.

---

## D-060 — Company isolation is one restrictive rule per table

**Decision:** Every company table has one RESTRICTIVE policy,
`<table>_same_company`: the row's company must be the signed-in person's.
Restrictive policies are ANDed with the permissive ones, so every existing
rule (partner-only, a driver's own jobs, a person's own notifications) keeps
working, now within one company. The rule is generated from the catalogue in
migration 0032; the isolation matrix and verify-production check 21 fail if
any company table lacks it. A person always reaches their own user row.

**Why:** Rewriting 58 policies by hand would leave 58 places to forget the
company. One rule per table, checked from the catalogue, cannot be forgotten
on a new table without a test failing.

---

## D-061 — The public role reads no table

**Decision:** The anonymous role loses its read of `job_types` and
`service_areas`. Its only access to the database is the request form
function.

**Why:** With several companies an anonymous read cannot say whose job types
or service areas it wants, and the website never used them — its service and
area content is static. Less public surface, nothing lost.

---

## D-062 — Every elevated-rights function is on a reviewed list

**Decision:** `tests/integration/definer-functions.test.ts` lists every
SECURITY DEFINER function with the reason it cannot cross companies. Two were
changed: `find_dispatch_conflicts` (a partner could pass another company's van
and learn its job numbers) now answers a signed-in caller only about their own
company, and the last-active-admin rule is per company. A person can no
longer be moved between companies.

**Why:** These functions bypass row level security, so the same-company rule
does not protect them. A new one must be reviewed before the build passes.
