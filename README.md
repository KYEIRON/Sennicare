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
| **Phase 2** | Savings calculator to embed on the website | ⏳ Next |
| **Phase 3** | Internal Streamlit tools (supply chain analyser, stock planner, proposal generator) | ⏳ Later |

---

## Phase 1 — The website

### What's in the folder

```
website/
├── index.html      ← the home page (all the sections: hero, services, how it works, benefits, contact)
├── privacy.html    ← starter Privacy Policy page
├── terms.html      ← starter Terms of Service page
├── css/
│   └── styles.css  ← every colour, font and spacing decision lives here
├── js/
│   └── main.js     ← mobile menu, navbar shadow, contact form check
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
