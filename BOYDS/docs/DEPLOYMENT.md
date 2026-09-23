# BOYD'S — deployment

Technical reference for whoever deploys the system.

## What runs where

One Next.js application on Vercel, one Supabase project. Nothing else.

```
Vercel (Next.js)              Supabase
├── (site)   public website   ├── PostgreSQL + Row Level Security
├── (ops)    operations       ├── Auth
├── (driver) driver app       └── Storage (private buckets)
└── /api/ai  AI endpoint
```

## Environment variables

Required:

```
NEXT_PUBLIC_SUPABASE_URL        Project URL from Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY   anon public key
SUPABASE_SERVICE_ROLE_KEY       service_role key — SERVER ONLY
NEXT_PUBLIC_SITE_URL            https://<the live domain>
```

Optional. Each absent variable leaves its capability reporting UNAVAILABLE:

```
AI_PROVIDER / AI_API_KEY / AI_MODEL
MAPS_PROVIDER / MAPS_API_KEY
EMAIL_PROVIDER / EMAIL_API_KEY / EMAIL_FROM
SMS_PROVIDER / SMS_API_KEY / SMS_FROM
```

`SUPABASE_SERVICE_ROLE_KEY` carries no `NEXT_PUBLIC_` prefix, so Next.js will not
bundle it into browser code even by accident. A standing guard test
(`tests/guards/no-secret-exposure.test.ts`) fails the build if anyone adds one.

## Applying the database structure

Migrations are plain SQL in `supabase/migrations/`, numbered and applied in
order. They are immutable once applied — a correction is a new migration, never
an edit to an old one.

Use the deployment script. It runs a read-only preflight on the real project,
shows the plan, applies only when told to, and then verifies the result:

```bash
# Dry run: checks the project and lists what would be applied. Changes nothing.
SUPABASE_DB_URL='<connection string>' ./scripts/deploy-database.sh

# Apply, then verify.
SUPABASE_DB_URL='<connection string>' ./scripts/deploy-database.sh --apply
```

The connection string is in Supabase → Project Settings → Database. Use the
**Session pooler** URI; it works from any network. It contains the database
password. Keep it out of chat, out of files and out of shell history.

Any `STOP` row from the preflight means nothing is applied. Any `STOP` row from
the verification means the project must not be put into service yet. The two
scripts, `scripts/preflight-production.sql` and
`scripts/verify-production.sql`, are single read-only `SELECT` statements, so
they can also be pasted into the Supabase SQL editor or run through the Supabase
MCP to inspect a project at any time.

**Use one way of applying migrations, and only one.** The script uses the
Supabase CLI, which records each migration under its file number (`0001` …
`0026`). The Supabase MCP's `apply_migration` records a timestamp instead. Mix
the two and the CLI will not recognise migrations the MCP applied: it will try
to apply them again, and fail halfway through. Use the MCP for read-only
inspection, and apply migrations with the script.

### From Windows, with the Supabase MCP

The script needs bash and `psql`, which a Windows machine usually lacks. The
same four steps work from PowerShell, in the `BOYDS` folder, in a Claude Code
session where the Supabase MCP is authenticated:

1. **Preflight (read-only).** Run the contents of
   `scripts/preflight-production.sql` through the MCP's SQL tool, or paste it
   into the Supabase SQL editor. Any `STOP` row means stop.
2. **Plan (changes nothing).** This needs Node.js. The connection string goes
   in an environment variable, typed at the prompt, never pasted into chat:
   ```powershell
   $env:SUPABASE_DB_URL = Read-Host -MaskInput 'Connection string'
   npx --yes supabase@2.117.0 db push --dry-run --db-url $env:SUPABASE_DB_URL
   ```
3. **Apply.**
   ```powershell
   npx --yes supabase@2.117.0 db push --db-url $env:SUPABASE_DB_URL
   Remove-Item Env:SUPABASE_DB_URL
   ```
4. **Verify (read-only).** Run `scripts/verify-production.sql` the same way as
   step 1. Any `STOP` row means the project is not ready for service.

Apply with the CLI, as above, never with the MCP's `apply_migration`, for the
reason below.

The whole sequence (preflight, dry run, apply, verify, and a refused apply when
the preflight fails) was rehearsed against a local database built to behave like
hosted Supabase, using the same CLI version the script pins.

The private storage bucket, `boyds-documents`, and its access policies are
created by migration 0026. Do not create the bucket by hand. If one already
exists, the migration forces it private and applies the application's size and
file-type limits rather than trusting whatever was set in the dashboard.

**The bucket must never be public.** Proof of delivery, receipts and signatures
are customer records. Partners can reach every file; a driver can upload to and
read only the folders of jobs assigned to them; the public can reach nothing.

## Authentication settings

Set these in Supabase before anyone is invited. The Supabase MCP and the CLI
cannot set them on a hosted project without an access token, so they are
done by hand, once, in the dashboard.

1. **Authentication → Sign In / Providers → Email:** turn **off** "Allow new
   users to sign up". There is no public sign-up; people are added by an admin.
   (Even if it were left on, a self-registered account has no BOYD'S record and
   is refused, but there is no reason to allow it.)
2. **Authentication → URL Configuration:** set **Site URL** to the production
   address (e.g. `https://<your domain>`), and add `https://<your domain>/auth/confirm`
   to **Redirect URLs**.
