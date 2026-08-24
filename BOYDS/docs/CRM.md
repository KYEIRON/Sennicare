# BOYD'S — CRM and Quoting

## Pipeline

```
NEW → QUALIFIED → CONTACTED → CONVERSATION → QUOTE_REQUESTED → QUOTE_SENT
    → FOLLOW_UP → WON → FIRST_JOB → REPEAT_CUSTOMER → CONTRACT_OPPORTUNITY
                                                                     ↓
                                                                   LOST
```

`LOST` is reachable from any stage and requires a reason. Lost leads are retained
— the reason is the data that improves pricing and targeting.

## Records

**Leads** — inbound from the website, the AI receptionist, phone, or email.
Every lead has a source, an owner, and either a scheduled follow-up or a place on
the "needs a follow-up date" list.

**Customers** — created on `WON`. The lead record persists and links to the
customer, so the acquisition story survives.

**Opportunities** — recurring interest detected by the AI or logged by a partner,
carrying frequency, routes, shipment type, preferred days and times, and
estimated volume. Raises a `CONTRACT_OPPORTUNITY`.

**Follow-ups** — a due date, an owner, and a note. Overdue follow-ups appear on
the Command Centre. A follow-up cannot be silently dropped.

## Quotes

Fields: quote number · customer · collection · delivery · date · time · job type ·
mileage · estimated cost · recommended price · quoted price · expected
contribution · expected contribution per mile · terms · expiration · status.

Rules:

- A quote is never invented. Every quote comes from the pricing engine with a
  stored, inspectable breakdown.
- The quote shows the partner the expected contribution and contribution per mile
  **before** it is sent. Pricing below the configured minimum contribution
  requires explicit override, and the override is audited.
- If minimum contribution or target margin is not configured, the quote shows
  `NOT CONFIGURED` for those checks rather than a fabricated threshold.
- Accepting a quote creates a job in `ACCEPTED`, carrying the quoted price forward
  as `won_price`.
- Quotes expire. An expired quote cannot be accepted without a partner re-issue.

## Conversion metrics

Quotes sent · quotes accepted · conversion rate · average quoted price · average
expected contribution · realised contribution vs expected (the number that tells
BOYD'S whether its pricing model is actually right).
