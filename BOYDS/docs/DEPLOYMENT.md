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

```bash
supabase link --project-ref <ref>
supabase db push
```

Then create the private storage bucket:

```sql
insert into storage.buckets (id, name, public)
values ('boyds-documents', 'boyds-documents', false);
```

**Public must be false.** Proof of delivery, receipts and signatures are
customer records. The application issues short-lived signed URLs after checking
the caller is entitled to see the file.

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
