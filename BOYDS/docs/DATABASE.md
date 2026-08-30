# BOYD'S — Database Plan

PostgreSQL (Supabase). All tables live in the `public` schema with Row Level
Security **enabled on every table without exception**.

---

## Conventions

| Rule                                                  | Reason                            |
| ----------------------------------------------------- | --------------------------------- |
| Primary keys are `uuid` (`gen_random_uuid()`)         | No enumerable IDs in URLs         |
| Money is `bigint` **cents**                           | Floats lose money                 |
| Distance is `integer` **tenths of a mile**            | Same reason                       |
| Fuel volume is `integer` **thousandths of a gallon**  | Same reason                       |
| Timestamps are `timestamptz`, stored UTC              | Displayed in `America/New_York`   |
| Enumerations are Postgres `enum` types                | Illegal states unrepresentable    |
| Every table has `created_at`, `updated_at`            | `updated_at` set by trigger       |
| Deletions are soft (`deleted_at`) on business records | Audit and recovery                |
| No `ON DELETE CASCADE` on financial records           | Never silently destroy money data |

Cost columns come in **pairs plus a state**:

```
fuel_cost_estimated_cents  bigint
fuel_cost_actual_cents     bigint
fuel_cost_state            cost_state   -- ESTIMATED | ACTUAL | MISSING
```

`cost_state` is derived by trigger, not by application code, so it cannot drift.

---

## Enum types

```sql
user_role        PARTNER | DRIVER | ADMIN
user_status      ACTIVE | INVITED | SUSPENDED | INACTIVE
vehicle_status   AVAILABLE | ON_JOB | MAINTENANCE | OUT_OF_SERVICE
fuel_type        GASOLINE | DIESEL | HYBRID | ELECTRIC
customer_type    PROSPECT | ACTIVE | INACTIVE | CONTRACT
customer_status  ACTIVE | INACTIVE | ON_HOLD | LOST
lead_stage       NEW | QUALIFIED | CONTACTED | CONVERSATION | QUOTE_REQUESTED
                 | QUOTE_SENT | FOLLOW_UP | WON | FIRST_JOB | REPEAT_CUSTOMER
                 | CONTRACT_OPPORTUNITY | LOST
job_status       DRAFT | QUOTE_REQUESTED | QUOTED | ACCEPTED | SCHEDULED
                 | ASSIGNED | DRIVER_ACCEPTED | EN_ROUTE_TO_COLLECTION
                 | AT_COLLECTION | COLLECTED | IN_TRANSIT | AT_DELIVERY
                 | DELIVERED | POD_RECEIVED | COMPLETED | INVOICED | PAID
                 | CANCELLED
job_priority     STANDARD | SCHEDULED | SAME_DAY | URGENT | CRITICAL
stop_type        COLLECTION | DELIVERY | INTERMEDIATE
cost_state       ESTIMATED | ACTUAL | MISSING
expense_category FUEL | TOLL | PARKING | DRIVER | MAINTENANCE | SUPPLIES | OTHER
mileage_type     LOADED | EMPTY | PERSONAL_EXCLUDED
quote_status     DRAFT | SENT | VIEWED | ACCEPTED | DECLINED | EXPIRED | WITHDRAWN
invoice_status   DRAFT | SENT | DUE | OVERDUE | PAID | CANCELLED
contract_status  DRAFT | ACTIVE | PAUSED | ENDED | CANCELLED
maintenance_type SERVICE | OIL | TYRES | REPAIR | INSPECTION | REGISTRATION
                 | INSURANCE | OTHER
document_type    POD | RECEIPT | CONTRACT | QUOTE | INVOICE | VEHICLE
                 | INSURANCE | MAINTENANCE | COMPLIANCE | CUSTOMER | OTHER
request_source   WEBSITE | AI_RECEPTIONIST | PHONE | EMAIL | PARTNER | CUSTOMER_PORTAL
ai_confidence    FACT | ESTIMATE | RECOMMENDATION | DATA_INCOMPLETE
```

---

## Tables

### Identity and people

**`users`** — `id`, `auth_user_id` (→ `auth.users`), `email`, `first_name`,
`last_name`, `phone`, `role`, `status`, `created_at`, `updated_at`,
`last_login_at`.

**`partners`** — `id`, `user_id`, `name`, `role_title`, `responsibilities` (text[]),
`active`, timestamps. Seeded with Ronald and Moh — **no invented personal data**.

**`drivers`** — `id`, `user_id`, `license_number`, `license_state`,
`license_expiry`, `phone`, `active`, `default_vehicle_id`, timestamps. Moh has
both a `partners` row and a `drivers` row; the two are independent. License
fields stay null until supplied.

### Fleet

