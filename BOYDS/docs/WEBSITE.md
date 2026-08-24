# BOYD'S — Public Website

Route group `src/app/(site)`. Its own layout, its own navigation, no shared
chrome with the operations OS. Server-rendered, statically generated where
possible.

## Positioning

> **Reliable Logistics. When Your Business Can't Wait.**

Professional · business focused · responsive · technology enabled ·
North Carolina based.

**Prohibited claims** unless proven and recorded: largest, fastest, #1, best,
certified, licensed, compliant, insured beyond what is documented, physical
offices where BOYD'S has none.

Permitted and accurate: the service area BOYD'S actually covers, the services it
actually offers, the fleet it actually operates.

## Pages

Home · Services (index) · Same Day Delivery · Urgent Business Delivery ·
Dedicated Van Delivery · Medical Courier · Industrial Parts Delivery ·
Distribution & Supply · Business Logistics · Service Areas · About ·
Request a Quote · Request a Delivery · Contact · FAQ · Privacy · Terms.

## SEO architecture

Genuine commercial intent, no keyword stuffing. Pages exist because they are
useful, and are structured so a search engine can tell what they are about.

- Service pages: one page per real service, each answering what it is, who it is
  for, what it costs to find out, and how to request it.
- Location pages generated from `service_areas` rows — Charlotte, Concord,
  Greensboro, Winston-Salem, Raleigh, Durham, Fayetteville, and surrounding
  areas. Adding a state adds pages without a code change, which is what makes
  expansion to SC/VA/TN/GA cheap.
- Service × location pages only where the combination is genuinely offered.
- Clean URLs: `/services/same-day-delivery`, `/service-areas/north-carolina/charlotte`.

Technical: semantic HTML · per-page metadata · `sitemap.xml` · `robots.txt` ·
JSON-LD (`LocalBusiness`, `Service`, `FAQPage`) · Open Graph · fast loading ·
mobile optimisation · accessible contrast and focus states.

**No structured-data property may assert something BOYD'S has not verified** —
no fake `aggregateRating`, no fake `review`, no unverified certification.

## Conversion paths

Every page offers three: request a quote, request a delivery, talk to BOYD'S AI.
All three create real records — leads and job requests — visible in the
operations OS immediately.

## Branding

Dark navy · blue · orange · white / light neutral. Professional, modern, premium,
technology enabled. Tokens live in `src/app/globals.css`; no component hardcodes
a hex value. Ronald's supplied BOYD'S branding replaces the tokens when it
arrives — a single edit, not a redesign.
