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

Runs formatting, linting, type checking, 446 unit and guard tests, 258 database
tests against real PostgreSQL, and a production build. The database tests do not
skip when no database is reachable — they fail with instructions, because a run
that quietly did not exercise the security boundary would report success while
proving nothing.

## Backups

Supabase takes daily backups on paid plans. On the free tier, take a manual dump
regularly:

```bash
supabase db dump -f boyds-backup-$(date +%F).sql
```

**Rehearse a restore before relying on it.** A backup nobody has restored is a
hope, not a backup.

## Still outstanding for production

- Error monitoring (Sentry or similar)
- A backup and restore rehearsal
- An accessibility audit
- A Playwright suite covering the job lifecycle through the interface — the
  database-level equivalent exists and passes
