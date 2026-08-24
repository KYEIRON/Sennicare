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
--     -v moh_email="'...'" \
--     -f supabase/seed.dev.sql
--
-- Phone numbers, licence numbers, licence states and expiry dates are left NULL
-- for the same reason. They are filled in from real documents, never assumed.
-- =============================================================================

\if :{?ronald_email}
\else
  \echo 'ERROR: supply -v ronald_email and -v moh_email. No email address will be invented.'
  \quit 1
\endif

begin;

-- --- Ronald: Business & Operations Partner (United Kingdom) -------------------

with new_user as (
  insert into users (email, first_name, role, status)
  values (:ronald_email, 'Ronald', 'PARTNER', 'INVITED')
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

with new_user as (
  insert into users (email, first_name, role, status)
  values (:moh_email, 'Moh', 'DRIVER', 'INVITED')
  on conflict (email) do update set first_name = excluded.first_name
  returning id
)
insert into partners (user_id, name, role_title, responsibilities)
select
  new_user.id,
  'Moh',
  'Field & Vehicle Operations Partner',
  array[
    'driving', 'vehicle operation', 'collections', 'deliveries',
    'mileage', 'fuel', 'vehicle checks', 'proof of delivery',
    'local customer interaction', 'field operations'
  ]
from new_user
on conflict (user_id) do nothing;

insert into drivers (user_id)
select u.id from users u where u.email = :moh_email
on conflict (user_id) do nothing;

commit;

\echo 'Seeded BOYD''S partners: Ronald and Moh.'
\echo 'Both users are INVITED. A partner activates them once their Supabase Auth'
\echo 'accounts exist and are linked via users.auth_user_id.'
