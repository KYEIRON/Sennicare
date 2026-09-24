# BOYD'S — Testing

Correctness is the top priority in this project, and the financial engine is
where correctness is worth the most. The test suite is weighted accordingly.

## Tooling

| Layer                  | Tool                                            |
| ---------------------- | ----------------------------------------------- |
| Unit / domain          | Vitest                                          |
| Integration (DB + RLS) | Vitest against real PostgreSQL, real migrations |
| End-to-end             | Playwright                                      |
| Types                  | `tsc --noEmit`                                  |
| Lint                   | ESLint                                          |
| Build                  | `next build`                                    |

`npm run verify` runs the whole gate. A phase is not complete until it passes.

**The database security tests never skip.** If no database is reachable they fail
with instructions for starting one. A run that quietly did not exercise BOYD'S
authorisation boundary would report success while proving nothing — worse than a
failure, because it would be believed. See docs/DECISIONS.md D-016.

## Required coverage

**Financial calculations** — the worked examples in `FINANCIAL_ENGINE.md`,
including the $300/$240/$60 case and the explicit assertion that no path reports
$300 as profit; the incomplete-data case returning `DATA_INCOMPLETE`; every
division-by-zero guard; negative contribution on a loss-making job.

**Mileage** — loaded + empty = total; rejection of inconsistent logs; odometer
monotonicity; personal mileage excluded from business figures; empty mileage
percentage including the zero-mile guard.

**Pricing** — cost stack assembly; minimum price; target price; expected
contribution and contribution per mile; `NOT_CONFIGURED` when minimum
contribution or target margin is unset; the breakdown reproducing the price.

**Status transitions** — every legal transition succeeds; a representative set of
illegal transitions is rejected; the TypeScript map and the Postgres trigger are
asserted identical; every guard (vehicle+driver for `ASSIGNED`, POD for
`POD_RECEIVED`, mileage for `COMPLETED`, payment for `PAID`).

**Permissions** — a driver session is denied prices, costs, contributions,
customers, quotes, invoices, pricing rules, partner settings, and other drivers'
jobs, at the API layer and at the database layer independently. An anonymous
session is denied everything except active reference data and the one public
write function.

**Validation** — every Zod schema accepts valid input and rejects malformed,
oversized, and injection-shaped input.

**CRUD and workflow** — customer creation, job creation, job assignment, driver
actions, expense creation, invoice creation, AI request creation.

## The required end-to-end test

`tests/e2e/full-job-lifecycle.spec.ts` — one test, the whole business:

Ronald logs in → creates a customer → creates a quote → the quote is accepted →
a job is created → Moh is assigned → Moh logs in → Moh sees the job → accepts →
starts → arrives at collection → confirms collection → uploads collection proof →
starts delivery → arrives at delivery → confirms delivery → uploads POD →
records mileage → records fuel → records an expense → the job completes.

The test then asserts the system calculates revenue, costs, contribution, and
contribution per mile correctly; that empty mileage is recorded; that the
Command Centre dashboard reflects the job; that an invoice becomes available;
and that the customer's history updates.

## The after-hours test

`tests/e2e/after-hours-intake.spec.ts` — clock set to 02:00 America/New_York.
A visitor requests an urgent delivery. Asserts: the AI collects the information,
creates a structured request, marks it `AFTER_HOURS`, raises a notification, and
that no price, no availability, and no confirmation appears anywhere in the
transcript or the created record.

## Mockup and demonstration data guards

`tests/guards/no-mockup-data.test.ts` scans all runtime source and fails the
build if any figure from the visual design reference appears in it. The mockup
specifies how BOYD'S looks, never what BOYD'S earned.

`tests/unit/provenance.test.ts` asserts that illustrative data always carries its
`DEMO DATA` label at the display edge, that any illustrative input makes a
combined figure illustrative, and that `assertReal()` refuses demonstration data
in invoicing, reporting, pricing, and AI contexts.

## Rules for tests

- Fake adapters exist only in the test suite. They are unreachable from a
  development or production runtime — a test asserts this.
- Tests never assert on a formatted string where they can assert on a value.
- Test fixtures never reuse figures from the visual design reference, so a value
  can never travel from a mockup into a test and from a test into a seed file.
- Every bug fixed gets a regression test in the same commit.
