# BOYD'S — Security

## Authentication

Supabase Auth. Email + password with email confirmation for V1; the adapter
accommodates magic links and MFA later without a change to calling code. Sessions
are httpOnly cookies handled by Supabase SSR middleware. There are no
application-managed passwords and no custom crypto.

## Authorisation — three layers, all mandatory

1. **Postgres RLS** — the real boundary. Enabled on every table. A compromised or
   buggy application path still cannot read what the session's role forbids.
2. **Server-side guards** — `requirePartner()`, `requireDriver()`,
   `assertCanAccessJob(jobId)` at the entry of every server action and route
   handler. Never inside a component.
3. **UI** — hides controls the user cannot use. A convenience only. Hidden UI is
   never treated as an access control.

Roles: `PARTNER`, `DRIVER`, `ADMIN`. Role → capability mapping lives in one
table in `src/lib/permissions.ts`.

## The driver boundary

Drivers must not reach company-wide financial information. Enforced by:

- RLS on `jobs` restricting rows to `driver_id = current_app_user()`.
- Column-level exclusion: the driver application reads the `driver_jobs` view,
  which contains no price, cost, contribution, or margin column.
- No driver-role grant on `customers`, `quotes`, `invoices`, `payments`,
  `pricing_rules`, `contracts`, `audit_logs`, or `company_settings`.
- Server guards that reject a driver-role session on every partner endpoint.

A test suite authenticates as a driver and asserts each of these paths fails.

## The public boundary

The public website and public AI receive only what they need to answer questions
and create requests: active service types, active service areas, published
content. They have **no** access to internal profitability, driver personal
information, internal pricing rules, other customers, financial records, private
documents, or partner information.

Anonymous writes go through one `SECURITY DEFINER` function,
`create_public_job_request(...)`, which validates its input, writes one lead and
one job request, and returns only a reference number. There is no anonymous
table grant and no anonymous read-back.

## Secrets

- `.env` is never committed. `.env.example` is kept current with every variable
  name, a comment on what it is for, and no real value.
- The Supabase service-role key is server-only, used in a small set of clearly
  marked paths, and never sent to the browser. Only `NEXT_PUBLIC_`-prefixed
  variables reach the client, and the anon key is the only Supabase key among
  them.
- Secrets are never logged. Customer PII is never logged.

## Storage

All document buckets are **private**. Files are served through short-lived signed
URLs generated server-side after an authorisation check. Uploads validate MIME
type and size. Storage paths are namespaced by entity and never guessable.

## Input validation

Zod at every trust boundary: server actions, route handlers, webhooks, AI tool
inputs, and public forms. The client-side schema is the same module as the
server-side schema, and the server never trusts the client's run of it.

## Rate limiting and abuse

Public endpoints — quote request, delivery request, contact, AI chat — are rate
limited per IP and per session. The AI receptionist has a per-conversation
message cap and a per-IP daily cap so a public LLM endpoint cannot be turned into
a cost attack.

## Audit

Trigger-written, append-only `audit_logs` covering job status, job price, quote
price, expenses, vehicle assignment, driver assignment, invoice status, customer
status, contract status, and pricing rules. Records user, action, entity, entity
ID, old value, new value, and timestamp. No role holds UPDATE or DELETE.

## Dependencies

Lockfile committed. `npm audit` runs in the verification gate. No dependency is
added without a reason recorded in `DECISIONS.md` when it is architecturally
significant.
