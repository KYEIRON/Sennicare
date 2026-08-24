# BOYD'S — Implementation Roadmap

Every phase ends at the same gate (`CLAUDE.md` §9): functionality, validation,
permissions, error handling, tests written, tests passing, types passing, lint
passing, production build passing, documentation updated. `npm run verify` runs
it. A phase that compiles is not a phase that is done.

Each phase ends in a commit prefixed `BOYDS:`.

---

### Phase 0 — Boundary ✅ complete

Repository inspected. Sennicare identified as a static site in `/website` with no
build system. `/BOYDS` established as an isolated project with `CLAUDE.md`, the
full documentation set, the architecture plan, the database plan, the folder
structure, and this roadmap.

### Phase 1 — Foundation ✅ complete

Next.js 16 + TypeScript 6 (strict) + Tailwind 4 + Zod 4 + Vitest 4. ESLint,
Prettier, and the `verify` gate. Branded types (`Cents`, `MilesTenths`,
`GallonsThousandths`, `Bps`, `MpgTenths`). The `Result`, `Calculation` and
`Configured` types. Money, distance, format and date-time helpers. The economic
cost vocabulary separating driver labour costing from partner compensation, and
derived vehicle cost per mile. Three route groups wired. BOYD'S design tokens.
85 unit tests passing, zero npm vulnerabilities.

### Phase 2 — Authentication and roles ✅ complete

Supabase Auth with SSR session handling and middleware. Migrations 0001-0003:
`users`, `partners`, `drivers`, with row level security on every table. The
`PARTNER` / `DRIVER` / `ADMIN` capability table, `requirePartner()`,
`requireDriver()`, `requireCapability()`. Sign-in, sign-out, and role-based
routing — partners to the Command Centre, drivers to the driver app. A
development seed for Ronald and Moh that invents no personal information.

**Done:** 181 tests passing, including 21 row level security tests run against
real PostgreSQL with the real migrations applied. A driver is proved unable to
read another person's record, see partner records, promote themselves, create an
account, or alter their own licence details.

### Phase 3 — Customers, vehicles, drivers, jobs ✅ complete

Migrations 0004-0016. Configurable reference data (industries, job types,
service areas — North Carolina is a row). Customers with multiple contacts,
reusable locations and notes. Fleet and drivers, with every vehicle
specification nullable and reading as NOT CONFIGURED until real documents
arrive. Jobs with multi-stop support, loaded/empty mileage, and every cost held
as estimated, actual and a derived state. Job requests kept distinct from jobs.
The full lifecycle as a state machine in Postgres and TypeScript, proved
identical by test. Dispatch with double-booking prevention. Trigger-written
audit trail. Command Centre, jobs, dispatch, customers, vehicles, drivers and
settings screens, plus the mobile driver application.

**Done:** 401 tests passing — 297 unit and guard, 104 against real PostgreSQL.

### Phase 4 — Moh Driver App ✅ complete

The `/driver` route group: today's work, current job, route with navigation and
one-tap calling, one large button per step of the lifecycle, odometer-based
mileage with the loaded/empty split, signature capture on a canvas, camera
photos for collection and delivery, and a separate Record screen for fuel and
expenses between jobs.

Migration 0017 adds documents, job expenses and fuel transactions. Expenses roll
up into the job's actual costs by trigger, so a receipt recorded at the roadside
immediately makes that job's contribution more complete — and a category with no
receipt stays MISSING rather than becoming zero. Proof of delivery is now
required before `POD_RECEIVED`, enforced in the database.

Storage is a private bucket behind the three-adapter pattern: live when the
database is configured, explicitly unavailable when it is not, and never
pretending a file was saved.

**Done:** 441 tests passing — 318 unit and guard, 123 against real PostgreSQL.

### Phase 5 — Mileage, fuel, expenses, POD

`mileage_logs`, `fuel_transactions`, `job_expenses`, `documents`. Loaded/empty
classification. Odometer validation. Private storage buckets and signed URLs.
Receipt and POD capture from the driver app.
**Done when:** loaded + empty = total is enforced and every guard is tested.

