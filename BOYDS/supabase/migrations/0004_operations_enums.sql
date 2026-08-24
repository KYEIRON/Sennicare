-- =============================================================================
-- BOYD'S Logistics LLC — 0004 operational enumerated types
--
-- NOTE ON THE JOB LIFECYCLE
-- The lifecycle below follows the Phase 3 instruction (2026-08-24), which
-- supersedes the earlier list in docs/DATABASE.md. The differences are
-- deliberate and recorded in docs/DECISIONS.md D-019:
--   DRAFT / QUOTE_REQUESTED / ACCEPTED      ->  REQUESTED / REVIEW / APPROVED
--   EN_ROUTE_TO_COLLECTION / AT_COLLECTION  ->  EN_ROUTE_TO_PICKUP / AT_PICKUP
--   COLLECTED                                ->  PICKED_UP
--   new exception states                     ->  DECLINED, FAILED, ON_HOLD
--   INVOICED / PAID deferred to Phase 9
-- =============================================================================

-- --- Customers ---------------------------------------------------------------

create type customer_type as enum ('BUSINESS', 'INDIVIDUAL', 'GOVERNMENT', 'OTHER');

create type customer_status as enum ('PROSPECT', 'ACTIVE', 'INACTIVE', 'ON_HOLD', 'LOST');

create type contact_role as enum ('PRIMARY', 'BILLING', 'OPERATIONS', 'SITE', 'OTHER');

create type location_kind as enum ('BILLING', 'SERVICE', 'PICKUP', 'DELIVERY', 'OTHER');

-- --- Fleet -------------------------------------------------------------------

create type vehicle_status as enum (
  'AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE', 'INACTIVE'
);

create type vehicle_type as enum (
  'CARGO_VAN', 'BOX_TRUCK', 'SPRINTER_VAN', 'PICKUP', 'CAR', 'OTHER'
);

create type driver_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');

create type driver_availability as enum ('AVAILABLE', 'ON_JOB', 'OFF_DUTY', 'UNAVAILABLE');

-- --- Jobs --------------------------------------------------------------------

create type job_status as enum (
  -- Intake and commercial
  'REQUESTED',
  'REVIEW',
  'QUOTED',
  'APPROVED',
  -- Planning
  'SCHEDULED',
  'ASSIGNED',
  'DRIVER_ACCEPTED',
  -- Field execution
  'EN_ROUTE_TO_PICKUP',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DELIVERY',
  'DELIVERED',
  -- Closing
  'POD_RECEIVED',
  'COMPLETED',
  -- Exceptions
  'ON_HOLD',
  'CANCELLED',
  'DECLINED',
  'FAILED'
);

create type job_priority as enum ('STANDARD', 'SCHEDULED', 'SAME_DAY', 'URGENT', 'CRITICAL');

create type stop_type as enum ('PICKUP', 'DELIVERY', 'INTERMEDIATE');

create type stop_status as enum ('PENDING', 'EN_ROUTE', 'ARRIVED', 'COMPLETED', 'SKIPPED', 'FAILED');

-- --- Money and measurement ---------------------------------------------------

-- Every cost carries this. Derived by trigger from the estimated and actual
-- columns, so the flag can never disagree with the data it describes.
create type cost_state as enum ('ESTIMATED', 'ACTUAL', 'MISSING');

create type mileage_type as enum ('LOADED', 'EMPTY', 'PERSONAL_EXCLUDED');

-- --- Intake ------------------------------------------------------------------

create type request_status as enum (
  'NEW', 'UNDER_REVIEW', 'QUOTED', 'APPROVED', 'DECLINED', 'CONVERTED', 'EXPIRED'
);

create type request_source as enum (
  'WEBSITE', 'AI_RECEPTIONIST', 'PHONE', 'EMAIL', 'PARTNER', 'CUSTOMER_PORTAL'
);

-- --- Provenance --------------------------------------------------------------

-- Mirrors src/lib/provenance.ts. Illustrative interface data is marked in the
-- database itself, so it cannot be mistaken for real BOYD'S operational data
-- no matter which code path reads it. See docs/DECISIONS.md D-014.
create type data_provenance as enum ('REAL', 'DEMO');