3. **Authentication → Emails → Templates.** Change the link in two templates so
   it lands on BOYD'S own confirmation page, which verifies it on the server:
   - **Invite user:**
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
   - **Reset password:**
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
4. **Email sending.** Supabase's built-in email service sends only a handful of
   messages an hour and is meant for testing. It is enough to invite a small
   team. When BOYD'S has a business email provider, set it under
   **Authentication → Emails → SMTP Settings**.
5. **Vercel → Environment Variables:** add `SUPABASE_SERVICE_ROLE_KEY`
   (Supabase → Project Settings → API keys → the secret / service_role key).
   **Never** prefix it `NEXT_PUBLIC_`. It is used only to send invitations and
   manage sign-in accounts, never to read business data. Without it, people can
   still be added and managed, and the Team screen says plainly that invitations
   cannot be sent yet.

## Creating the first admin

Everyone is added from the **Team** screen by an admin, except the first admin,
because nobody exists yet to add them. Once, on a freshly deployed project:

1. **Supabase → Authentication → Users → Add user → Create new user.** Enter
   the admin's real email and a strong password, and tick **Auto Confirm User**.
2. Open `scripts/bootstrap-first-admin.sql`, edit the four values at the top
   (email, first name, last name, role in the business), and run it in the
   Supabase SQL editor.
3. Sign in at `/sign-in`. The admin lands on the Command Centre and has the
   Team screen.

The script refuses to run if its values are unedited, if an active admin
already exists, or if the sign-in account from step 1 does not exist. It changes
nothing unless every check passes. The email is typed into the script at run
time; it is never stored in the repository.

## Adding everyone else

From **Team → Add a person**, as an admin. Any role: Admin, Partner or Driver,
plus "a business partner" (a partner record) and "drives for BOYD'S" (a driver
record), in any combination. A partner who drives, like Moh, is a Driver-role
user with both records.

**No email yet?** Leave it blank. The person is saved, with their partner and
driver records, as _Waiting for email_. When the address is known, **Save
email** on their card sends the invitation, and the records already in place are
theirs the moment they sign in. No code or schema change is involved.

The invitation email links to `/auth/confirm`, then to _Set your password_.
Their first sign-in activates them. Deactivating someone removes every
permission at the database immediately and blocks their sign-in account;
reactivating restores it.

## Verifying a deployment

```bash
npm run verify
```

Runs formatting, linting, type checking, the unit and guard tests, the database
tests against a PostgreSQL built to behave like hosted Supabase, a production
build, and the browser tests (accessibility, route protection and the public
request form, on a desktop and a phone). The database tests do not skip when no
database is reachable. They fail with instructions, because a run that quietly
did not exercise the security boundary would report success while proving
nothing.

Against the live project, run `scripts/verify-production.sql`. The deploy
script runs it automatically.

## Backups

```bash
SUPABASE_DB_URL='<connection string>' ./scripts/backup-database.sh
```

Writes `backups/boyds-backup-<UTC time>.sql`, readable only by you. The
`backups/` folder is git-ignored. **It contains customer and staff personal
data.** Keep it somewhere private.

It holds every row of BOYD'S data, the sign-in accounts, and the migration
version it was taken at. It does not hold the schema, because the migrations
are the schema, or the job state machine table, because the migrations supply
it and an old copy must never overwrite newer rules.

**It does not hold uploaded files.** Signatures, photos and proof of delivery
live in Supabase Storage; the database holds only their metadata. Download the
`boyds-documents` bucket separately, from the Supabase dashboard (Storage →
`boyds-documents`).

Supabase's own daily backups are a plan feature. Check what the project's plan
includes rather than assuming. Either way, take a backup with this script
before every migration and on a regular schedule.

The old advice here, `supabase db dump`, has been removed: it needs Docker and,
by default, dumps the schema rather than the data. A backup made that way would
have contained none of the business's records.

### Restoring

Into an **empty** project only:

```bash
SUPABASE_DB_URL='<new project>' ./scripts/deploy-database.sh --apply
SUPABASE_DB_URL='<new project>' ./scripts/restore-database.sh backups/boyds-backup-....sql
```

The restore refuses to run if the target already holds BOYD'S data, or if its
schema is older than the backup. It loads everything in one transaction, so a
failure keeps nothing. It pauses triggers during the load, as Supabase's own
documented restore does: otherwise the job state machine would refuse jobs
restored at `COMPLETED`, and the audit trail would record every restored row as
a new change. Then it runs the production verification.

**Rehearsed.** A populated Supabase-like database (1,579 rows across all 33
tables, 41 sign-in accounts) was backed up as the migrating role, and restored
into a fresh project deployed with the real CLI. The result:

- every table's row count identical
- every sign-in account present
- both sequences positioned exactly where they were, so new incident numbers
  do not collide with restored ones
- verification passing
- the restored database accepting new work from a signed-in partner, audited
  as a new change

## Still outstanding for production

- **A signed-in journey through the interface.** The browser suite covers the
  public site, route protection and the request form. Signing in needs Supabase
  Auth, so the full job lifecycle is tested at the database instead
  (`tests/integration/full-job-lifecycle.test.ts`, every step as the right
  person). Extend the browser suite once a project exists to test against.
- **Error alerting.** Server errors reach the host's runtime logs (Vercel keeps
  them), but nothing alerts anyone. Connect an alerting service (Sentry or
  similar) when there is an account for it.
