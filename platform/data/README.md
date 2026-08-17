# The `data` folder

Two kinds of file live here.

## 1. The supplier catalogue (you own this)

| File | What it is |
|---|---|
| `suppliers_sample.csv` | **Fictional example data.** 64 products from 7 made-up suppliers. Used so you can test the platform before you have real data. Every email address ends in `.test`, which is a reserved domain that can never receive email. |
| `suppliers.csv` | **Your real data.** Doesn't exist yet. The moment you create it, the platform uses it instead of the sample and the "example data" warning disappears. |

### How to create your real catalogue

1. Open `suppliers_sample.csv` in Excel or Google Sheets.
2. **Save a copy as `suppliers.csv`** in this same folder.
3. Delete the example rows and put your own in.
4. Keep the top row (the column names) exactly as it is.

One row = one product from one supplier. If three suppliers sell gloves, that's three rows — that's exactly what lets a manager compare them.

### The columns

| Column | What goes in it | Example |
|---|---|---|
| `supplier_name` | Who sells it | `Northgate Care Supplies` |
| `supplier_email` | Where a request should be sent | `orders@northgate.co.uk` |
| `product_name` | What it is. Be specific — this is the main thing searched | `Nitrile Examination Gloves (Powder-Free)` |
| `category` | A broad group | `PPE` |
| `keywords` | Other words a manager might type, separated by spaces | `gloves glove nitrile disposable hand` |
| `unit_description` | What **one unit** is | `glove`, `75ml tube`, `pad` |
| `pack_size` | How many units in a case. Orders round up to whole cases | `200` |
| `price_per_unit` | Price of ONE unit (not the case) | `0.043` |
| `typical_market_price` | What one unit normally costs elsewhere | `0.055` |
| `min_order_units` | Smallest order the supplier accepts, in units | `200` |
| `delivery_days` | Working days from order to delivery | `2` |
| `quality_rating` | Your score out of 5 | `4.6` |
| `care_suitable` | `yes` or `no` — is it appropriate for elderly care? | `yes` |
| `certifications` | Shown to the manager as reassurance | `EN 455 / CE marked` |
| `notes` | Anything else worth knowing | `Latex-free. Sizes S-XL.` |

### Three columns that matter more than the rest

**`price_per_unit` must be per single unit.** If a case of 200 gloves costs £8.60, the price per unit is `0.043`, not `8.60`. Get this wrong and every total on screen is wrong.

**`typical_market_price` is where "you save £X" comes from.** If you leave it the same as your price, the platform honestly shows no saving rather than inventing one. Put a real benchmark in — what the home would pay buying it themselves.

**`care_suitable` and `quality_rating` are the safety rules.** Anything marked `no`, or rated below 3.5, can appear in the results but **can never be the top recommendation** — however cheap it is. Use this properly: mark down heavily perfumed skin products, latex gloves, thin aprons, undignified disposables. This is the promise the platform makes to residents.

### If a comma appears in your text

Wrap that cell in double quotes: `"Fragrance-free, soap-free"`. Excel does this for you automatically when you save as CSV.

## 2. The database (the platform owns this)

`sennicare.db` is created automatically the first time you run the app. It holds subscriber accounts, their care home profiles, their searches and their requests.

- **It is deliberately excluded from GitHub** (see `.gitignore`) because it contains real people's data.
- **Back it up by copying the file** somewhere safe. That's the whole backup — one file.
- Deleting it wipes every account and starts again from empty. Useful while testing, catastrophic once you have subscribers.
