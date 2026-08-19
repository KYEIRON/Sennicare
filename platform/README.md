# Sennicare — the procurement platform

A self-service platform for **care home managers**. They subscribe, log in, search for what they need, compare every supplier side by side, and send a professional request — all by themselves, in about three minutes.

This is not a tool you operate on their behalf. They drive it.

---

## The screens

| Screen | What it's for |
|---|---|
| **Dashboard** | Greeting, what they've ordered, and a search box front and centre |
| **Search Suppliers** | Filter rail on the left, results as cards on the right, top recommendation highlighted |
| **Review & Send** | The written request, beside a summary of what they're ordering |
| **My Requests** | What they've sent, with status tracking |
| **Saved Suppliers** | Suppliers they've bookmarked with the ☆ button |
| **Care Home Profile** | Their private details, with the privacy card and quick actions |
| **Subscription** | Their plan and the others available |
| **My Account** | Password, data download, account deletion |
| **Admin** | Yours only — catalogue health check, subscribers, plan changes |

---

## What a manager does

| Step | What happens |
|---|---|
| **1. Create an account** | Email and password. Their password is stored scrambled — nobody at Sennicare can read it. |
| **2. Fill in their care home once** | Name, address, contact, the standards they require of suppliers, payment terms, delivery instructions. Private to their account. |
| **3. Search** | Product, quantity, budget, and when they need it. |
| **4. See every option instantly** | Total cost, price per unit, delivery time, quality rating for elderly care, and what each one saves against typical prices. |
| **5. Read the top recommendation** | Clearly flagged in magenta, with a sentence explaining *why* — including when we've deliberately passed over a cheaper option. |
| **6. Send the request** | We write it, pre-filled from their profile and their search. They edit if they like, then send it from their own email. |

---

## Running it on your own computer

### Step 1 — Install Python (once)

