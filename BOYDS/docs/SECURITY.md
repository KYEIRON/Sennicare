# BOYD'S — Security

## Authentication

Supabase Auth. Email and password for V1; magic links and MFA can be added later
without changing calling code. Sessions are httpOnly cookies refreshed in
middleware, which is the only place able to write them. There are no
application-managed passwords and no custom crypto.

Middleware calls `getUser()`, not `getSession()`: `getSession()` reads the cookie
without revalidating it, and a cookie is client-supplied data.

**There is no public sign-up.** A Supabase Auth account with no corresponding
BOYD'S `users` row has no role and therefore no access — it is signed straight
back out. Accounts are provisioned deliberately by an admin, so nobody can
self-provision into the business by registering.

**Sign-in failures are deliberately uniform.** A wrong password, an unknown
address, and an address with no BOYD'S record all return the same message.
Distinguishing them would let anyone confirm whether an address has an account
here. See docs/DECISIONS.md D-017.

Passwords require 12 characters and no composition rules. Length resists
guessing; forced character classes mostly produce predictable substitutions.

## Managing people

People are data. Adding, inviting, re-roling, deactivating and reactivating
happen on the Team screen, with no code change. The rules are enforced by the
database (migration 0027), not by the screen:

- **Only an ADMIN can create or change a person, or a partner record.** Before
  0027 the database let any PARTNER update any user row, including their own
  role, although the application already reserved user management for ADMIN.
  The authoritative layer was the weaker one. It no longer is.
- **Nobody can change their own role or status**, by any route.
- **The last active admin cannot be demoted or deactivated**, even by a
  superuser, so the business can never be left with nobody able to manage people.
- **A linked sign-in account cannot be re-pointed at another person.** That
  would hand one person's access to someone else.
- **Nobody is ACTIVE without a sign-in account, and nobody has a sign-in
  account without an email.** A person may be recorded before their email is
  known, but nothing is ever filled in for them.
- **Activation is narrow.** `record_my_sign_in()` turns the caller's own
  INVITED account ACTIVE on first sign-in. It never reactivates a SUSPENDED or
  INACTIVE one; that is an admin's decision.
- **Deactivation is immediate.** Only ACTIVE people resolve in row level
  security, so every permission goes the moment the status changes, mid-session
  included. The sign-in account is also blocked, so no fresh session can be
  obtained.
- **Every change is audited**: who changed whose role or status, from what, to
  what.

The **service role key** is used in exactly one place: the auth admin adapter
(`src/integrations/auth-admin/`), to create and manage sign-in accounts. It never
reads or writes business data. People's records are written through the acting
admin's own session, so row level security still decides and the audit trail
records who acted. A guard test fails the build if the key is read anywhere
else.

Invitation and password-reset links are verified on the server
(`/auth/confirm`). Only those two link types are accepted; a sign-up link is
refused. "Forgot your password?" answers identically whether or not the address
has an account, and is rate-limited like sign-in.

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

- **No direct read of `jobs` or `vehicles` at all** (migration 0028). Both
  tables hold prices and costs, and partners and drivers share one database
  role, so a column GRANT cannot hide them from drivers alone. Instead a driver
  has no policy on either table: a direct query returns nothing, even for their
  own job. Their work reaches them through the `driver_jobs` and
  `driver_vehicle_maintenance` views, which contain no price, cost,
  contribution, or margin column and filter to the caller's own work.
- Their only two writes to a job, advancing its status and recording mileage,
  go through `driver_advance_job()` and `driver_record_mileage()`. Each checks
  the job is assigned to the caller, then runs the ordinary update with the
  state machine, the driver column guard and the audit trail in force.
- Field records (expenses, fuel, mileage, incidents, documents, POD files) may
  name only the driver's own jobs. See docs/DECISIONS.md D-053.
- No driver-role grant on `customers`, `quotes`, `invoices`, `payments`,
  `pricing_rules`, `contracts`, or `audit_logs`.
- Server guards that reject a driver-role session on every partner endpoint.

A test suite authenticates as a driver **against real PostgreSQL** and asserts
each of these paths fails. As at Phase 2 the following are proved, not assumed:

- A driver reading `users` sees exactly one row — their own. They cannot
  enumerate the people in the business.
- A driver reading `partners` sees zero rows.
- A driver cannot set their own role to `PARTNER` — no update policy matches, so
  the statement affects zero rows.
- A driver cannot insert a new user, or a partner record for themselves — both
  are rejected by row level security.
- A driver cannot read or write another driver's record.
- A driver can update their own phone number, and **cannot** alter their own
  licence details or active status — enforced by trigger, because partners and
  drivers share one database role and a column GRANT cannot tell them apart.
  See docs/DECISIONS.md D-015.
- A suspended account loses every partner privilege immediately: `is_partner()`
  returns false and every partner policy fails closed. It retains read access to
  its own user row only, so the application can say "this account is not active"
  rather than something misleading.
- An anonymous session is refused outright on every identity table.
- No table in the public schema has row level security disabled.

`is_partner()` and `is_driver()` return **false** when no session resolves. An
unknown caller is never a partner. Both helpers resolve only `ACTIVE` users, so
suspension takes effect at the database on the next statement.

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