**`vehicles`** — `id`, `vehicle_code` (unique, `BOYD-001`), `make`, `model`,
`year`, `vin`, `license_plate`, `license_state`, `fuel_type`,
`fuel_economy_mpg_tenths`, `current_odometer_tenths`, `purchase_price_cents`,
`finance_cost_monthly_cents`, `insurance_cost_monthly_cents`,
`registration_cost_annual_cents`, `status`, `current_driver_id`, `active`,
timestamps. **All unknown real-world values start null.**

**`vehicle_cost_model`** — the configurable true-cost-per-mile model.
`id`, `vehicle_id`, `cost_line` (fuel/insurance/finance/depreciation/maintenance/
repairs/tyres/registration/other), `included_in_cpm` (bool), `period`
(MONTHLY | ANNUAL | PER_MILE), `amount_cents`, `effective_from`, `effective_to`,
`notes`. Partners choose which lines count. Nothing is assumed.

**`maintenance_records`** — `id`, `vehicle_id`, `maintenance_type`, `description`,
`due_date`, `due_odometer_tenths`, `completed_date`, `completed_odometer_tenths`,
`cost_cents`, `vendor`, `notes`, timestamps.

### Commercial

**`customers`** — `id`, `company_name`, `contact_name`, `email`, `phone`,
`address_line1`, `address_line2`, `city`, `state`, `zip`, `industry`,
`customer_type`, `customer_status`, `lead_source`, `payment_terms_days`, `notes`,
timestamps, `deleted_at`.

**`leads`** — `id`, `customer_id` (nullable until converted), `company_name`,
`contact_name`, `email`, `phone`, `stage`, `source` (`request_source`),
`service_interest`, `estimated_value_cents`, `next_followup_at`, `owner_user_id`,
`is_recurring_opportunity`, `notes`, timestamps.

**`quotes`** — `id`, `quote_number` (unique), `customer_id`, `lead_id`,
`service_type_id`, `collection_summary`, `delivery_summary`, `requested_date`,
`requested_time`, `estimated_miles_tenths`, `estimated_cost_cents`,
`recommended_price_cents`, `quoted_price_cents`, `expected_contribution_cents`,
`expected_contribution_per_mile_cents`, `pricing_breakdown` (jsonb — the full
transparent calculation), `terms`, `valid_until`, `status`, `sent_at`,
`responded_at`, timestamps.

**`quote_items`** — `id`, `quote_id`, `sequence`, `description`, `quantity`,
`unit_price_cents`, `total_cents`.

**`contracts`** — `id`, `contract_number`, `customer_id`, `title`, `status`,
`start_date`, `end_date`, `frequency`, `routes` (jsonb), `agreed_rate_cents`,
`rate_basis`, `minimum_volume`, `terms`, `notes`, timestamps.

### Operations

**`service_types`** — `id`, `code`, `name`, `description`, `active`,
`sort_order`. Seeded with the ten initial services. Adding one is a row.

**`service_areas`** — `id`, `name`, `country` (default `US`), `state`, `metro`,
`counties` (text[]), `zip_prefixes` (text[]), `active`, `sort_order`.
North Carolina is a row here — **never a constant**.

**`jobs`** — the centre of the system.

```
id, job_number (unique), customer_id, contract_id, quote_id,
service_type_id, priority, status,
requested_at, scheduled_at, started_at, completed_at,
vehicle_id, driver_id, assigned_at, driver_accepted_at,

quoted_price_cents, won_price_cents,

estimated_miles_tenths, actual_miles_tenths,
loaded_miles_tenths, empty_miles_tenths,

fuel_cost_estimated_cents,    fuel_cost_actual_cents,    fuel_cost_state,
driver_cost_estimated_cents,  driver_cost_actual_cents,  driver_cost_state,
toll_cost_estimated_cents,    toll_cost_actual_cents,    toll_cost_state,
parking_cost_estimated_cents, parking_cost_actual_cents, parking_cost_state,
other_cost_estimated_cents,   other_cost_actual_cents,   other_cost_state,
vehicle_allocation_estimated_cents, vehicle_allocation_actual_cents,
vehicle_allocation_state,

source (request_source), is_after_hours, requires_review, review_reason,
notes, internal_notes,
created_by, created_at, updated_at, cancelled_at, cancellation_reason
```

Contribution figures are **not stored**. They are derived by the finance service
from the columns above, so a stored total can never disagree with its inputs.
A read-only view `job_profitability` exposes the derived figures for reporting,
computed by the same SQL rules the TypeScript engine implements — and a test
asserts the two agree.

**`job_stops`** — `id`, `job_id`, `sequence`, `stop_type`, `address_line1`,
`address_line2`, `city`, `state`, `zip`, `latitude`, `longitude`, `contact_name`,
`contact_phone`, `scheduled_time`, `actual_arrival`, `actual_departure`,
`notes`, timestamps. Unique `(job_id, sequence)`.

