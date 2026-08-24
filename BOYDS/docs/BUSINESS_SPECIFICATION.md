# BOYD'S Logistics LLC — Business Specification

Source of truth: BOYD'S MASTER BUILD INSTRUCTION v1.0.
This document restates those requirements in the form the engineering work follows.

---

## 1. The company

|                |                        |
| -------------- | ---------------------- |
| Legal entity   | BOYD'S Logistics LLC   |
| Status         | Legally registered     |
| Country        | United States          |
| Initial market | North Carolina         |
| Fleet          | 1 vehicle — `BOYD-001` |
| Drivers        | 1 — Moh                |

### Partners

**Ronald** — Business & Operations Partner, based in the United Kingdom.
Strategy, operations, sales, customer acquisition, CRM, pricing, profitability,
finance oversight, website, SEO, technology, AI, automation, systems, growth.

**Moh** — Field & Vehicle Operations Partner, based in North Carolina.
Driving, vehicle operation, collections, deliveries, mileage, fuel, vehicle
checks, proof of delivery, local customer interaction, field operations.

They are **partners**, not employer and employee. Moh is not "staff"; Ronald is
not an "external administrator". The permission model gives each partner the
access their responsibilities require — it does not rank them.

Ronald manages the business remotely from the UK. That is a fact about a person,
not about the business. **The business geography is the United States.**

---

## 2. Locale (binding)

Currency USD · distance miles · fuel gallons · fuel price USD/gallon ·
time zone `America/New_York` · country United States · initial state
North Carolina.

North Carolina is **data, not code**. Service areas are rows in `service_areas`.
Planned expansion: South Carolina, Virginia, Tennessee, Georgia, the Southeast,
the United States.

---

## 3. Vision

One van → multiple vans → multiple drivers → recurring customers → contracts →
larger B2B operations → intelligent logistics.

The software must absorb the second vehicle and the second driver without a
rewrite. Nothing may assume a single vehicle, a single driver, or a single state.

---

## 4. Core principle

**Optimise for profitable work, not revenue.**

Primary metrics: revenue · total cost · contribution · contribution per job ·
contribution per mile · true cost per mile · loaded miles · empty miles · empty
mileage percentage · vehicle utilisation · quote conversion · customer retention ·
repeat business · contract value · outstanding invoices.

Revenue is never presented as profit. Costs are never hidden.

---

## 5. Services (initial)

General goods · distribution · supply · same-day delivery · urgent business
delivery · dedicated van delivery · medical courier · healthcare logistics ·
industrial parts delivery · scheduled business delivery.

Service types are database rows so more can be added without a deployment.

**No claim of medical certification, regulatory approval, specialist licence, or
compliance status may appear anywhere in the product or website unless it has been
actually verified.** This is a legal exposure, not a marketing preference.

---

## 6. System modules

| Code | Module                   | Phase                      |
| ---- | ------------------------ | -------------------------- |
| A    | Command Centre           | 7                          |
| B    | Job Management           | 3                          |
| C    | Dispatch                 | 3                          |
| D    | Moh Driver Application   | 4                          |
| E    | Customer Management      | 3                          |
| F    | CRM                      | 8                          |
| G    | Quoting                  | 8                          |
| H    | Expense Management       | 5                          |
| I    | Mileage                  | 5                          |
| J    | Fuel                     | 5                          |
| K    | Vehicle Management       | 3                          |
| L    | Profitability Engine     | 6                          |
| M    | Invoicing                | 9                          |
| N    | Contracts                | 9                          |
| O    | Maintenance              | 9                          |
| P    | Documents                | 5                          |
| Q    | Reporting                | 7 / 9                      |
| R    | BOYD'S AI (internal)     | 11                         |
| S    | Public Marketing Website | 10                         |
| T    | AI Receptionist          | 12                         |
| U    | 24/7 Job Request Intake  | 12                         |
| V    | Integration Layer        | 1 (interfaces) / 13 (live) |

---

## 7. Financial rules

```
revenue          = won_price
total_cost       = fuel + driver + tolls + parking + other + vehicle_allocation
contribution     = revenue - total_cost
contribution/mi  = contribution / total_job_miles
margin %         = contribution / revenue * 100
empty mileage %  = empty_miles / total_miles * 100
```

Division by zero is handled explicitly. Incomplete data yields
`DATA INCOMPLETE`, never a guess.

Every cost has a state: `ESTIMATED` · `ACTUAL` · `MISSING`. Estimates and actuals
are stored separately and both remain visible.

### Worked example (must hold in tests)

