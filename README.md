# Sennicare

Website and operational toolkit for **Sennicare** — independent operations and supply
chain partners for UK care homes.

**Brand colours:** Deep Navy `#0A1172` · Magenta Pink `#E30B5C` · Cyan `#00B2D9` ·
White `#FFFFFF` · Light Grey `#F5F7FA`

---

## What's built so far

| Phase | What it is | Status |
|-------|------------|--------|
| **Phase 1** | Marketing website (plain HTML/CSS/JavaScript) | ✅ Done — in the `website` folder |
| **Phase 2** | Savings calculator page | ✅ Done — `website/savings-calculator.html` |
| **Phase 3** | Internal Streamlit tools (supply chain analyser, stock planner, proposal generator) | ⏳ Later |

---

## The new homepage (in review)

`website/index.html` has been rebuilt as a conversion-focused homepage for the platform
positioning — **Buy Smarter. Care Better.** It uses a new stylesheet, `css/sennicare.css`,
and a new script, `js/site.js`. Plain HTML, CSS and JavaScript: no build step, no framework.

**What's on it:** announcement bar · hero with the drawn product illustration · trust strip ·
four problem cards · three-step how-it-works · four features · the quality-rule panel ·
savings-calculator teaser · three pricing plans · pilot/proof section · seven-question FAQ ·
sign-up form · footer.

**Deliberate choices worth knowing about:**

- **One magenta action per screenful.** Verified by test: scrolling the whole page never puts
  two magenta buttons in view at once. The navigation button is deliberately outlined, not
  magenta, so it never competes with the hero.
- **No invented social proof.** The proof section holds clearly-marked amber dashed
  placeholders, not fabricated testimonials. Instructions for replacing them are in the
  HTML comment above that section, with a template to copy. No CQC or NHS logos are shown
  and the footer states plainly that Sennicare is not affiliated with either.
- **Content never depends on JavaScript.** The fade-in effect only applies when JavaScript
  has confirmed it is running. With JavaScript blocked, every section is visible.
- **"No savings, no fee" is not on the page.** It was in the brief as a conversion trigger,
  but it is a promise you would have to honour. Say the word and I'll add it.

**Still on the old design:** `savings-calculator.html`, `privacy.html` and `terms.html` use
the previous stylesheet (`css/styles.css`) and the old "Book a Free Review" wording. The old
section anchors (`#services`, `#how-it-works`, `#benefits`, `#about`, `#contact`) are all
preserved on the new homepage, so every existing link still lands somewhere sensible. Once
you approve the homepage direction, the remaining pages get migrated to match.

---

## Phase 1 — The website

### What's in the folder

```
website/
├── index.html               ← the home page (hero, services, how it works, benefits, contact)
├── savings-calculator.html  ← the savings calculator page (Phase 2)
├── privacy.html    ← starter Privacy Policy page
├── terms.html      ← starter Terms of Service page
├── css/
│   └── styles.css  ← every colour, font and spacing decision lives here
├── js/
│   ├── main.js       ← mobile menu, navbar shadow, contact form check
│   └── calculator.js ← the savings calculator sums
├── assets/
│   ├── logo.svg        ← the Sennicare logo (navy house, cyan heartbeat, magenta heart)
│   └── logo-light.svg  ← white version of the logo, for the navy footer
└── images/
    └── hero-caregiver-resident.svg  ← PLACEHOLDER — replace with your real photo
```

### How to view it on your own computer

There is nothing to install and nothing to build.

1. Open the `website` folder on your computer.
2. Double-click **`index.html`**.
3. It opens in your web browser. That's it.

To check it looks right on a phone: in Chrome, press `F12` (or `Cmd+Option+I` on a Mac),
then click the little phone/tablet icon in the panel that appears.

### How to make small changes yourself

| I want to… | Do this |
|---|---|
| Change a brand colour | Open `css/styles.css`. The colours are in the first block at the top, e.g. `--magenta: #E30B5C;`. Change the code, save, refresh the browser. |
| Change any wording | Open `index.html` and edit the text between the tags. Ignore anything inside `< >`. |
| Use your real hero photo | Save your photo (about 1600×900 pixels) into the `images` folder. In `index.html`, find `src="images/hero-caregiver-resident.svg"` and change it to your filename, e.g. `src="images/hero.jpg"`. Update the `alt="..."` text to describe the photo. |
| Change the enquiry email address | Two places: line near the top of `js/main.js` (`var SENNICARE_EMAIL = ...`) and the `mailto:` link in the contact section of `index.html`. |