**`job_expenses`** — `id`, `job_id`, `vehicle_id`, `driver_id`,
`expense_category`, `description`, `amount_cents`, `incurred_at`,
`receipt_document_id`, `recorded_by`, `notes`, timestamps.

**`mileage_logs`** — `id`, `job_id` (nullable — not all miles belong to a job),
`vehicle_id`, `driver_id`, `mileage_type`, `start_odometer_tenths`,
`end_odometer_tenths`, `miles_tenths` (generated), `logged_at`, `notes`,
timestamps.

**`fuel_transactions`** — `id`, `vehicle_id`, `driver_id`, `job_id` (nullable),
`gallons_thousandths`, `price_per_gallon_cents`, `total_cost_cents`,
`odometer_tenths`, `station`, `purchased_at`, `receipt_document_id`, timestamps.

### Money

**`invoices`** — `id`, `invoice_number` (unique), `customer_id`, `contract_id`,
`status`, `issue_date`, `due_date`, `subtotal_cents`, `tax_cents`,
`total_cents`, `amount_paid_cents`, `sent_at`, `paid_at`, `notes`, timestamps.

**`invoice_lines`** — `id`, `invoice_id`, `job_id`, `sequence`, `description`,
`quantity`, `unit_price_cents`, `total_cents`.

**`payments`** — `id`, `invoice_id`, `amount_cents`, `received_at`, `method`,
`reference`, `recorded_by`, `notes`, timestamps.
An invoice is `PAID` only when payment rows actually cover the total. **No
invoice may be marked paid without a payment record.**

**`pricing_rules`** — `id`, `name`, `service_type_id` (nullable = all),
`priority_level` (nullable = all), `base_price_cents`, `per_mile_cents`,
`minimum_price_cents`, `urgency_multiplier_bps`, `target_margin_bps`,
`minimum_contribution_cents`, `minimum_contribution_per_mile_cents`,
`empty_mile_risk_factor_bps`, `active`, `effective_from`, `effective_to`,
`notes`, timestamps. Basis points (`bps`) keep percentages as integers.

### Supporting

**`documents`** — `id`, `document_type`, `entity_table`, `entity_id`,
`storage_path` (private bucket), `file_name`, `mime_type`, `size_bytes`,
`uploaded_by`, `captured_at`, `notes`, timestamps.

