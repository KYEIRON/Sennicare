# BOYD'S — Driver Application (Moh)

Mobile-first. Built for one hand, in a van, in daylight, possibly in a hurry.

## Design constraints

- Minimum touch target 56px. Primary actions are full-width and at least 64px.
- One primary action visible per screen. The next step is obvious without reading.
- Minimal typing. Numbers use a numeric keypad; addresses come from the job.
- Camera is first-class: collection photo, POD photo, receipt capture.
- Works on a poor connection — optimistic UI, queued writes, explicit sync state.
- Never routes Moh through the management system. The driver app is its own
  route group with its own layout and navigation.

## Screens

**Today** — `GOOD MORNING, MOH` · today's jobs · current job · next job · vehicle
and its status · miles today · expenses today.

**Job detail** — customer, stops in sequence, contacts, notes, special handling,
and exactly one primary action for the current status.

**Actions** (each advances the state machine, each writes an audit row):
accept job · start job · navigate · call customer · arrive at collection ·
confirm collection · upload collection photo · add collection note ·
start delivery · arrive at delivery · confirm delivery · capture signature ·
upload POD · complete job.

**Record** — mileage (start/end odometer) · fuel (gallons, price per gallon,
odometer, receipt photo) · expense (category, amount, receipt photo) ·
report incident.

**Vehicle** — BOYD-001 status, odometer, outstanding maintenance.

## What Moh cannot see

No price. No cost. No contribution. No margin. No customer list. No invoice.
No quote. No pricing rule. No partner setting.

This is enforced by RLS, by the `driver_jobs` view (which has no financial
columns), and by server-side guards — not by hiding buttons.

Moh is a partner, and the reason for this restriction is separation of
operational and financial surfaces, not distrust. Ronald and Moh can change the
policy; until they do, the software enforces what was specified.

## Location

Live GPS is not connected in V1. The vehicle card shows `GPS NOT CONNECTED`.
Nothing simulates a position. When a maps provider is configured, the same
component renders real data with no other change.

## Signature capture

Canvas-based, stored as an image in the private documents bucket, linked to the
job as a `POD` document with the signer's name and a timestamp.
