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
