# Sennicare

**Sennicare** — procurement for UK care homes. Two things live in this repo:

- **The website** (`website/`) — the public marketing site and savings calculator.
- **The platform** (`platform/`) — the self-service app care home managers subscribe to,
  log into, and use themselves to find, compare and order supplies.

**Brand colours:** Deep Navy `#0A1172` · Magenta Pink `#E30B5C` · Cyan `#00B2D9` ·
White `#FFFFFF` · Light Grey `#F5F7FA`

---

## What's built so far

| Phase | What it is | Status |
|-------|------------|--------|
| **Phase 1** | Marketing website (plain HTML/CSS/JavaScript) | ✅ Done — `website/` |
| **Phase 2** | Savings calculator page | ✅ Done — `website/savings-calculator.html` |
| **Phase 3** | **The procurement platform** (Python + Streamlit + SQLite) — accounts, private profiles, supplier search, top-recommendation engine, auto-written requests, subscription tiers | ✅ Done — `platform/`, see [platform/README.md](platform/README.md) |

### The one thing standing between the platform and real customers

The software is finished and tested. It currently searches **fictional sample supplier
data**, and says so in an orange banner on every search. Replacing that with real
supplier prices — one spreadsheet, `platform/data/suppliers.csv` — is what turns it into
a business. See [platform/data/README.md](platform/data/README.md).

Also read the hosting warning in [platform/README.md](platform/README.md) before charging
anyone: free Streamlit hosting wipes stored accounts when it restarts.

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
