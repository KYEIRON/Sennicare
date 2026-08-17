"""
Sennicare - the supplier catalogue
==================================

The catalogue is a single spreadsheet file. The platform reads it; it never
writes to it. That means YOU own the supplier data and can edit it in Excel.

WHICH FILE IS USED
------------------
  data/suppliers.csv         <- used if it exists (YOUR REAL DATA goes here)
  data/suppliers_sample.csv  <- used otherwise (fictional example data)

So: build up your real catalogue as data/suppliers.csv and the platform will
switch over to it automatically, with no code changes. The sample file stays put
as a reference for the column layout.

THE COLUMNS (all required)
--------------------------
  supplier_name         Who sells it
  supplier_email        Where a request should be sent
  product_name          What it is
  category              e.g. PPE, Continence, Oral Care
  keywords              Extra words managers might search for, separated by spaces
  unit_description      What ONE unit is, e.g. "glove", "75ml tube", "pad"
  pack_size             How many units come in a case (orders round up to whole cases)
  price_per_unit        Price of one unit
  typical_market_price  What one unit normally costs elsewhere - this is what
                        makes "you save £X" possible, so fill it in honestly
  min_order_units       Smallest order the supplier accepts, in units
  delivery_days         Working days from order to delivery
  quality_rating        Your own score out of 5
  care_suitable         "yes" or "no" - is this appropriate for elderly care?
  certifications        e.g. "EN 455 / CE marked". Shown to the manager.
  notes                 Anything else worth knowing. Shown to the manager.
"""

import os
import pandas as pd


DATA_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
REAL_CATALOGUE = os.path.join(DATA_FOLDER, "suppliers.csv")
SAMPLE_CATALOGUE = os.path.join(DATA_FOLDER, "suppliers_sample.csv")

# The columns we must have to work. Loading fails clearly if any are missing.
REQUIRED_COLUMNS = [
    "supplier_name", "supplier_email", "product_name", "category", "keywords",
    "unit_description", "pack_size", "price_per_unit", "typical_market_price",
    "min_order_units", "delivery_days", "quality_rating", "care_suitable",
    "certifications", "notes",
]

# Below this score out of 5, we will not put a product forward as our top
# recommendation - however cheap it is. See PRINCIPLE 2 in the project notes.
QUALITY_FLOOR = 3.5


def which_catalogue_file():
    """
    Returns (file path, is_real_data).
    is_real_data is False when we've fallen back to the fictional sample, which
    the app uses to show an honest warning banner.
    """
    if os.path.exists(REAL_CATALOGUE):
        return REAL_CATALOGUE, True
    return SAMPLE_CATALOGUE, False


def load_catalogue():
    """
    Reads the catalogue spreadsheet and tidies it up.
    Returns (DataFrame, is_real_data). A "DataFrame" is just a table in memory.
    """
    path, is_real = which_catalogue_file()

    if not os.path.exists(path):
        raise FileNotFoundError(
            f"No supplier catalogue found. Expected {REAL_CATALOGUE} or {SAMPLE_CATALOGUE}."
        )

    table = pd.read_csv(path)

    # --- Check the columns are all there ---
    missing = [column for column in REQUIRED_COLUMNS if column not in table.columns]
    if missing:
        raise ValueError(
            "Your supplier file is missing these columns: " + ", ".join(missing) +
            ". Compare it with data/suppliers_sample.csv."
        )

    # --- Tidy up: make sure numbers are numbers and text is text ---
    number_columns = ["pack_size", "price_per_unit", "typical_market_price",
                      "min_order_units", "delivery_days", "quality_rating"]
    for column in number_columns:
        # errors="coerce" turns anything unreadable into "missing" rather than crashing
        table[column] = pd.to_numeric(table[column], errors="coerce")

    text_columns = ["supplier_name", "supplier_email", "product_name", "category",
                    "keywords", "unit_description", "care_suitable", "certifications", "notes"]
    for column in text_columns:
        table[column] = table[column].fillna("").astype(str).str.strip()

    # --- Drop rows that are unusable, and fill sensible defaults ---
    table = table.dropna(subset=["price_per_unit"])
    table = table[table["product_name"] != ""]

    table["pack_size"] = table["pack_size"].fillna(1).clip(lower=1)
    table["min_order_units"] = table["min_order_units"].fillna(1).clip(lower=1)
    table["delivery_days"] = table["delivery_days"].fillna(7).clip(lower=0)
    table["quality_rating"] = table["quality_rating"].fillna(3.0).clip(lower=0, upper=5)
    # If no market price is given, assume the supplier's own price is normal
    # (so we show a saving of zero rather than inventing one).
    table["typical_market_price"] = table["typical_market_price"].fillna(table["price_per_unit"])

    # A "yes"/"no" column becomes a proper True/False column
    table["care_suitable_flag"] = table["care_suitable"].str.lower().isin(["yes", "y", "true", "1"])

    # Three lower-case columns for searching. They are kept separate because a
    # word found in the PRODUCT NAME is a much stronger match than the same word
    # found in the category - see matching.py, which weights them differently.
    table["name_text"] = table["product_name"].str.lower()
    table["keywords_text"] = table["keywords"].str.lower()
    table["category_text"] = table["category"].str.lower()

    # Everything searchable in one column, used for quick "does this row mention
    # the word at all?" checks.
    table["search_text"] = (
        table["name_text"] + " " + table["category_text"] + " " + table["keywords_text"]
    )

    table = table.reset_index(drop=True)
    return table, is_real


def categories(table):
    """A sorted list of the categories in the catalogue, for the filter dropdown."""
    return sorted(category for category in table["category"].unique() if category)


def suppliers(table):
    """A sorted list of every supplier in the catalogue."""
    return sorted(supplier for supplier in table["supplier_name"].unique() if supplier)


def catalogue_summary(table):
    """A few headline numbers about the catalogue, for the admin page."""
    return {
        "products": int(table["product_name"].nunique()),
        "suppliers": int(table["supplier_name"].nunique()),
        "categories": int(table["category"].nunique()),
        "rows": int(len(table)),
    }
