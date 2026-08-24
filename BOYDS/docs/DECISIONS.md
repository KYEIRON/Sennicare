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
