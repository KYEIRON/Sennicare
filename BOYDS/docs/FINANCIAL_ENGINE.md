# BOYD'S — Financial Engine

The single place where BOYD'S money maths lives: `src/services/finance/`.
No other file in the codebase may compute a cost, a contribution, or a margin.

---

## 1. Representation

| Quantity    | Stored as                       | TypeScript                       |
| ----------- | ------------------------------- | -------------------------------- |
| Money       | integer cents                   | `Cents` (branded `number`)       |
| Distance    | integer tenths of a mile        | `MilesTenths` (branded `number`) |
| Fuel volume | integer thousandths of a gallon | `GallonsThousandths`             |
| Percentage  | basis points (1% = 100 bps)     | `Bps` (branded `number`)         |

Floating point never touches a stored value. Rounding happens once, at the point
of display, in `src/lib/format.ts`, using `Intl.NumberFormat('en-US', …)`.

---

## 2. The `Calculation<T>` result

Every function in the engine returns:

```ts
type Calculation<T> =
  | { status: 'OK'; value: T }
  | { status: 'DATA_INCOMPLETE'; missing: string[]; partial?: T }
  | { status: 'NOT_CALCULABLE'; reason: string };
```

- `OK` — every required input was present and actual (or explicitly accepted as
  an estimate by the caller).
- `DATA_INCOMPLETE` — at least one required cost is `MISSING`. `missing` names
  the fields so the UI can tell Ronald exactly what to go and record. A `partial`
  figure may be attached, but it is **always** rendered with a
  `DATA INCOMPLETE` badge — never as a bare number.
- `NOT_CALCULABLE` — the maths cannot be performed (zero miles, zero revenue).
  Never `NaN`, never `Infinity`, never a silent `0`.

The type forces every caller to handle all three. This is the mechanism that
makes "do not guess" structural rather than a matter of discipline.

---

## 3. Formulas

```
revenue              = won_price_cents

total_cost           = fuel + driver + tolls + parking + other
                       + vehicle_allocation

contribution         = revenue - total_cost

contribution_per_mile = contribution / total_job_miles
                        NOT_CALCULABLE when total_job_miles = 0

contribution_margin  = contribution / revenue * 100
                        NOT_CALCULABLE when revenue = 0

empty_mileage_pct    = empty_miles / total_miles * 100
                        NOT_CALCULABLE when total_miles = 0

true_cost_per_mile   = sum(included vehicle cost lines) / total_vehicle_miles
                        NOT_CALCULABLE when total_vehicle_miles = 0
```

**Contribution is negative when a job lost money.** It is displayed as a negative
figure in red. It is never floored at zero, never hidden, never rounded toward a
friendlier number.

---

## 4. Estimated vs actual

Each cost carries `estimated`, `actual`, and a derived `state`:

| actual  | estimated | state       |
| ------- | --------- | ----------- |
| present | any       | `ACTUAL`    |
| null    | present   | `ESTIMATED` |
| null    | null      | `MISSING`   |

The engine takes a `basis` argument:

- `basis: 'ACTUAL'` — uses actuals only. Any `ESTIMATED` or `MISSING` cost
  produces `DATA_INCOMPLETE`. This is the basis for reporting, invoicing, and any
  figure Ronald uses to make a decision.
- `basis: 'BEST_AVAILABLE'` — uses actual where present, estimate otherwise. Any
  `MISSING` cost still produces `DATA_INCOMPLETE`. Results carry
  `usedEstimates: string[]` and the UI labels them `ESTIMATE`.

An estimate never silently becomes an actual, and an actual is never overwritten
by an estimate. Both values persist for the life of the job.

---

## 5. Driver labour — economic cost, not compensation

**These are two different questions and the system never conflates them.**

_Economic cost of driving labour_ is a management-accounting question: what does
it cost BOYD'S to have this driving done? It feeds pricing and profitability.

_Partner compensation_ is a legal and accounting question: how is Moh actually
paid? Draw, guaranteed payment, distribution, wage — that belongs to a different
ledger, and the profitability engine has no access to it.

`DriverLabourCostBasis` (in `src/types/economics.ts`) offers four bases:

| Basis                    | Meaning                                  |
| ------------------------ | ---------------------------------------- |
| `PER_HOUR`               | notional hourly rate for time on the job |
| `PER_MILE`               | notional rate per mile driven            |
| `PER_JOB`                | flat notional amount per job             |
| `EXCLUDED_FROM_JOB_COST` | labour deliberately not charged to jobs  |

