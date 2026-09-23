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

## Creating the first accounts

There is no public sign-up, and an auth account with no BOYD'S user row has no
role and no access. Accounts are created deliberately:

1. In Supabase → Authentication → Users, invite the partner's email address.
2. Then link it:

```sql
insert into users (auth_user_id, email, first_name, role, status)
values ('<auth uuid>', '<email>', 'Ronald', 'PARTNER', 'ACTIVE');

insert into partners (user_id, name, role_title, responsibilities)
select id, 'Ronald', 'Business & Operations Partner',
       array['business strategy', 'operations management', 'sales', 'pricing',
             'profitability', 'finance oversight', 'technology', 'growth']
from users where email = '<email>';
```

Moh gets both a `users` row with role `DRIVER` and a `drivers` row, plus a
`partners` row — he is a partner who drives, and the two records are independent.

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
