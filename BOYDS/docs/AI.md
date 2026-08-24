# BOYD'S AI

Two surfaces, one provider abstraction, one tool-based data layer.

## Provider abstraction

`src/ai/provider.ts` defines the interface BOYD'S uses. Adapters implement it.
No feature code names a vendor, so BOYD'S is never architecturally dependent on
one AI provider. With no API key configured, the `unavailable` adapter is
selected and the AI surfaces render an explicit unavailable state — the rest of
the system is unaffected.

## Data access — tools, never SQL

The AI has no database access. It calls registered server-side tools. Each tool
declares a Zod input schema and a minimum role, runs an authorised repository
call, and returns permission-filtered data.

**Public registry** (`publicTools`) — anonymous callers:
`get_services`, `get_service_areas`, `create_lead`, `create_job_request`,
`get_faq`.

**Internal registry** (`internalTools`) — authenticated partners:
`get_jobs`, `get_job_profitability`, `get_customer`, `get_customer_profitability`,
`get_vehicle_status`, `get_open_quotes`, `get_followups`, `get_mileage_report`,
`get_expense_report`, `get_invoice_report`.

The public receptionist is constructed with `publicTools` only. Internal tools
are not merely denied to it — they are absent from its registry, so there is no
prompt that reaches them.

## Response tagging

Every AI statement carries one of:

| Tag | Meaning |
|---|---|
| `FACT` | Read directly from BOYD'S data |
| `ESTIMATE` | Derived, with stated assumptions |
| `RECOMMENDATION` | A suggested action, clearly the AI's opinion |
| `DATA INCOMPLETE` | The data needed does not exist yet |

Example:

> **FACT:** BOYD'S completed 24 jobs this month.
> **ESTIMATE:** Contribution is approximately $3,400 because three jobs are
> missing actual fuel costs.
> **RECOMMENDATION:** Complete the missing cost records before using the monthly
> contribution figure for decision-making.

## The receptionist

Opening line:

> "Hi, I'm BOYD'S AI. I can help you request a delivery, get a quote, learn about
> our services, or connect with our team. How can I help?"

It is a **sales and job intake assistant**, not an FAQ bot. It answers, qualifies,
collects, creates a lead, creates a quote request, creates a job request, flags
urgency, flags recurring business, and escalates.

### Intake fields

Company · contact name · phone · email · collection address · delivery address ·
collection date · collection time · delivery date · delivery time · description ·
weight · dimensions · pieces · pallets · special handling · urgency · service
requested · recurring requirement · notes.

Missing fields are recorded as missing. The AI does not fill a gap with a
plausible value.

### Recurring business

Where appropriate: *"Is this a one-time delivery or something you need
regularly?"* If recurring, it collects frequency, routes, shipment type,
preferred days, preferred times, and estimated volume, and raises a
`CONTRACT_OPPORTUNITY`.

## Hard prohibitions

The AI must never invent prices, vehicle availability, driver availability, ETAs,
certifications, insurance, compliance status, job confirmation, payment status,
or customer information. When it lacks data it says so, collects the request, and
creates a review task.

## The 2 AM scenario

02:00 America/New_York, both partners asleep. The AI must:

1. Answer.
2. Understand the request.
3. Collect customer information.
4. Collect collection information.
5. Collect delivery information.
6. Collect shipment information.
7. Determine urgency.
8. Create a structured job request.
9. Mark it `AFTER_HOURS`.
10. Notify BOYD'S.
11. Determine whether live pricing exists.
12. Determine whether live availability exists.

Vehicle, driver, and pricing unverifiable → **no confirmation**:

> "Your request has been received and will be reviewed by the BOYD'S team."

This is an automated Playwright test, not an aspiration.

## Automatic acceptance — not yet

Eventually the AI may weigh vehicle and driver availability, current location,
existing jobs, mileage, fuel, driver cost, vehicle cost, tolls, expected
contribution, contribution per mile, minimum contribution, service area, special
requirements, customer value, and return-load opportunities, then `ACCEPT`,
`REVIEW`, or `DECLINE`.

Until the real integrations exist and are trusted, this is prohibited.
`company_settings.auto_acceptance_enabled` defaults to `false`, and the decision
path refuses to run when any required input is unavailable.

## Internal assistant

Ronald asks in plain English: how did we perform this week · which jobs made the
most money · which jobs lost money · what is our contribution per mile · which
customers are most profitable · which quotes need follow-up · where are we
accumulating empty miles · what are our biggest costs · what should I
investigate.

Every answer is grounded in BOYD'S data via tools, and tagged.