`EXCLUDED_FROM_JOB_COST` is a legitimate management choice for an owner-operated
business, and it is **not the same as the cost being zero**. Every contribution
figure therefore carries a `LabourCostTreatment`:

- `LABOUR_COSTED` — driving labour has been charged to the job.
- `BEFORE_LABOUR_COST` — it has not. Every figure derived from it is labelled
  _contribution before labour cost_, so it can never be read as a fully-costed
  result, and pricing built on it is understood to be pricing that has not yet
  paid for the driver's time.

The basis is `NOT CONFIGURED` until the partners decide. Until then, job
contribution reports `NOT_CONFIGURED` for the driver cost line rather than
assuming any of the four. See docs/DECISIONS.md D-011.

---

## 6. Vehicle cost allocation — derived, never declared

**There is no field for a manually entered cost per mile.** A typed-in rate is a
guess that looks like a measurement, and every job would inherit it invisibly.

The rate is derived from `VehicleCostEntry` rows — real costs BOYD'S actually
pays — and real recorded mileage:

```
monthly lines  → annualised → per-mile via trailing 12-month vehicle miles
annual lines   → per-mile via trailing 12-month vehicle miles
per-mile lines → used directly

vehicle_allocation = derived_per_mile_rate * job_miles
```

The result (`DerivedCostPerMile`) always carries its provenance:

```
costPerMile
linesIncluded                  which cost lines the figure covers
linesExcludedForMissingData    which lines had no recorded data
milesBasis                     the real mileage it was divided by
periodStart, periodEnd         the window it covers
```

`linesExcludedForMissingData` is what stops a partial figure being read as a
complete one. A cost per mile covering only fuel and insurance is a real number,
but it is not the vehicle's _true_ cost per mile, and the interface says so.

If no cost entries exist, or trailing mileage is zero, allocation is `MISSING` —
**not zero**. A missing cost is not a free cost; treating it as zero would
overstate contribution. See docs/DECISIONS.md D-012.

---

## 7. Pricing engine

`src/services/finance/pricing.ts`. Fully transparent — every output carries the
breakdown that produced it.

**Inputs:** miles, fuel price per gallon, vehicle MPG, driver cost basis, vehicle
per-mile cost, expected tolls, expected parking, other costs, urgency, service
type, target contribution, target margin, empty-mile risk.

**Outputs:**

```
estimated_cost           the full cost stack, itemised
minimum_price            estimated_cost + minimum acceptable contribution
target_price             estimated_cost / (1 - target_margin)
expected_contribution    at each candidate price
contribution_per_mile    at each candidate price
breakdown                every line, every rate, every source
```

The breakdown is stored on the quote (`pricing_breakdown` jsonb) so a price
quoted six months ago can still be explained.

If minimum contribution or target margin is not configured, the engine returns
`NOT_CONFIGURED` for the affected output and computes the rest. It does not
substitute an industry default. (See open business decisions 1 and 2.)

---

## 8. Worked examples — these are tests, not illustrations

**`finance.test.ts` — profitable job**

```
revenue $300.00 · fuel $80 · driver $70 · tolls+parking $30
vehicle allocation $40 · other $20
→ total_cost $240.00, contribution $60.00, margin 20.00%
```

The suite asserts explicitly that no code path reports `$300` as profit.

**`finance.test.ts` — incomplete data**

```
revenue $300.00 · driver $70 · vehicle $40 · fuel MISSING
→ status DATA_INCOMPLETE, missing ['fuel_cost']
```

The suite asserts no numeric contribution is returned as `OK`.

**`finance.test.ts` — guards**

```
contribution_per_mile with 0 miles     → NOT_CALCULABLE
contribution_margin with $0 revenue    → NOT_CALCULABLE
empty_mileage_pct with 0 total miles   → NOT_CALCULABLE
true_cost_per_mile with 0 miles        → NOT_CALCULABLE
```

**`finance.test.ts` — loss-making job**

```
revenue $150 · total cost $240 → contribution -$90, margin -60.00%
```

Asserted to render as a loss, not as zero.

---

## 9. Aggregates

Customer, vehicle, and period profitability follow the same rule: if **any**
constituent job is `DATA_INCOMPLETE`, the aggregate is `DATA_INCOMPLETE` and
names the jobs responsible. A total assembled from partly-unknown parts is not a
total, and BOYD'S will not present it as one.
