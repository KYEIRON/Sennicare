# BOYD'S — Architecture

## 1. Shape of the system

One Next.js application (App Router) serving three distinct surfaces from one
codebase and one database:

```
                        ┌──────────────────────────────┐
   public internet ───► │  (site)   Marketing website  │  anonymous
                        │           + AI receptionist  │
                        └──────────────┬───────────────┘
                                       │ creates job_requests / leads
                        ┌──────────────▼───────────────┐
   partners ──────────► │  (ops)    Operations OS      │  role: PARTNER
                        │           Command Centre     │
                        └──────────────┬───────────────┘
                                       │ assigns jobs
                        ┌──────────────▼───────────────┐
   Moh (phone) ───────► │  (driver) Driver application │  role: DRIVER
                        └──────────────────────────────┘
                                       │
                        ┌──────────────▼───────────────┐
                        │  PostgreSQL (Supabase) + RLS │
                        └──────────────────────────────┘
```

Three route groups, three layouts, three permission postures, one domain layer.

**Why one application rather than three:** at BOYD'S scale, three deployments
would triple the operational burden for no isolation benefit — the real isolation
boundary is the database (RLS) and the server-side authorisation layer, not the
process. Route groups give clean separation of layout and navigation, which is
what "the public website must remain clearly separated from the internal
operations interface" actually requires. Revisit when BOYD'S has a dedicated
engineering team. (See `DECISIONS.md` D-002.)

---

## 2. Layers

```
src/
  app/                  Next.js routes — thin. No business logic.
    (site)/             public marketing website
    (ops)/              partner operations OS
    (driver)/           Moh's mobile application
    api/                route handlers (webhooks, AI streaming, uploads)
  features/             vertical slices: UI + server actions per business area
    jobs/ customers/ quotes/ crm/ vehicles/ expenses/ invoices/ driver/ ...
  services/             the domain. Pure, framework-free, unit-testable.
    finance/            profitability engine, cost model, pricing engine
    jobs/               job state machine, job assembly
    mileage/            loaded/empty mile maths
    reporting/          aggregate report builders
  database/             repositories — the ONLY place SQL/Supabase queries live
  validation/           Zod schemas, shared by client, server, and AI tools
  types/                domain types, branded primitives, enums
  lib/                  auth, permissions, money, format, dates, errors, result
  ai/                   provider abstraction, tool registry, prompts
  integrations/         maps, email, sms, storage, payments — interfaces + adapters
  components/           shared UI (shadcn/ui primitives + BOYD'S components)
```

**Dependency rule — enforced by review and by lint:**

```
app  →  features  →  services  →  database  →  (Supabase)
                  ↘  validation, types, lib  ↙
```

`services/` must never import from `app/`, `features/`, or `components/`.
`services/` must never import the Supabase client — it receives plain data and
returns plain data. This is what makes the financial engine testable without a
database, which matters more here than anywhere else in the system.

---

## 3. Data access

Every read and write goes through a **repository** in `src/database/`. No page,
component, or server action builds a query itself.

Repositories use the Supabase client bound to the **caller's session**, so
Postgres RLS is the last line of defence and applies even if application code has
a bug. The service-role key is used only in a small number of clearly marked
server-only paths (webhook ingestion, scheduled jobs, the AI tool layer's
already-authorised reads) and never reaches the browser.

---

## 4. Authorisation

Three enforcement layers, all required:

1. **Database (RLS)** — the real boundary. A driver's session cannot select a
   financial column set it is not entitled to, regardless of application bugs.
2. **Server** — `requirePartner()`, `requireDriver()`, `assertCanAccessJob()` at
   the top of every server action and route handler.
3. **UI** — hiding controls the user cannot use. A convenience, never a control.

Roles: `PARTNER`, `DRIVER`, `ADMIN`. Capabilities are derived from role in
`src/lib/permissions.ts` — a single table mapping role → capability, so a new
role is one edit, not a search across the codebase.

---

## 5. Errors and results

Domain operations return a `Result<T, DomainError>` rather than throwing.
Financial calculations return a discriminated union:

```ts
type Calculation<T> =
  | { status: 'OK'; value: T }
  | { status: 'DATA_INCOMPLETE'; missing: string[] }
  | { status: 'NOT_CALCULABLE'; reason: string }; // e.g. division by zero
```

This makes "we do not know" a first-class value that the type system forces every
caller to handle. It is the mechanism behind the "never guess" rule.

---

## 6. Integration abstraction

Each integration is an interface in `src/integrations/<name>/types.ts` with:

- a **live adapter** (used when credentials are present),
- an **unavailable adapter** (used when they are not) that returns an explicit
  `UNAVAILABLE` result the UI renders as `GPS NOT CONNECTED` / `Live tracking
unavailable`,
- a **fake adapter** used **only** by the test suite, never reachable in a
  development or production runtime.

Selection happens once, at startup, in `src/integrations/registry.ts`, based on
whether the required environment variables are set. Nothing downstream knows
which adapter it has.

Covered: `maps`, `email`, `sms`, `ai`, `storage`, `payments`.

---

## 7. AI architecture

The AI never sees the database. It sees a registry of server-side tools
(`src/ai/tools/`), each of which:

- declares a Zod input schema,
- declares the minimum role required,
- runs an authorised repository call,
- returns structured, permission-filtered data.

Two tool sets: `publicTools` (create a lead, create a job request, describe
services and service areas) and `internalTools` (profitability, jobs, quotes,
customers, mileage, expenses, invoices). The public receptionist is constructed
with `publicTools` only — internal tools are not merely unauthorised for it, they
are absent from its registry.

The provider is abstracted (`src/ai/provider.ts`) so BOYD'S is never
architecturally locked to one AI vendor.

---

## 8. Technology

| Concern    | Choice                             |
| ---------- | ---------------------------------- |
| Framework  | Next.js (App Router)               |
| Language   | TypeScript, `strict`               |
| UI         | React + Tailwind CSS + shadcn/ui   |
| Database   | PostgreSQL via Supabase            |
| Auth       | Supabase Auth                      |
| Storage    | Supabase Storage (private buckets) |
| Validation | Zod                                |
| Unit tests | Vitest                             |
| E2E tests  | Playwright                         |
| Deployment | Vercel                             |

---

## 9. Non-negotiables

- Money is integer cents. Distance is integer tenths of a mile. No floats.
- No business logic in a React component.
- No SQL outside `src/database/`.
- No formula outside `src/services/finance/`.
- No unvalidated input crossing a trust boundary.
- No fake data in any runtime path.
