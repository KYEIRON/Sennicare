-- =============================================================================
-- BOYD'S — DEVELOPMENT SEED. Never applied to production.
--
-- Seeds the two BOYD'S partners: Ronald and Moh.
--
-- NO PERSONAL INFORMATION IS INVENTED HERE. Names and responsibilities come from
-- the BOYD'S master build instruction. Email addresses are NOT guessed — they
-- must be supplied when this script is run, because they are real-world facts
-- BOYD'S owns and the software does not get to make up:
--
--   psql -d boyds_dev \
--     -v ronald_email="'...'" \
--     [-v moh_email="'...'"] \
--     -f supabase/seed.dev.sql
--
-- Moh's email is optional. Without it, Moh is recorded exactly as production
-- records him until his real address is known: on the team, with his partner
-- and driver records, waiting for an email — never a placeholder address.
--
-- Phone numbers, licence numbers, licence states and expiry dates are left NULL
-- for the same reason. They are filled in from real documents, never assumed.
-- =============================================================================

\if :{?ronald_email}
\else
  \echo 'ERROR: supply -v ronald_email. No email address will be invented.'
  \quit 1
\endif

\if :{?moh_email}
\else
  \set moh_email NULL
\endif

begin;

-- --- Ronald: Business & Operations Partner (United Kingdom) -------------------

with new_user as (
  insert into users (organisation_id, email, first_name, role, status)
  values ((select id from organisations where slug = 'boyds'), :ronald_email, 'Ronald', 'ADMIN', 'INVITED')
  on conflict (email) do update set first_name = excluded.first_name
  returning id
)
insert into partners (user_id, name, role_title, responsibilities)
select
  new_user.id,
  'Ronald',
  'Business & Operations Partner',
  array[
    'business strategy', 'operations management', 'sales',
    'customer acquisition', 'CRM', 'pricing', 'profitability',
    'finance oversight', 'website', 'SEO', 'technology', 'AI',
    'automation', 'systems', 'growth'
  ]
from new_user
on conflict (user_id) do nothing;

-- --- Moh: Field & Vehicle Operations Partner (North Carolina) -----------------
-- Moh holds BOTH a partner record and a driver record. He is a partner who
-- drives, not an employee. The two records are independent by design.

with moh as (
  insert into users (organisation_id, email, first_name, role, status)
  select (select id from organisations where slug = 'boyds'), :moh_email, 'Moh', 'DRIVER', 'INVITED'
  where not exists (select 1 from users where first_name = 'Moh' and role = 'DRIVER')
  returning id
),
moh_partner as (
  insert into partners (user_id, name, role_title, responsibilities)
  select
    moh.id,
    'Moh',
    'Field & Vehicle Operations Partner',
    array[
      'driving', 'vehicle operation', 'collections', 'deliveries',
      'mileage', 'fuel', 'vehicle checks', 'proof of delivery',
      'local customer interaction', 'field operations'
    ]
  from moh
  returning user_id
)
insert into drivers (user_id)
select id from moh;

commit;

\echo 'Seeded BOYD''S partners: Ronald and Moh.'
\echo 'Both are INVITED. Ronald is the ADMIN; he manages everyone else from the'
\echo 'Team screen once his sign-in account is linked. Moh waits for an email if'
\echo 'none was supplied.'
