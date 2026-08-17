"""
Sennicare - registration and login
==================================

HOW PASSWORDS ARE HANDLED (the important bit)
---------------------------------------------
We never store anyone's actual password. When someone registers we:

  1. Generate a "salt" - a long random string, different for every user.
  2. Scramble (password + salt) 240,000 times using a standard method called
     PBKDF2. The result is called a "hash".
  3. Store only the salt and the hash.

When they log in we scramble what they typed the same way and check whether the
result matches. This means:
  - Nobody - not you, not us, not anyone who obtained the database file - can
    read a subscriber's password.
  - Two people with the same password still get different hashes, because their
    salts differ.

This uses only Python's built-in "hashlib", so there is nothing extra to install.
"""

import hashlib
import hmac
import os
import re

from . import database


# How many times to scramble the password. Higher = slower to crack if the
# database were ever stolen. 240,000 is a sensible modern figure.
SCRAMBLE_ROUNDS = 240_000


def hash_password(password, salt=None):
    """
    Turns a password into a salt and a hash.
    Pass in an existing salt to check a login; leave it out to create a new user.
    """
    if salt is None:
        salt = os.urandom(16).hex()   # 16 random bytes, written as text

    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        SCRAMBLE_ROUNDS,
    )
    return salt, hashed.hex()


def passwords_match(typed_password, salt, stored_hash):
    """
    Checks a typed password against the stored hash.
    hmac.compare_digest compares the two safely - it always takes the same
    amount of time, which stops a certain kind of guessing attack.
    """
    _, hashed = hash_password(typed_password, salt)
    return hmac.compare_digest(hashed, stored_hash)


# ==========================================================================
# CHECKING WHAT SOMEONE TYPED
# ==========================================================================

def email_looks_valid(email):
    """Some characters, an @, some characters, a dot, some characters."""
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email.strip()))


def password_problem(password):
    """
    Returns a plain-English complaint about a password, or None if it's fine.
    We ask for 8+ characters with at least one letter and one number - enough to
    matter, not so fussy that a busy manager gives up.
    """
    if len(password) < 8:
        return "Your password needs to be at least 8 characters long."
    if not re.search(r"[A-Za-z]", password):
        return "Your password needs to include at least one letter."
    if not re.search(r"[0-9]", password):
        return "Your password needs to include at least one number."
    return None


# ==========================================================================
# REGISTER AND LOG IN
# Both return a pair: (worked?, message_or_user)
# ==========================================================================

def register(email, password, password_again, full_name):
    """
    Creates a new subscriber account.
    Returns (True, user_dictionary) or (False, "what went wrong").
    """
    email = email.strip()
    full_name = full_name.strip()

    if not full_name:
        return False, "Please enter your name."
    if not email_looks_valid(email):
        return False, "That email address doesn't look right. Please check it."
    if password != password_again:
        return False, "The two passwords don't match."

    complaint = password_problem(password)
    if complaint:
        return False, complaint

    salt, hashed = hash_password(password)

    connection = database.get_connection()
    try:
        with connection:
            cursor = connection.execute("""
                INSERT INTO users (email, password_hash, password_salt, full_name, tier, created_at)
                VALUES (?, ?, ?, ?, 'starter', ?)
            """, (email, hashed, salt, full_name, database.now_iso()))
            user_id = cursor.lastrowid
    except database.sqlite3.IntegrityError:
        # The email column is UNIQUE, so SQLite refuses a duplicate.
        connection.close()
        return False, "There is already an account using that email address. Try logging in."
    connection.close()

    return True, {"id": user_id, "email": email, "full_name": full_name, "tier": "starter"}


def log_in(email, password):
    """
    Checks an email and password.
    Returns (True, user_dictionary) or (False, "what went wrong").
    """
    email = email.strip()
    if not email or not password:
        return False, "Please enter your email address and password."

    connection = database.get_connection()
    row = connection.execute(
        "SELECT * FROM users WHERE email = ?", (email,)
    ).fetchone()
    connection.close()

    # We give the same message whether the email is unknown or the password is
    # wrong, so nobody can use this page to discover who has an account.
    if row is None or not passwords_match(password, row["password_salt"], row["password_hash"]):
        return False, "Email address or password not recognised."

    return True, {
        "id": row["id"],
        "email": row["email"],
        "full_name": row["full_name"],
        "tier": row["tier"],
    }


def change_password(user_id, current_password, new_password, new_password_again):
    """Lets a logged-in subscriber change their own password."""
    connection = database.get_connection()
    row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    connection.close()

    if row is None:
        return False, "Account not found."
    if not passwords_match(current_password, row["password_salt"], row["password_hash"]):
        return False, "Your current password is not correct."
    if new_password != new_password_again:
        return False, "The two new passwords don't match."

    complaint = password_problem(new_password)
    if complaint:
        return False, complaint

    salt, hashed = hash_password(new_password)
    connection = database.get_connection()
    with connection:
        connection.execute(
            "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
            (hashed, salt, user_id),
        )
    connection.close()
    return True, "Password changed."


def set_tier(user_id, tier):
    """
    Changes which subscription plan an account is on.
    For now this is done by you, by hand. When card payments are added, the
    payment provider will call this after a successful payment - which is why
    it lives here on its own.
    """
    connection = database.get_connection()
    with connection:
        connection.execute("UPDATE users SET tier = ? WHERE id = ?", (tier, user_id))
    connection.close()