Revenue $300 · fuel $80 · driver $70 · tolls+parking $30 · vehicle allocation $40 ·
other $20 → total cost **$240**, contribution **$60**.
The system must never report $300 profit.

### Incomplete example (must hold in tests)

Revenue $300 · driver $70 · vehicle $40 · fuel **MISSING** → **DATA INCOMPLETE**.

---

## 8. True cost per mile

A configurable vehicle cost model. Candidate cost lines: fuel, insurance,
finance, depreciation, maintenance, repairs, tyres, registration, other operating
costs.

```
true_cost_per_mile = included vehicle costs / total vehicle miles
```

Partners configure which lines are included. **No invented industry assumptions.**
If a cost line has no real recorded value, it is excluded and the result is
labelled as covering only the lines that had data.

---

## 9. Empty miles

Loaded miles, empty miles, total miles, empty mileage percentage. A strategic
BOYD'S metric — the system must eventually surface opportunities to reduce it
(see the return-load engine, Phase 14).

---

## 10. AI rules

BOYD'S AI has two roles: a public **receptionist / sales and job intake
assistant**, and an internal **business intelligence assistant**.

The AI must never invent prices, vehicle availability, driver availability, ETAs,
certifications, insurance, compliance, job confirmations, payment status, or
customer information.

Every AI answer is tagged: `FACT` · `ESTIMATE` · `RECOMMENDATION` ·
`DATA INCOMPLETE`.

### The 2 AM scenario (binding acceptance criterion)

A customer arrives at the website at 02:00 America/New_York. Both partners are
asleep. The AI must: answer, understand the request, collect customer /
collection / delivery / shipment information, determine urgency, create a
structured job request, mark it `AFTER_HOURS`, notify BOYD'S, and determine
whether live pricing and live availability exist.

If vehicle, driver, and pricing cannot be verified, the AI **does not confirm the
job**. It says:

> "Your request has been received and will be reviewed by the BOYD'S team."

Automatic acceptance is **prohibited** until the real availability, location, and
pricing integrations exist and are trusted.

---

## 11. Open business decisions — confirmed NOT CONFIGURED

Ronald confirmed on 2026-08-24 that all of these remain **NOT CONFIGURED** until
the partners decide. The system stores no value and displays `NOT CONFIGURED`,
naming the decision required. It does not fall back to an invented default —
see docs/DECISIONS.md D-010.

| #   | Decision                                    | Status                                      |
| --- | ------------------------------------------- | ------------------------------------------- |
| 1   | Minimum acceptable contribution per job     | **NOT CONFIGURED**                          |
| 2   | Target contribution margin                  | **NOT CONFIGURED**                          |
| 3   | Driver labour cost basis (economic costing) | **NOT CONFIGURED**                          |
| 4   | Vehicle cost allocation basis               | **NOT CONFIGURED**                          |
| 5   | Exact service area radius and counties      | **Configurable — North Carolina initially** |
| 6   | Medical courier limitations                 | **NOT CONFIGURED**                          |
| 7   | Payment terms and quote validity            | **NOT CONFIGURED**                          |
| 8   | Automatic acceptance thresholds             | **DISABLED**                                |

Notes on specific items:

**5. Service area.** North Carolina is the initial market. The detailed radius,
counties and metros stay configurable in `service_areas`. Nothing about North
Carolina is hardcoded, so setting the detail later — or adding another state —
costs a database row.

**6. Medical courier.** No limits configured beyond the standing rule that **no
unsupported certification or compliance claim may be made anywhere** in the
product or on the website. That rule is not a placeholder awaiting a decision; it
is permanent, and it applies regardless of what limits are eventually set.

**8. Automatic acceptance.** DISABLED. `company_settings.auto_acceptance_enabled`
defaults to `false` at the database level, and the AI decision path refuses to
run when any required input is unavailable. See docs/DECISIONS.md D-009.

---

## 12. Operational profitability vs partner compensation

Confirmed by Ronald on 2026-08-24 as a standing requirement:

> Keep operational profitability separate from partner compensation and
> accounting treatment.

The system must be able to calculate the **economic cost of driver labour** for
management profitability analysis **without assuming how Moh is legally
compensated as a partner**. These are two different questions — one is
management accounting, the other is legal and tax treatment — and the software
keeps them in separate types, with the profitability engine having access only to
the first.

Correspondingly, for vehicle economics the system tracks the **underlying costs**
separately and **derives** true cost per mile from them and from real recorded
mileage. There is no permanent manually entered flat rate.

See docs/FINANCIAL_ENGINE.md sections 5 and 6, and docs/DECISIONS.md D-011 and
D-012.
