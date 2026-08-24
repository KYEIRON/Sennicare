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

### Phase 1 — Foundation
Next.js + TypeScript (strict) + Tailwind + shadcn/ui. ESLint, Prettier, Vitest,
Playwright. `.env.example`. Supabase local development. Branded types (`Cents`,
`MilesTenths`, `Bps`), `Result` and `Calculation` types, money and format
helpers, the `verify` script. Route group skeletons and the BOYD'S design tokens.
**Done when:** the app builds, the gate passes, and `src/lib` is unit tested.

### Phase 2 — Authentication and roles
Supabase Auth, SSR session handling, middleware. `users`, `partners`, `drivers`
tables with RLS. `PARTNER` / `DRIVER` / `ADMIN` roles, the capability table,
`requirePartner()` / `requireDriver()`. Login, logout, role-based redirect —
partners to `(ops)`, drivers to `(driver)`. Ronald and Moh seeded.
**Done when:** permission tests pass at both the API and the database layer.

### Phase 3 — Customers, vehicles, drivers, jobs
Migrations `0003`–`0005`. Customer CRUD. Vehicle management with `BOYD-001`
(unknown real-world fields left null). Job CRUD with stops. The job state machine
in TypeScript and in a Postgres trigger, with the equivalence test. Dispatch:
assign a vehicle and a driver.
**Done when:** the full status lifecycle is enforced from both sides.

### Phase 4 — Moh Driver App
The `(driver)` route group: Today, job detail, the action sequence. Large-touch
mobile UI. Camera capture. Signature pad. `driver_jobs` view — no financial
columns. Offline-tolerant writes.
**Done when:** a driver session provably cannot reach a price or a cost.

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
