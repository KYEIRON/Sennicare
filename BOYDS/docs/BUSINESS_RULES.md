# BOYD'S — Business Rules

Rules the software enforces. Each is testable.

## Jobs

1. A job must have a customer before leaving `DRAFT`.
2. A job must have at least one `COLLECTION` stop and one `DELIVERY` stop before
   reaching `SCHEDULED`.
3. Job status follows the state machine in `DATABASE.md`. Any other transition is
   rejected server-side and by database trigger.
4. `ASSIGNED` requires both a vehicle and a driver.
5. Only the assigned driver may set `DRIVER_ACCEPTED` and the field statuses that
   follow it.
6. A vehicle in `MAINTENANCE` or `OUT_OF_SERVICE` cannot be assigned to a job.
7. A vehicle cannot hold two jobs whose scheduled windows overlap. With one van
   this matters immediately; the rule is written for N vehicles.
8. `POD_RECEIVED` requires at least one document of type `POD` on the job.
9. `COMPLETED` requires actual mileage recorded.
10. Cancellation requires a reason and is impossible after `COMPLETED`.
11. `won_price` is required before `ACCEPTED`.

## Money

12. Revenue is never displayed, labelled, or exported as profit.
13. A contribution figure computed from any `MISSING` cost is returned as
    `DATA_INCOMPLETE` and rendered with that badge.
14. Estimated and actual costs are stored separately and both remain visible.
15. Every division guards zero and returns `NOT_CALCULABLE`.
16. Vehicle allocation with no configured cost model is `MISSING`, not `$0`.
17. An invoice reaches `PAID` only when payment rows cover its total.
18. Invoice and quote numbers are unique, sequential, and never reused.
19. Quotes expire on `valid_until` and cannot be accepted after expiry without an
    explicit partner re-issue.

## Mileage

20. Every job mile is classified `LOADED` or `EMPTY`.
21. `total_miles = loaded + empty`. The system rejects a log that breaks this.
22. Odometer readings must not decrease for a vehicle over time.
23. Personal mileage is recorded as `PERSONAL_EXCLUDED` and never enters business
    cost or contribution figures.

## Customers and CRM

24. A lead becomes a customer only on `WON`; the lead record is retained.
25. Every open lead has a `next_followup_at` or appears in an "unscheduled
    follow-up" list on the Command Centre.
26. A customer with more than one completed job is flagged
    `REPEAT_CUSTOMER`; recurring interest raises `CONTRACT_OPPORTUNITY`.

## Permissions

27. A driver can read only jobs assigned to them.
28. A driver can never read a price, a cost, a contribution, or a margin.
29. A driver can never read customer lists, invoices, quotes, pricing rules, or
    partner settings.
30. A driver may create mileage, fuel, expense, and document records for their own
    jobs, and may not edit them after the job reaches `COMPLETED`.
31. Partners have full business access. Both partners are equal in the system
    except where a specific responsibility requires otherwise.

## Public surface

32. The public website and public AI can read only active service types, active
    service areas, and published marketing content.
33. The public surface can write only leads and job requests, through a single
    controlled function.
34. No certification, licence, insurance, or compliance claim appears anywhere
    unless a verified record exists. Absent that record, the claim is absent.
35. No superlative claim ("largest", "fastest", "#1", "best") appears without
    evidence. Absent evidence, the claim is absent.
36. No claim of a physical office in a location where BOYD'S has none. Service
    areas are described as service areas.

## AI

37. The AI never invents a price, availability, ETA, certification, confirmation,
    or payment status.
38. Every AI statement is tagged `FACT`, `ESTIMATE`, `RECOMMENDATION`, or
    `DATA_INCOMPLETE`.
39. A request received between `after_hours_start` and `after_hours_end`
    (America/New_York) is marked `is_after_hours` and raises a notification.
40. The AI never confirms a job. It acknowledges receipt and creates a review
    task.
41. Automatic acceptance is disabled at the database level
    (`auto_acceptance_enabled = false`) and cannot be enabled until the
    availability, location, and pricing integrations are live and verified.

## Audit

42. Changes to job status, job price, quote price, expenses, vehicle assignment,
    driver assignment, invoice status, customer status, and contract status are
    written to `audit_logs` by database trigger.
43. `audit_logs` is append-only. No role holds UPDATE or DELETE.