**Windows:** go to [python.org/downloads](https://www.python.org/downloads/), download Python, run the installer. **Tick the box that says "Add Python to PATH"** — it's easy to miss and everything else depends on it.

**Mac:** Python is already there, but install the current version from [python.org/downloads](https://www.python.org/downloads/) anyway.

To check it worked, open a terminal (**Windows:** press Start, type `cmd`, press Enter. **Mac:** press Cmd+Space, type `terminal`, press Enter) and type:

```
python --version
```

You should see something like `Python 3.12.1`. If Windows says "not recognised", Python was installed without ticking that PATH box — reinstall and tick it.

### Step 2 — Install the two packages this app needs (once)

In the terminal, go to this folder and install:

```
cd path/to/Sennicare/platform
pip install -r requirements.txt
```

Replace `path/to` with wherever you saved the project. A tip: type `cd ` (with a space), then drag the `platform` folder onto the terminal window — it fills the path in for you.

This takes a minute or two and prints a lot of text. That's normal.

### Step 3 — Run it

```
streamlit run app.py
```

Your browser opens at `http://localhost:8501`. That's the platform.

To stop it, click the terminal window and press **Ctrl+C**.

### Step 4 — Create your own account first

The **first account created becomes the admin** — that's you. Register, and you'll see an extra **Admin** menu item that subscribers never see. Use it to check your catalogue and to move accounts between plans.

To make a *specific* email the admin instead, set this before running:

```
# Mac
export SENNICARE_ADMIN_EMAILS="you@sennicare.co.uk"
# Windows
set SENNICARE_ADMIN_EMAILS=you@sennicare.co.uk
```

---

## What's in this folder

```
platform/
├── app.py                    ← every screen a manager sees
├── requirements.txt          ← the two packages to install
├── .streamlit/
│   └── config.toml           ← brand colours for Streamlit's own buttons and panels
├── data/
│   ├── suppliers_sample.csv  ← fictional example catalogue (swap for your own)
│   ├── README.md             ← how to build your real catalogue
│   └── sennicare.db          ← created on first run; holds accounts. NOT on GitHub.
└── sennicare/                ← the working parts, one job per file
    ├── database.py           ← stores everything; keeps each account separate
    ├── auth.py               ← registration, login, password scrambling
    ├── subscriptions.py      ← the plans and what each unlocks
    ├── catalogue.py          ← reads the supplier spreadsheet
    ├── matching.py           ← searches, scores, picks the top recommendation
    ├── request_writer.py     ← writes the supply request
    ├── money.py              ← £ and DD/MM/YYYY formatting, other currencies
    └── branding.py           ← the whole look: colours, cards, product tiles
```

---

## The design

Calm and modern, in the brand palette:

- **Deep navy sidebar**, steady and quiet, with the current page marked by a soft cyan pill
- **Soft off-white page** with white cards, generous spacing and thin borders
- **Magenta used sparingly** — one primary action per screen. It's the loudest colour we own,
  so it only marks the thing we want the manager to do next
- **Product tiles** instead of photographs. We don't have photos of supplier products, and
  inventing them would mislead, so each card gets a tinted tile with a line drawing that
  suits its category (see `CATEGORY_ICONS` in `branding.py`)

Two files control it:

| File | What it sets |
|---|---|
| `.streamlit/config.toml` | Streamlit's own parts — buttons, panels, sliders, borders |
| `sennicare/branding.py` | Everything we draw ourselves — cards, tiles, the sidebar menu |

Set colours in **both** if you change the palette: the config file makes Streamlit's built-in
widgets match, and `branding.py` handles our own cards.

---

## The three things you'll want to change

### 1. Your supplier data

Right now the platform searches **fictional sample data** and says so, in an orange banner, on every search. Replace it by creating `data/suppliers.csv` — full instructions in [`data/README.md`](data/README.md). The banner disappears by itself.

This is the single biggest job in making the platform real. The software is finished; the data is what turns it into a business.

### 2. The recommendation rules

Open `sennicare/matching.py`. At the top:

```python
WEIGHT_PRICE   = 1 / 3      # price counts for a third
WEIGHT_SPEED   = 1 / 3      # delivery speed counts for a third
WEIGHT_QUALITY = 1 / 3      # quality counts for a third
```

And in `sennicare/catalogue.py`:

```python
QUALITY_FLOOR = 3.5    # below this, never recommended - however cheap
```

### 3. The plans and prices

Open `sennicare/subscriptions.py`. Everything about the plans is in one list at the top — price, limits, what each plan unlocks, and the exact wording shown on the website. Change it there and both the app and its Subscription screen follow.

Accounts created before the move to two plans (stored as `starter` or `group`) are mapped
onto the current plans automatically by `LEGACY_TIERS`, so nobody is locked out.

| Plan | Price | Includes |
|---|---|---|
| Free Forever | £0/mo | Up to 2 user accounts · basic supplier directory access · monthly spend summary reports · standard email support |
| Professional | £49/mo | Unlimited user accounts · full market intelligence dashboard · automated price discrepancy alerts · API integrations & export · priority 24/7 support |

These match `website/pricing.html` and `website/index.html` word for word. Change one and
change the others.

**What the app actually enforces today**, as opposed to what the plans advertise:

| Advertised | Built? |
|---|---|
| Supplier search, top recommendation, request writing | ✅ Both plans |
| Request history | ✅ Both plans |
| Spreadsheet export / API | ✅ Professional only |
| Full market intelligence dashboard (price benchmarks) | ✅ Professional only |
| Automated price discrepancy alerts | ❌ **Not built yet** |
| Multiple user accounts (2 vs unlimited) | ❌ **Not built yet** — one login per account |
| Priority 24/7 support | Not software — that's you |

The two unbuilt items appear on the pricing page *and* in the app's Subscription screen.
Build them, or take them off both, before charging for Professional.

---

## Putting it online free (Streamlit Community Cloud)

1. Push this repo to GitHub (already done).
2. Go to [share.streamlit.io](https://share.streamlit.io) and sign in with GitHub.
3. Click **New app**, choose the `Sennicare` repo, and set:
   - **Main file path:** `platform/app.py`
4. Click **Deploy**. A few minutes later you have a live web address.

### ⚠️ Read this before you charge anyone

**Streamlit Community Cloud does not keep files.** When it restarts your app — which it does, on its own, after redeploys and periods of no use — `sennicare.db` is wiped and **every account, profile and saved request goes with it**.

That is fine for showing the platform to managers. It is not fine once someone has paid you.

Free cloud hosting is perfect for **demos and pilot feedback**. When you're ready for paying subscribers, the fix is to move the accounts out of the file and into a hosted database — [Supabase](https://supabase.com) has a free Postgres tier. Because every database call in this app goes through `sennicare/database.py` and nowhere else, that change is confined to one file. It was built that way on purpose.

---

## What this build does and doesn't do yet

### Working now
- Registration and login, with passwords hashed (PBKDF2, 240,000 rounds) — never stored as text
- A private care home profile per account
- Search by product, quantity, budget and delivery deadline
- Every match priced properly, respecting pack sizes and minimum order quantities
- Top recommendation weighing price, speed and quality equally, with the hard care-quality rule
- A plain-English explanation of every recommendation, including when a cheaper option was rejected
- Savings shown against typical market prices, in £
- Auto-written supply request, pre-filled from the profile, editable, sent from the manager's own email
- Request history with status tracking (Draft → Sent → Confirmed → Delivered)
- Subscription plans with feature gating and monthly search allowances
- Each account's data fully isolated — enforced in one place, in `database.py`
- Data export (download everything we hold) and account deletion, for UK GDPR
- Admin page: catalogue health check, subscriber list, change anyone's plan

### Deliberately not built yet
| Missing | Why, and what it needs |
|---|---|
| **Card payments** | Plans are changed by hand from the Admin page. Stripe would call `auth.set_tier()` after payment — that's the only join. |
| **Password reset emails** | Needs an email service (Resend or SendGrid, both have free tiers). Until then, you reset a locked-out manager by hand. |
| **Email verification** | Same — needs an email service. |
| **Multiple homes per account** | The database supports it (`profiles` is keyed by user); the screens still assume one home. |
| **Multiple user accounts** | Advertised on both plans (2 vs unlimited). Not built — one login per account. |
| **Automated price discrepancy alerts** | Advertised on Professional. Not built. |
| **Currency conversion** | A home works in its own currency and the catalogue is priced in it. Converting needs live exchange rates. |
| **Sending the email for them** | On purpose. The request goes from the care home's own mailbox, so the supplier's reply comes straight back to them — and Sennicare never sits in the middle of their supplier relationship. |

### Before you take real money
- Move the database off ephemeral hosting (see the warning above)
- Add password reset
- Back up the database file on a schedule
- Get a data processing agreement and an updated privacy notice drafted — you'll be holding business data for paying clients
