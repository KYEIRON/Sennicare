"""
Sennicare - the database
========================

Everything the platform remembers is stored in ONE file: sennicare.db
That file is a SQLite database. SQLite needs no server, no installation and no
setup - it is simply a file on disk, like a spreadsheet, that the app reads and
writes. Back it up by copying the file.

THE PRIVACY RULE OF THIS FILE
-----------------------------
Every table that holds a care home manager's information has a "user_id" column,
and EVERY query in this file filters by user_id. One manager can therefore never
see, edit or search another manager's data. That is what "your data is yours"
means in practice, and it is enforced here in one place rather than being
sprinkled around the app where it could be forgotten.

The tables:
  users     - one row per subscriber (login email, hashed password, tier)
  profiles  - one row per subscriber: their care home details
  searches  - a log of the searches they run (used for monthly fair-use limits)
  requests  - the supply requests they have generated and sent
"""

import sqlite3
import os
from datetime import datetime, timezone

# Where the database file lives: alongside this code, inside the "data" folder.
# os.path.dirname(__file__) means "the folder this Python file is in".
DATA_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DATABASE_FILE = os.path.join(DATA_FOLDER, "sennicare.db")


def get_connection():
    """
    Opens the database file and hands back a connection to it.

    check_same_thread=False is needed because Streamlit runs our code on
    different internal threads. row_factory makes rows behave like dictionaries,
    so we can write row["care_home_name"] instead of remembering column numbers.
    """
    os.makedirs(DATA_FOLDER, exist_ok=True)   # create the data folder if missing
    connection = sqlite3.connect(DATABASE_FILE, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")   # enforce the user_id links
    return connection


def now_iso():
    """Today's date and time, stored in a sortable standard format."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def set_up_database():
    """
    Creates the tables the first time the app runs.
    "IF NOT EXISTS" means running this again is harmless - nothing is deleted.
    Safe to call every time the app starts.
    """
    connection = get_connection()
    with connection:
        # ---- Subscribers -------------------------------------------------
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                email          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
                password_hash  TEXT    NOT NULL,
                password_salt  TEXT    NOT NULL,
                full_name      TEXT    NOT NULL DEFAULT '',
                tier           TEXT    NOT NULL DEFAULT 'starter',
                created_at     TEXT    NOT NULL
            )
        """)

        # ---- Their care home profile (one per subscriber) -----------------
        connection.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                user_id          INTEGER PRIMARY KEY,
                care_home_name   TEXT NOT NULL DEFAULT '',
                address          TEXT NOT NULL DEFAULT '',
                city             TEXT NOT NULL DEFAULT '',
                postcode         TEXT NOT NULL DEFAULT '',
                country          TEXT NOT NULL DEFAULT 'United Kingdom',
                currency         TEXT NOT NULL DEFAULT 'GBP',
                contact_name     TEXT NOT NULL DEFAULT '',
                contact_email    TEXT NOT NULL DEFAULT '',
                contact_phone    TEXT NOT NULL DEFAULT '',
                beds             INTEGER NOT NULL DEFAULT 0,
                quality_standards TEXT NOT NULL DEFAULT '',
                payment_terms    TEXT NOT NULL DEFAULT '30 days from invoice',
                delivery_notes   TEXT NOT NULL DEFAULT '',
                updated_at       TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # ---- A log of searches, used for monthly fair-use limits ----------
        connection.execute("""
            CREATE TABLE IF NOT EXISTS searches (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      INTEGER NOT NULL,
                product      TEXT    NOT NULL,
                quantity     INTEGER NOT NULL,
                budget       REAL,
                within_days  INTEGER,
                results_found INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT    NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # ---- Supply requests they have generated --------------------------
        connection.execute("""
            CREATE TABLE IF NOT EXISTS requests (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id        INTEGER NOT NULL,
                supplier_name  TEXT NOT NULL,
                supplier_email TEXT NOT NULL DEFAULT '',
                product_name   TEXT NOT NULL,
                quantity       INTEGER NOT NULL,
                unit_price     REAL NOT NULL,
                total_cost     REAL NOT NULL,
                currency       TEXT NOT NULL DEFAULT 'GBP',
                delivery_days  INTEGER NOT NULL DEFAULT 0,
                needed_by      TEXT NOT NULL DEFAULT '',
                message        TEXT NOT NULL,
                status         TEXT NOT NULL DEFAULT 'Draft',
                created_at     TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # Indexes make "find everything belonging to this user" fast.
        connection.execute("CREATE INDEX IF NOT EXISTS idx_searches_user ON searches(user_id)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id)")

    connection.close()


# ==========================================================================
# PROFILE - read and write one manager's care home details
# Note how user_id is passed in every single time and used in every WHERE
# clause. There is no way to fetch a profile without saying whose it is.
# ==========================================================================

# The details we keep about a care home. Listed once here so the app, the
# database and the request-writing code can never drift out of step.
PROFILE_FIELDS = [
    "care_home_name", "address", "city", "postcode", "country", "currency",
    "contact_name", "contact_email", "contact_phone", "beds",
    "quality_standards", "payment_terms", "delivery_notes",
]


def get_profile(user_id):
    """Returns this user's care home profile as a dictionary (empty if not set up yet)."""
    connection = get_connection()
    row = connection.execute(
        "SELECT * FROM profiles WHERE user_id = ?", (user_id,)
    ).fetchone()
    connection.close()

    if row is None:
        # No profile saved yet - hand back a blank one so the form still works.
        blank = {field: "" for field in PROFILE_FIELDS}
        blank["country"] = "United Kingdom"
        blank["currency"] = "GBP"
        blank["payment_terms"] = "30 days from invoice"
        blank["beds"] = 0
        return blank

    return dict(row)


def save_profile(user_id, values):
    """
    Saves (or updates) this user's care home profile.
    "INSERT ... ON CONFLICT ... DO UPDATE" means: create the row if it's new,
    otherwise overwrite the existing one. One row per user, always.
    """
    columns = ", ".join(PROFILE_FIELDS)
    placeholders = ", ".join("?" for _ in PROFILE_FIELDS)
    updates = ", ".join(f"{field} = excluded.{field}" for field in PROFILE_FIELDS)

    data = [user_id] + [values.get(field, "") for field in PROFILE_FIELDS] + [now_iso()]

    connection = get_connection()
    with connection:
        connection.execute(f"""
            INSERT INTO profiles (user_id, {columns}, updated_at)
            VALUES (?, {placeholders}, ?)
            ON CONFLICT(user_id) DO UPDATE SET {updates}, updated_at = excluded.updated_at
        """, data)
    connection.close()


def profile_is_complete(profile):
    """
    True when the profile has the details we need to write a supply request.
    Used to nudge a new subscriber to fill their profile in before searching.
    """
    required = ["care_home_name", "address", "city", "postcode", "contact_name", "contact_email"]
    return all(str(profile.get(field, "")).strip() for field in required)


# ==========================================================================
# SEARCHES - logged so we can apply fair-use limits per subscription tier
# ==========================================================================

def log_search(user_id, product, quantity, budget, within_days, results_found):
    """Records that this user ran a search. Never records any other user's."""
    connection = get_connection()
    with connection:
        connection.execute("""
            INSERT INTO searches (user_id, product, quantity, budget, within_days,
                                  results_found, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, product, quantity, budget, within_days, results_found, now_iso()))
    connection.close()


def count_searches_this_month(user_id):
    """
    How many searches this user has run since the 1st of the current month.
    Used to enforce the Starter tier's monthly allowance.
    """
    first_of_month = datetime.now(timezone.utc).strftime("%Y-%m-01")
    connection = get_connection()
    row = connection.execute(
        "SELECT COUNT(*) AS total FROM searches WHERE user_id = ? AND created_at >= ?",
        (user_id, first_of_month),
    ).fetchone()
    connection.close()
    return row["total"]


# ==========================================================================
# REQUESTS - the supply requests a manager has generated
# ==========================================================================

def save_request(user_id, request):
    """Saves a generated supply request to this user's own history."""
    connection = get_connection()
    with connection:
        cursor = connection.execute("""
            INSERT INTO requests (user_id, supplier_name, supplier_email, product_name,
                                  quantity, unit_price, total_cost, currency,
                                  delivery_days, needed_by, message, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            request["supplier_name"], request.get("supplier_email", ""),
            request["product_name"], request["quantity"],
            request["unit_price"], request["total_cost"],
            request.get("currency", "GBP"),
            request.get("delivery_days", 0), request.get("needed_by", ""),
            request["message"], request.get("status", "Sent"), now_iso(),
        ))
        new_id = cursor.lastrowid
    connection.close()
    return new_id


def list_requests(user_id):
    """All of this user's requests, newest first. Only ever theirs."""
    connection = get_connection()
    rows = connection.execute(
        "SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


def update_request_status(user_id, request_id, status):
    """
    Changes a request's status (e.g. Sent -> Delivered).
    The user_id in the WHERE clause means a user cannot alter someone else's
    request even if they somehow guessed its id number.
    """
    connection = get_connection()
    with connection:
        connection.execute(
            "UPDATE requests SET status = ? WHERE id = ? AND user_id = ?",
            (status, request_id, user_id),
        )
    connection.close()


def delete_request(user_id, request_id):
    """Deletes one of this user's own requests."""
    connection = get_connection()
    with connection:
        connection.execute(
            "DELETE FROM requests WHERE id = ? AND user_id = ?", (request_id, user_id)
        )
    connection.close()


def export_user_data(user_id):
    """
    Everything we hold about one subscriber, so they can take a copy at any time
    (a requirement under UK GDPR, and simply good manners).
    """
    connection = get_connection()
    account = connection.execute(
        "SELECT id, email, full_name, tier, created_at FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    searches = connection.execute(
        "SELECT * FROM searches WHERE user_id = ? ORDER BY created_at", (user_id,)
    ).fetchall()
    connection.close()

    return {
        "account": dict(account) if account else {},
        "care_home_profile": get_profile(user_id),
        "searches": [dict(row) for row in searches],
        "requests": list_requests(user_id),
    }


def delete_account(user_id):
    """
    Deletes a subscriber and everything belonging to them.
    ON DELETE CASCADE on the other tables removes their profile, searches and
    requests automatically.
    """
    connection = get_connection()
    with connection:
        connection.execute("DELETE FROM users WHERE id = ?", (user_id,))
    connection.close()
