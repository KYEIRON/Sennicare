# BOYD'S Logistics LLC — Project Rules

**Read this file before doing any work inside `/BOYDS`.**

---

## 1. What this project is

BOYD'S Logistics LLC is a real, legally registered logistics company operating in
North Carolina, USA. This directory contains the **BOYD'S Logistics Operating
System** — the software that runs that company.

The authoritative requirements for this project are, in order:

1. The BOYD'S MASTER BUILD INSTRUCTION (Version 1.0), summarised in
   `docs/BUSINESS_SPECIFICATION.md`.
2. The BOYD'S documents under `/BOYDS/docs/`.
3. Explicit future business decisions from Ronald.

If any two of these conflict, **stop and identify the conflict** rather than
guessing.

---

## 2. Hard boundary: BOYD'S is not Sennicare

This repository also contains an unrelated project called **Sennicare** (a UK care
home business, in `/website`). BOYD'S and Sennicare share a repository for
organisational convenience only.

**Absolute rules:**

- Never modify any file outside `/BOYDS` unless Ronald explicitly authorises it.
- Never import Sennicare code, logic, data, colours, or terminology into BOYD'S.
- Never describe BOYD'S as a Sennicare subsystem, module, codename, or delivery arm.
- Never delete or refactor Sennicare work.
- BOYD'S is a US business. Sennicare is a UK business. Do not let UK assumptions
  (GBP, kilometres, litres, Europe/London) leak into BOYD'S.

---

## 3. Who you are working with

Ronald is a **business partner, not a programmer**. He is not a software engineer,
database engineer, or DevOps engineer.

- Make normal engineering decisions yourself. Do not ask which folder, which
  library, which table, or how to structure an API.
- Only ask Ronald questions that require a genuine **business** decision
  (pricing policy, minimum acceptable contribution, service area, contract terms,
  automatic-acceptance thresholds, medical service limitations).
- Explain technical work in plain English.
- Do not hand Ronald technical homework. You run the commands, you write the SQL,
  you edit the config. The only exceptions are steps that genuinely require an
  external account, a credential, a payment, domain ownership, or a physical
  device — and for those, state exactly what is needed, why, where to do it, and
  what value to provide, then continue with everything else.
- Record important architectural decisions in `docs/DECISIONS.md`.

---

## 4. Business locale — never deviate

| Setting    | Value              |
| ---------- | ------------------ |
| Country    | United States      |
| Currency   | USD (`$`)          |
| Distance   | miles              |
| Fuel       | gallons            |
| Fuel price | USD per gallon     |
| Time zone  | `America/New_York` |
| Locale     | `en-US`            |

Initial operating state is North Carolina, but **North Carolina must never be
hardcoded**. Service areas are database rows, not constants. The system must
support expansion to SC, VA, TN, GA, the wider Southeast, and the rest of the US
without a schema change.

---

## 5. The core business principle

**BOYD'S optimises for profitable work, not revenue.**

- Never present revenue as profit.
- Never hide a cost.
- Never display a contribution figure derived from incomplete cost data without
  labelling it. Show `DATA INCOMPLETE`.
- Every important cost carries a state: `ESTIMATED`, `ACTUAL`, or `MISSING`.
  Never silently replace an estimate with an actual, or an actual with an estimate.

The canonical formulas live in `docs/FINANCIAL_ENGINE.md`. All money maths goes
through the shared engine in `src/services/finance/`. No component, page, or
report may re-implement a formula inline.

---

## 6. No fake functionality

Build a real business system, not a mockup. Never fabricate:

live location · payments · emails · SMS · vehicle availability · driver
availability · pricing · delivery ETAs · AI decisions · customer confirmations ·
certifications · insurance or compliance status

When an integration is not connected, show an explicit unavailable state —
`GPS NOT CONNECTED`, `Live tracking unavailable` — never a plausible-looking
placeholder. Seeded development data must be obviously labelled as such and must
never appear in a production build.

Do not invent real-world facts. If BOYD'S has not supplied a VIN, a license
plate, a purchase price, or an insurance premium, the field stays null.

### The visual design reference

BOYD'S has supplied a dashboard mockup. It is **authoritative for visual design
only**: layout, information hierarchy, navigation, dashboard structure, colours,
visual style, KPI presentation, map placement, cards, tables, and quick actions.

It is **authoritative for nothing about business data**. Every figure in it is an
illustrative placeholder. Never seed, copy, assume, or reproduce any of it —
revenue, contribution, mileage, fuel prices, job numbers, request numbers,
vehicle model, phone numbers, customer information, dates, driver information, or
profitability figures.

Where an interface needs data before real BOYD'S data exists, use `DEMO DATA` or
`NOT CONFIGURED`, clearly labelled. Illustrative data must never be able to
appear as real operational data.

This is enforced, not merely stated:

- `src/lib/provenance.ts` — every displayed figure carries `REAL` or `DEMO`.
  There is no function that strips provenance and no way to suppress the
  `DEMO DATA` label. Any illustrative input makes the whole result illustrative.
- `assertReal()` guards invoicing, reporting, pricing, and AI answers. Demo data
  reaching one of those throws.
- `tests/guards/no-mockup-data.test.ts` fails the build if any mockup figure
  appears anywhere in runtime source.

---

## 7. Money handling

- Store money as **integer cents** (`bigint`) in the database and as a branded
  `Cents` type in TypeScript. Never store or compute money as a float.
- Store distance as **integer tenths of a mile**. Never as a float.
- Format for display only at the edge, via `src/lib/format.ts`.
- Every division guards against zero and returns an explicit "not calculable"
  result rather than `NaN`, `Infinity`, or `0`.

---

## 8. Security rules

- Authentication is Supabase Auth. Authorisation is enforced **server-side** and
  at the database level via Row Level Security. Hiding a UI element is never an
  authorisation control.
- Drivers must not be able to reach company-wide financial data — not through the
  UI, not through an API route, not through a direct database query.
- The public website and the public AI receptionist have **no access** to internal
  profitability, pricing rules, partner information, other customers, financial
  records, or private documents.
- The AI never gets raw database access. It calls a fixed set of server-side
  tools, each of which applies the caller's permissions.
- Never commit `.env`. Keep `.env.example` current.
- Never log secrets, tokens, or customer PII.

---

## 9. Definition of done

A phase is **not** complete because the application compiles. A phase is complete
when all of the following are true:

- [ ] functionality implemented
- [ ] validation implemented (Zod, at every trust boundary)
- [ ] permissions implemented and enforced server-side
- [ ] error handling implemented
- [ ] tests written
- [ ] tests passing (`npm test`)
- [ ] type checking passing (`npm run typecheck`)
- [ ] linting passing (`npm run lint`)
- [ ] production build passing (`npm run build`)
- [ ] documentation updated

Run `npm run verify` — it runs the full gate.

---

## 10. Git discipline

- All BOYD'S work stays inside `/BOYDS`.
- Commit after each stable phase with a clear message prefixed `BOYDS:`.
- No enormous undocumented commits.
- Never touch Sennicare files in a BOYD'S commit.

---

## 11. Priority order

CORRECTNESS → FUNCTIONALITY → USABILITY → AUTOMATION → ADVANCED AI

Never sacrifice correctness for speed. Never over-engineer V1.