### The contact form — how it works right now

A website made only of files (no server) **cannot send email by itself**. So the form
currently: checks all four fields are filled in → opens the visitor's own email app with
the enquiry pre-written and addressed to you.

That works, but the visitor has to press "send" in their own email app.

#### Making the form email you directly (free, ~5 minutes)

Use **Formspree** (free tier: 50 enquiries a month):

1. Sign up at [formspree.io](https://formspree.io) and create a new form. It gives you a
   web address like `https://formspree.io/f/abcdwxyz`.
2. In `index.html`, find this line:
   ```html
   <form class="form" id="contactForm" novalidate>
   ```
   and change it to (using **your** address):
   ```html
   <form class="form" action="https://formspree.io/f/abcdwxyz" method="POST">
   ```
   Removing `id="contactForm"` switches off the email-app behaviour, and Formspree takes
   over — enquiries land in your inbox.

### How to put it online for free

**Netlify drag-and-drop — the easiest option (about 2 minutes, no technical steps)**

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the **`website`** folder onto the page.
3. Done — you get a live address like `random-name-12345.netlify.app`.
4. Sign up (free) to keep the site, rename it, and later connect `sennicare.co.uk`
   (Netlify → Site settings → Domain management).

To update the site later, drag the folder on again (Netlify → Deploys → drag-and-drop).

**GitHub Pages — free, and updates automatically when this repo changes**

1. On GitHub, go to this repository → **Settings** → **Pages**.
2. Under "Build and deployment", set **Source** to *Deploy from a branch*.
3. Choose branch `main` and folder `/ (root)`, then **Save**.
4. Wait a couple of minutes. Your site appears at
   `https://kyeiron.github.io/sennicare/website/`.

> GitHub Pages serves from the repository root, which is why `/website/` appears in the
> address. If you'd prefer a clean address, tell me and I'll move the site files to the
> root of the repo.

---

## Phase 2 — The savings calculator

A new page at `website/savings-calculator.html`, linked from the menu and the footer on
every page. The visitor answers four questions and the numbers update **as they type or
drag** — there is no "Calculate" button.

### The four questions and the four answers

| Question | Type |
|---|---|
| Number of suppliers you currently use | Slider, 1–30 |
| Approximate monthly spend on consumables (£) | Type a number |
| Staff hours spent weekly on ordering & admin | Type a number |
| Current estimated stock waste (%) | Slider, 0–30% |

| Result shown | How it's worked out |
|---|---|
| Annual saving from supply consolidation | monthly spend × 12 × **15%** |
| Annual saving from waste reduction | monthly spend × 12 × waste % × **50%** |
| Staff time given back each year | weekly hours × 52 × **30%** |
| **Total estimated annual benefit** (magenta) | the two cash savings + the time valued at **£15/hour** |

Worked example — the figures the page loads with (12 suppliers, £8,000/month, 10 hours/week,
8% waste): £14,400 + £3,840 + 156 hours (worth £2,340) = **£20,580 a year**.

### Changing the assumptions yourself

Open `js/calculator.js`. The very first block is called `SETTINGS` and everything you'd
want to adjust is in it:

```js
CONSOLIDATION_SAVING: 0.15,   // 15% off consumables spend
ADMIN_TIME_SAVING:    0.30,   // 30% less admin time
WASTE_CUT:            0.50,   // we remove half of current waste
HOURLY_RATE:          15,     // £15 per hour
```

`0.15` means 15%. Change it to `0.18` and the whole page switches to an 18% assumption —
including the small print, which reads the same setting.

### The two buttons under the results

- **"Want a detailed breakdown? Book your free review"** (big magenta button) — opens an
  email to you, with the subject line already written and **all of the visitor's figures
  in the message**, plus blank lines for their name, home and phone number.
- **"Or email these results to yourself"** (small link) — the same summary, but with no
  recipient, so they can send it to themselves or to their owner/finance manager.

### Extra things I added (say if you'd rather not have them)

1. **A consolidation recommendation** in a navy box above the results, e.g. *"We would
   typically consolidate 12 suppliers down to around 5 core partners…"*. Your brief had
   suppliers as an input but no output using it, so this gives it a purpose. It suggests
   keeping ~40% of current suppliers, never fewer than 3. If someone already has 3 or
   fewer, the message changes to say their supply chain is already tight.
2. **The waste slider shows the £ figure** underneath — "That is about £7,680 of stock
   wasted a year" — so a percentage becomes something real.
3. **"Reset to example figures"** link, to get back to the starting numbers.
4. **A "How we work these numbers out" panel** at the bottom, plus the line that these are
   estimates and not a guarantee. Worth keeping — it protects you and it builds trust.
5. **The menu switches to the hamburger button earlier now** (below 980px instead of
   700px). Five links plus the button no longer fit on one line on a tablet, so it would
   otherwise have wrapped onto two rows.

### Design assumptions I made (change any of these — just say)

1. **One hero image, not a rotating slideshow.** The reference design hinted at a carousel
   (the dots underneath). A single strong hero loads faster and is far easier for you to
   edit, so I built that. I can add a slideshow later if you want one.
2. **"Resources" in the menu** points to the Benefits section for now, since there's no
   resources/blog content yet. When you have articles or guides, it becomes its own page.
3. **One page, not many.** Solutions, How It Works, About and Contact are all sections of
   `index.html`, so the menu smooth-scrolls rather than loading new pages. Simpler for you
   and better for a single-service business.
4. **Three trust statements under the hero** (15–25% savings, 100% independent, CQC aware)
   — not in your brief, but they use claims you already gave me and lift credibility above
   the fold. Easy to delete if you'd rather not.
5. **Placeholder email `hello@sennicare.co.uk`** — swap in your real address.
6. **Privacy and Terms pages are starter templates** with `[SQUARE BRACKETS]` where your
   details go. They are not legal advice — have them checked before relying on them.
7. **Dates shown in UK format (DD/MM/YYYY)** and all currency in £, as agreed.

---

## The Hanken Grotesk pages (home, product, pricing)

Three standalone pages built to the `DESIGN.md` brand specification — Hanken Grotesk,
raspberry `#e30b5c`, lavender-white `#faf8ff`, navy `#0a1172`. Each is **one file** with
its CSS embedded: open it by double-clicking, upload it anywhere, no build step.

| File | Page |
|---|---|
| `website/home.html` | Homepage — hero, trust bar, Stressed→Empowered, the Sennicare Engine, Built for the People of Care, final CTA |
| `website/product.html` | Product — frequency-aware algorithm, testimonial banner, consolidation intelligence, quality vetting |
| `website/pricing.html` | Pricing — Free Forever / Professional, "No Savings, No Fee" banner |

**To make one of these your live homepage:** rename it to `index.html`.

### Photographs

Every photo slot holds a **drawn placeholder that says what belongs there** — built into
the file, so the pages work with no internet and no photo can be mistaken for real. Search
any file for `PHOTO` to find them; each has a note describing the shot wanted. Replace by
saving your image beside the file and changing that one `src="..."`.

I did not use random stock-photo services: they return unrelated images, so a landscape
would appear where your nurse should be.

### ⚠️ Claims to verify before these pages go live

Each is flagged in a comment at the relevant place in the code:

| Claim | Where | What it needs |
|---|---|---|
| "ISO 27001 Certified" | home, trust bar | An accredited certification body and a certificate number |
| "NHS Data Standards Compliant" | home, trust bar | The specific standard met (e.g. DSPT, DCB0129) |
| "500+ UK Care Homes" | home, trust bar | Your real number |
| "Trusted by CQC Registered Homes" | home, trust bar | At least one such home actually using Sennicare |
| "Join hundreds of UK care homes already saving" | home, final CTA | Existing customers |
| "the leading UK care homes relying on Sennicare" | product, final CTA | Existing customers |
| Unattributed testimonial quote | product, banner | A real name and home, with written permission |
| "25% commission on verified savings" | pricing, guarantee | A written definition of "verified saving", who verifies it, and over what period — then link it to your terms |

These are statements of fact a care home manager, or the Advertising Standards Authority,
can check. Honest alternatives are suggested in the code comments beside each one.

### Known inconsistencies to resolve

- **Two price lists exist.** These pages say Free £0 / Professional £49. The platform app
  (`platform/sennicare/subscriptions.py`) says Starter £49 / Professional £99 / Group £249.
  Pick one and I'll align the other.
- **Three homepages exist.** `index.html` (the "Buy Smarter. Care Better." version),
  `home.html` (this set), and the old design still used by `savings-calculator.html`,
  `privacy.html` and `terms.html`. Tell me which direction wins and I'll consolidate.
- **The CSS is duplicated** across the three standalone files, because you asked for
  standalone files. That means a colour change is three edits. If you'd rather change it
  once, I can pull the shared CSS into a single `sennicare-brand.css` — the pages stop
  being single-file, but stay just as simple to host.
