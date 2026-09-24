# BOYD'S — Phase 2 requirements (recorded, not started)

Recorded at production closeout on Ronald's instruction. **Nothing here is
built yet.** The plan for building it, and the decisions it needs, is in
`docs/PHASE_2_ARCHITECTURE.md`.

---

## 1. Visual design: light and dark modes

Ronald likes the current layout. The direction for Phase 2:

- A **light mode and a dark mode**, with the current dark design kept as the
  dark mode.
- A light mode built on **white and light-grey surfaces**, **orange as the
  primary accent and action colour**, and **dark navy or charcoal text**.
- A clean, modern CRM/SaaS appearance with a professional logistics and
  operations feel.
- Responsive on desktop, tablet and phone.

**What the current code means for this.** Colours are defined once as tokens
(`src/app/globals.css`), which is the right foundation. But the components use
_palette_ names (`bg-boyd-navy-950`, `text-boyd-light-400`) in 78 files, rather
than _role_ names (`bg-surface`, `text-muted`). A light mode therefore means
first introducing role-based tokens with light and dark values, then moving
components onto them. That is mechanical, but it touches nearly every screen,
so it needs its own phase, visual review, and the accessibility suite
(`e2e/accessibility.spec.ts`) run in both modes. The orange-button contrast
decision (D-044) will need rechecking against white surfaces.

---

## 2. Product direction: BOYD'S as customer #1 of a logistics operating system

A reusable operating system for small logistics companies, courier firms,
small 3PLs, distributors and dedicated delivery operators. BOYD'S is the first
customer.

The principle: find the **smallest set of capabilities a small operator would
actually pay for**, and do not build an enterprise system.

Capabilities to evaluate, not all to build:

- mapping, route planning, driver location, dispatch and vehicle visibility
- cost per job and per mile, fuel efficiency, deadhead / empty-mile analysis
  and route profitability
- driver-to-job proximity and job handoffs
- customer management, quoting, scheduling, POD, invoicing, analytics
- AI-assisted operations

**Already in place and reusable:** customers, quoting, jobs with multi-stop,
dispatch with double-booking prevention, the driver app, POD, invoicing and
contracts, derived cost per mile, contribution with honest incomplete-data
states, loaded/empty mileage, incidents, audit, user management, and a maps
adapter with an honest _unavailable_ state.

**Not in place:**

- Location data. `job_stops` and `customer_locations` have latitude and
  longitude columns, but nothing fills them. There is no geocoding and no
  driver-position table.
- A maps provider. Route distance, proximity and live position all depend on
  one.
- Anything a "live" driver position would need: device permission, battery
  cost, and a conversation with drivers about being tracked.

---

## 3. Multi-tenancy: what would have to change

The target is one system serving many companies, each with isolated users,
customers, jobs, vehicles, drivers, documents, invoices, reports, settings and
branding, enforced by row level security.

**Today the system is single-tenant.** No table has an organisation column. The
work, roughly in order of risk:

1. **An `organisations` table and an `organisation_id` on every business
   table**, with every policy rewritten to include it. Tenant isolation must be
   in row level security, not the application. This is the core of the work
   and the part that needs the most testing: one leaked policy leaks another
   company's customers.
2. **The identity helpers** (`is_partner()`, `is_driver()`, `is_admin()`,
   `current_app_user_id()`) must resolve _within an organisation_. The
   last-active-admin guardrail (D-048) must become per organisation.
3. **Reference numbers.** Six generators number records by counting the whole
   table (`BJ-2026-0001`, and so on). Per tenant they would reveal another
   company's volume and collide. They need per-organisation sequences.
4. **Reference data.** `job_types`, `service_areas` and `industries` are global.
   Each company needs its own, or an explicit shared set plus its own.
5. **Business decisions** are currently code constants that read NOT
   CONFIGURED, or `pricing_rules` rows. They become per-organisation settings,
   and still never default.
6. **The public website and intake.** `create_public_job_request` has no idea
   which company it belongs to. The organisation would come from the domain.
7. **Storage paths** (`jobs/<id>/...`) need an organisation prefix, and storage
   policies need to check it.
8. **Branding.** "BOYD'S" appears in 108 source files: navigation, email
   wording, website content, the AI prompts. It becomes organisation data.
9. **Locale.** America/New_York, USD, miles and gallons are fixed in code
   (`CLAUDE.md` §4). That is correct for BOYD'S, but becomes an organisation
   setting.
10. **A person in two organisations.** `users.auth_user_id` is unique, so one
    sign-in maps to one person, and so to one company. Supporting a contractor
    who drives for two companies means a membership table.

**Recommendation for when Phase 2 starts.** Decide multi-tenancy _before_
building mapping and the other new features. Every table added before the
organisation column exists is another table to migrate and re-secure
afterwards.

---

## 4. Known small items deferred from closeout

- Date inputs display in the browser's own format (`dd/mm/yyyy` on a
  UK-configured browser). The stored value is unambiguous. A US-format display
  regardless of browser settings would need custom date inputs.
