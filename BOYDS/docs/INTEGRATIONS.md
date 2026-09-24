# BOYD'S — Integrations

Nothing has been purchased. No credential is assumed to exist. Every integration
is an interface with three adapters, selected once at startup by whether the
required environment variables are present.

| Adapter       | When                | Behaviour                                                     |
| ------------- | ------------------- | ------------------------------------------------------------- |
| `live`        | credentials present | real calls                                                    |
| `unavailable` | credentials absent  | returns `UNAVAILABLE`; UI shows an explicit unavailable state |
| `fake`        | test suite only     | deterministic, unreachable outside tests                      |

There is no fourth option. Nothing simulates a real service in a running
application.

## Maps — `src/integrations/maps`

```ts
interface MapsProvider {
  geocode(address): Promise<Result<Coordinates>>;
  route(stops): Promise<Result<{ miles: MilesTenths; durationMinutes: number }>>;
  vehicleLocation(vehicleId): Promise<Result<Coordinates>>;
}
```

Mapbox and Google Maps both fit this shape. Unconfigured: mileage is entered
manually and location renders `Live tracking unavailable`. **Never a fabricated
position, never a fabricated ETA.**

## Email — `src/integrations/email`

Send quotes, invoices, job confirmations, notifications. Unconfigured: the
message is queued as a notification for a partner to send manually, and the UI
says so. Nothing reports "email sent" when no email was sent.

## SMS — `src/integrations/sms`

Driver alerts, urgent job notifications, customer delivery updates. Same rule.

## AI — `src/integrations/ai` / `src/ai/provider.ts`

Chat completion with tool calling and streaming. Unconfigured: the AI surfaces
render unavailable; the rest of the system is unaffected. No vendor name appears
in feature code.

## Storage — `src/integrations/storage`

Supabase Storage, private buckets, signed URLs. This is the one integration
configured from day one, since it ships with the database.

## Payments — `src/integrations/payments`

Deliberately last. V1 records payments manually. An invoice is `PAID` only when
a payment record covers it. **No payment status is ever inferred.**

## Environment variables

Every variable appears in `.env.example` with a comment. The application starts
successfully with none of the optional ones set — it simply reports which
capabilities are unavailable, on a settings page Ronald can read.

| Variable                                        | Required | Purpose                          |
| ----------------------------------------------- | -------- | -------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                      | yes      | Database and auth                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                 | yes      | Browser client                   |
| `SUPABASE_SERVICE_ROLE_KEY`                     | yes      | Server-only privileged paths     |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`         | no       | BOYD'S AI                        |
| `MAPS_PROVIDER`, `MAPS_API_KEY`                 | no       | Geocoding, routing, tracking     |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` | no       | Outbound email                   |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_FROM`       | no       | Outbound SMS                     |
| `NEXT_PUBLIC_SITE_URL`                          | yes      | Canonical URLs, sitemap, OG tags |

## What Ronald will need to obtain, and when

Each of these requires an external account or a payment, so it cannot be done
from inside the codebase. None of them blocks development — each is needed only
to switch one integration from `unavailable` to `live`.

1. **Supabase project** (free tier) — needed to run the real database. Phase 1.
2. **AI provider API key** — needed for BOYD'S AI. Phase 11.
3. **Maps provider API key** — needed for routing and tracking. Phase 13.
4. **Email provider account** — needed to send quotes and invoices. Phase 13.
5. **SMS provider account** — needed for driver and customer alerts. Phase 13.
6. **Domain name** and a **Vercel account** — needed to put the website live.
   Phase 10.

When each becomes the blocking item, the exact steps and the exact values to
provide will be spelled out.