**`incidents`** — `id`, `incident_number` (`BI-YYYY-NNNN`, from a sequence),
`incident_type`, `severity` (MINOR | SERIOUS | CRITICAL), `status` (REPORTED |
UNDER_REVIEW | RESOLVED | CLOSED), `job_id` (nullable — an incident can happen
between jobs), `vehicle_id`, `driver_id`, `occurred_at`, `location_description`
(typed by the driver; BOYD'S has no GPS), `description`, `anyone_injured`,
`police_involved`, `police_report_number`, `third_party_involved`,
`third_party_details`, `goods_affected`, `cost_cents` (**null until
established, never zero**), `reported_by`, `reviewed_by`, `reviewed_at`,
`resolution_notes`, `provenance`, timestamps.

Constraints refuse a report that contradicts itself: a police report number with
no police, other-party details with no other party, a blank account of events, a
negative cost, or a resolution with no explanation. A driver may insert and read
his own; he has no update or delete policy, and an immutability trigger sits
behind that.

**`notifications`** — `id`, `recipient_user_id`, `notification_type`, `title`,
`body`, `entity_table`, `entity_id`, `severity`, `read_at`, `delivered_channels`
(text[]), `created_at`.

**`ai_conversations`** — `id`, `surface` (PUBLIC | INTERNAL), `user_id`
(nullable for anonymous), `lead_id`, `job_id`, `session_token`, `started_at`,
`ended_at`, `is_after_hours`, `metadata` (jsonb).

**`ai_messages`** — `id`, `conversation_id`, `sequence`, `role`, `content`,
`tool_calls` (jsonb), `confidence` (`ai_confidence`), `created_at`.

**`ai_insights`** — `id`, `insight_type`, `title`, `body`, `confidence`,
`entity_table`, `entity_id`, `data_snapshot` (jsonb), `acknowledged_by`,
`acknowledged_at`, `created_at`.

**`audit_logs`** — `id`, `user_id`, `action`, `entity_table`, `entity_id`,
`old_value` (jsonb), `new_value` (jsonb), `ip_address`, `user_agent`,
`created_at`. Written by database trigger on `jobs`, `quotes`, `invoices`,
`job_expenses`, `customers`, `contracts`, `vehicles`, `pricing_rules` — so a
change cannot escape the log by taking a different code path. **Append-only: no
role holds UPDATE or DELETE on this table.**

**`company_settings`** — `id` (singleton), `company_name`, `legal_name`,
`base_address_*`, `timezone` (`America/New_York`), `currency` (`USD`),
`distance_unit` (`MILES`), `volume_unit` (`GALLONS`), `default_payment_terms_days`,
`minimum_contribution_cents`, `minimum_contribution_per_mile_cents`,
`target_margin_bps`, `after_hours_start`, `after_hours_end`,
`auto_acceptance_enabled` (**hard default `false`**), timestamps.

---

## Row Level Security

Enabled on every table. Policies are written against helper functions
`current_app_user()`, `is_partner()`, `is_driver()`.

| Table group                                                            | PARTNER / ADMIN | DRIVER                                                                    | anon (public site)                  |
| ---------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------- | ----------------------------------- |
| jobs                                                                   | full            | select rows where `driver_id = me`; update only status/timestamps via RPC | none                                |
| job_stops                                                              | full            | select/update stops of own jobs                                           | none                                |
| job_expenses, mileage_logs, fuel_transactions                          | full            | insert + select own rows                                                  | none                                |
| customers, leads, quotes, contracts, invoices, payments, pricing_rules | full            | **none**                                                                  | none                                |
| vehicles                                                               | full            | select own assigned vehicle (operational columns only)                    | none                                |
| documents                                                              | full            | own job documents only                                                    | none                                |
| service_types, service_areas                                           | full            | select                                                                    | **select active rows only**         |
| audit_logs                                                             | select          | none                                                                      | none                                |
| ai_*                                                                   | full            | none                                                                      | insert own public conversation only |

**The financial columns on `jobs` are not exposed to the driver role.** Drivers
read jobs through the view `driver_jobs`, which omits every price and cost
column. RLS on the base table blocks the direct path; the view is the only route
the driver application uses.

Public job-request creation goes through a `SECURITY DEFINER` function
`create_public_job_request(...)` rather than a table grant, so an anonymous
visitor can create exactly one shape of row and can read nothing back.

---

## Job status state machine

Transitions are validated **server-side and in the database**. An arbitrary
status update is rejected.

```
DRAFT ──────────────► QUOTE_REQUESTED ──► QUOTED ──► ACCEPTED
  │                                                     │
  └──────────────────────────────────────────────► SCHEDULED
                                                        │
                                                    ASSIGNED
                                                        │
                                                 DRIVER_ACCEPTED
                                                        │
                                            EN_ROUTE_TO_COLLECTION
                                                        │
                                                  AT_COLLECTION
                                                        │
                                                    COLLECTED
                                                        │
                                                   IN_TRANSIT
                                                        │
                                                   AT_DELIVERY
                                                        │
                                                    DELIVERED
                                                        │
                                                  POD_RECEIVED
                                                        │
                                                   COMPLETED
                                                        │
                                                    INVOICED
                                                        │
                                                      PAID
```

`CANCELLED` is reachable from any state before `COMPLETED`, and requires a reason.
The allowed-transition map lives in `src/services/jobs/state-machine.ts` and is
mirrored by a Postgres trigger. A test asserts the two definitions are identical —
one source of truth, two enforcement points.

Guards on specific transitions:

- `ASSIGNED` requires a vehicle **and** a driver.
- `DRIVER_ACCEPTED` may only be set by the assigned driver.
- `POD_RECEIVED` requires at least one `POD` document on the job.
- `COMPLETED` requires actual mileage recorded.
- `INVOICED` requires an invoice line referencing the job.
- `PAID` requires payment rows covering the invoice total.

---

## Migrations

Plain SQL under `supabase/migrations/`, ordered and immutable once applied.

```
0001_extensions_and_enums.sql
0002_identity.sql              users, partners, drivers
0003_fleet.sql                 vehicles, vehicle_cost_model, maintenance_records
0004_commercial.sql            customers, leads, service_types, service_areas
0005_jobs.sql                  jobs, job_stops, job_expenses
0006_operations.sql            mileage_logs, fuel_transactions
0007_quotes_pricing.sql        quotes, quote_items, pricing_rules
0008_money.sql                 invoices, invoice_lines, payments, contracts
0009_supporting.sql            documents, notifications, ai_*, company_settings
0010_audit.sql                 audit_logs + triggers
0011_views.sql                 job_profitability, driver_jobs
0012_rls.sql                   RLS policies for every table
0013_state_machine.sql         job status transition trigger
0014_seed_reference.sql        service_types, service_areas (reference data only)
```

Development-only seed data (Ronald, Moh, BOYD-001, sample jobs) lives in
`supabase/seed.dev.sql` and is **never** applied to production.
