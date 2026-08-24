# Setting BOYD'S up

Written for Ronald. No programming knowledge assumed.

Everything in BOYD'S is built and tested. What remains is connecting it to a
real database and putting it online — and those need accounts in BOYD'S name,
which is the one thing the software cannot do for itself.

---

## What you need to do, in order

### 1. Create the database (about 5 minutes)

BOYD'S needs somewhere to keep its data. We use Supabase, which also handles
sign-in. The free tier is more than enough to start.

1. Go to **supabase.com** and sign up.
2. Click **New project**.
3. Name it `boyds-logistics`.
4. Region: choose **East US (North Virginia)** — the closest to North Carolina,
   which makes the system faster for you and Moh.
5. It will generate a database password. **Save it somewhere safe** — a password
   manager, not a note on your phone.
6. Click **Create new project** and wait about two minutes.

When it finishes, go to **Settings → API** in the left-hand menu. You will see
three values. Send them to me:

| What it is called | What it does                                 |
| ----------------- | -------------------------------------------- |
| **Project URL**   | Where BOYD'S data lives                      |
| **anon public**   | Lets the website talk to the database safely |
| **service_role**  | The master key                               |

**About that third one.** The service role key bypasses every protection in the
system. Treat it like the keys to the van. Do not paste it into a chat, an
email, or a shared document. If it ever leaks, go back to that same page and
click to regenerate it — the old one stops working immediately.

### 2. Decide the sign-in email addresses

BOYD'S needs to know which email addresses you and Moh will sign in with. I have
deliberately not guessed: the setup script refuses to run without real ones
rather than inventing them.

Tell me the two addresses. They can be anything you already use.

### 3. Buy a domain name (optional, for the website)

If you want the public website live, you need a web address —
`boydslogistics.com`, or whatever is available. Buy it anywhere reputable
(Namecheap, Cloudflare and Google Domains are all fine). Roughly $12 a year.

### 4. Create a hosting account (about 3 minutes)

Go to **vercel.com** and sign up with GitHub. The free tier covers a business of
BOYD'S size comfortably. Tell me once it exists and I will connect it.

---

## What you do NOT need yet

These make BOYD'S better, and none of them blocks anything. Each one switches a
capability from `NOT CONFIGURED` to working:

| Account            | What it turns on                                                                                 | Rough cost                                         |
| ------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **AI provider**    | The receptionist that answers at 2am, and the assistant that answers "how did we do this month?" | Pay per use, likely a few dollars a month at first |
| **Maps provider**  | Automatic mileage, routing, and live vehicle position                                            | Free tier is generous                              |
| **Email provider** | Quotes and invoices sent automatically                                                           | Free tier available                                |
| **SMS provider**   | Alerts to Moh and delivery updates to customers                                                  | Pay per message                                    |

Until each exists, BOYD'S says so plainly on the Settings screen. Nothing
pretends to work.

---

## The eight business decisions

These are yours to make, not mine. BOYD'S runs without them — it simply shows
`NOT CONFIGURED` where they would apply, rather than assuming a value.

1. **Minimum contribution per job** — the floor below which BOYD'S walks away.
2. **Target profit margin** — what the pricing engine aims for.
3. **How Moh's driving time is costed** into a job. This one genuinely changes
   what "profitable" means, and it is a partnership question rather than a
   technical one.
4. **How the van's running cost is spread** — per mile, per job, or per day.
5. **Your actual service area** — how far from base, which counties.
6. **Medical courier limits** — what BOYD'S will and will not carry.
7. **Payment terms** — net 7, 14 or 30 — and how long a quote stays valid.
8. **Automatic acceptance thresholds** — not needed for a long while.

Until 1 and 2 are set, BOYD'S will show you what a job earned but cannot tell
you whether it cleared your standard, because no standard exists yet.

---

## What I will do once you have the accounts

1. Apply the database structure — 22 migrations, already written and tested.
2. Create your accounts and Moh's, and link them to the partner records.
3. Add BOYD-001, leaving anything you have not given me blank rather than
   guessing.
4. Put the system online and give you the address.
5. Walk you through it.

---

## Vehicle details worth gathering

When convenient, dig out BOYD-001's paperwork. Each of these is currently blank
and reads as `NOT CONFIGURED`:

- VIN (17 characters, on the dashboard or the door frame)
- License plate and state
- Make, model, year
- Purchase date and price
- Current odometer reading
- Insurance provider, policy number, renewal date and premium

**Why it matters:** BOYD'S works out the van's true cost per mile from these,
and every job's profitability uses that figure. Until they exist, the system
reports vehicle cost as `MISSING` rather than assuming the van is free to run —
which means job contribution shows `DATA INCOMPLETE`.

That is deliberate. A profit figure that quietly ignores the cost of the van
would be wrong in the flattering direction, and you would make decisions on it.