### Phase 6 — Profitability engine

`src/services/finance/`. Cost stack, contribution, contribution per mile, margin,
empty mileage percentage, true cost per mile, the configurable vehicle cost
model, `ACTUAL` vs `BEST_AVAILABLE` bases. The `job_profitability` view and the
test asserting it agrees with the TypeScript engine.
**Done when:** every worked example in `FINANCIAL_ENGINE.md` passes, including
the $300 → $60 case and the `DATA INCOMPLETE` case.

### Phase 7 — Command Centre

The operations home screen: what is happening now, where the van is (or
`GPS NOT CONNECTED`), the active job, what is next, revenue, costs, contribution,
miles, empty miles, what needs attention, what opportunities exist. Today and
month-to-date KPIs. Daily, weekly, and monthly reports.
**Done when:** no KPI can display a figure derived from incomplete data without
saying so.

### Phase 8 — CRM and quoting

Leads, the pipeline, follow-ups, opportunities. Quotes with the transparent
pricing engine, `pricing_rules`, minimum contribution checks with audited
override, expiry, and acceptance creating a job.
**Done when:** no quote can be created outside the pricing engine.

### Phase 9 — Invoices, contracts, maintenance

Invoices from completed jobs, invoice lines, payments, statuses, ageing.
Contracts and recurring work. Maintenance records and reminders.
**Done when:** an invoice cannot reach `PAID` without a payment record covering it.

### Phase 10 — Public website

The `(site)` route group: home, services, service pages, service areas, about,
request a quote, request a delivery, contact, FAQ, privacy, terms. SEO
architecture, location pages generated from `service_areas`, sitemap, robots,
structured data, Open Graph. Public forms writing real leads and job requests.
**Needs from Ronald:** a domain name and a Vercel account to go live.
**Done when:** no unverified claim appears anywhere, asserted by a content test.

### Phase 11 — BOYD'S AI (internal)

Provider abstraction, the internal tool registry, the tagging system
(`FACT` / `ESTIMATE` / `RECOMMENDATION` / `DATA INCOMPLETE`), conversation
storage, and the business-intelligence assistant.
**Needs from Ronald:** an AI provider API key.
**Done when:** the AI provably cannot reach data outside its tool registry.

### Phase 12 — AI receptionist and 24/7 intake

The public receptionist with `publicTools` only. Full intake field set.
Lead qualification. Recurring-business detection raising `CONTRACT_OPPORTUNITY`.
`AFTER_HOURS` marking and notification. The 2 AM Playwright test.
**Done when:** the after-hours test passes and no price, availability, or
confirmation appears in the transcript.

### Phase 13 — Maps and notifications

Maps provider adapter — geocoding, routing, mileage, vehicle location. The
notification system across all events in the specification, with email and SMS
adapters.
**Needs from Ronald:** maps, email, and SMS provider accounts.
**Done when:** every unconfigured provider shows an explicit unavailable state.

### Phase 14 — Advanced automation

The return-load engine (current location, destination, available jobs, radius,
revenue, mileage, estimated cost, contribution, ranking). Empty-mile reduction
insights. The `ACCEPT` / `REVIEW` / `DECLINE` decision path — built, tested, and
left disabled until the underlying data is trustworthy. Customer portal
foundations.

### Phase 15 — Production hardening

Rate limiting, error monitoring, backups and restore rehearsal, performance
budgets, accessibility audit, a security review, a load check, and the deployment
runbook.

---

## Order of value

Phases 1–7 give BOYD'S a system that runs the actual business today: jobs
dispatched, work recorded, and — the point of the whole exercise — a truthful
contribution figure per job. Phases 8–9 turn that into money management. Phase 10
brings in customers. Phases 11–14 make the machine intelligent.

The financial engine (Phase 6) is where the most care goes, because every later
decision BOYD'S makes rests on those numbers being right.
