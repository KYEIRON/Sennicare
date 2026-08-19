"""
============================================================================
SENNICARE - the procurement platform for care home managers
============================================================================

WHAT THIS FILE IS
-----------------
Every screen a care home manager sees. The working parts it uses (the database,
the search engine, the request writer) live in the "sennicare" folder next door,
each in its own file. The design lives in sennicare/branding.py.

HOW TO RUN IT
-------------
  1. Open a terminal in this folder
  2. Type:  streamlit run app.py
  3. It opens in your web browser

THE SCREENS
-----------
  Not signed in ....... Welcome / Sign in / Create account
  Signed in ........... Dashboard          - greeting, savings, quick search
                        Search Suppliers   - filters, results, top recommendation
                        Review & Send      - the written request (reached by
                                             choosing a supplier)
                        My Requests        - what they've sent
                        Saved Suppliers    - bookmarks
                        Care Home Profile  - their private details
                        Subscription       - their plan
                        My Account         - password, data, deletion
                        Admin              - you only

A NOTE ON HOW STREAMLIT WORKS
-----------------------------
Streamlit re-runs this whole file from top to bottom every time someone clicks
something. Anything that must survive a click is kept in "st.session_state",
which is a small box of memory that persists between clicks.
============================================================================
"""

import html
import json
import os

import pandas as pd
import streamlit as st

from sennicare import (
    auth,
    branding,
    catalogue as catalogue_module,
    database,
    matching,
    money,
    request_writer,
    subscriptions,
)


# ==========================================================================
# SETUP - runs once each time the page loads
# ==========================================================================

st.set_page_config(
    page_title="Sennicare | Care Home Procurement",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded",
)

database.set_up_database()      # creates the tables on the very first run
branding.apply_branding()       # paints on the Sennicare design


# The menu. Each entry is (icon, page name).
MENU = [
    "Dashboard",
    "Search Suppliers",
    "My Requests",
    "Saved Suppliers",
    "Care Home Profile",
    "Subscription",
    "My Account",
]
ADMIN_MENU = "Admin"


# Which email addresses can see the Admin page. Set this on your computer with:
#   SENNICARE_ADMIN_EMAILS="you@sennicare.co.uk"
# If it isn't set, the very first account created (user number 1) is the admin.
ADMIN_EMAILS = [
    email.strip().lower()
    for email in os.environ.get("SENNICARE_ADMIN_EMAILS", "").split(",")
    if email.strip()
]


def is_admin(user):
    """True if this signed-in user should see the Admin page."""
    if ADMIN_EMAILS:
        return user["email"].lower() in ADMIN_EMAILS
    return user["id"] == 1


@st.cache_data(show_spinner=False)
def get_catalogue():
    """
    Loads the supplier spreadsheet.
    @st.cache_data means "read the file once, then remember it", which keeps the
    app fast. The Admin page has a button to re-read it after you edit it.
    """
    return catalogue_module.load_catalogue()


def escape(text):
    """Makes text safe to put inside our HTML cards."""
    return html.escape(str(text))


# ==========================================================================
# MEMORY BETWEEN CLICKS
# ==========================================================================

DEFAULT_STATE = {
    "user": None,            # who is signed in
    "page": "Dashboard",     # which screen we're on
    "results": None,         # the last search's results
    "search_inputs": None,   # what they typed into the search
    "chosen": None,          # the supplier option they picked
    "pending_search": None,  # a search started from the dashboard
    "flash": None,           # a message to show after the page refreshes
}

for key, value in DEFAULT_STATE.items():
    if key not in st.session_state:
        st.session_state[key] = value


def go_to(page):
    """Moves to another screen."""
    st.session_state.page = page


def flash(message, kind="success"):
    """
    Leaves a message to be shown AFTER the page refreshes.

    Streamlit throws the screen away and redraws it when you click something, so
    a message shown just before a refresh vanishes before it can be read. This
    leaves a note instead, and show_flash() prints it on the way back in.
    """
    st.session_state.flash = (message, kind)


def show_flash():
    """Prints and clears any message left by flash()."""
    note = st.session_state.flash
    if not note:
        return
    st.session_state.flash = None
    message, kind = note
    if kind == "success":
        st.success(message, icon="✅")
    elif kind == "error":
        st.error(message)
    else:
        st.info(message)


def sign_out():
    """Clears the session and returns to the welcome screen."""
    for key in list(DEFAULT_STATE.keys()):
        st.session_state[key] = DEFAULT_STATE[key]


# ==========================================================================
# THE WELCOME SCREEN (nobody signed in)
# ==========================================================================

def show_welcome_screen():
    left, right = st.columns([1.15, 1], gap="large")

    with left:
        st.markdown(
            '<div style="display:flex;align-items:center;gap:11px;margin-bottom:26px">'
            f"{branding.LOGO_SVG}"
            f'<span style="font-size:26px;font-weight:800;color:{branding.NAVY};'
            'letter-spacing:-0.02em">Sennicare</span></div>',
            unsafe_allow_html=True,
        )

        st.markdown(
            '<h1 style="font-size:40px;line-height:1.15;margin:0 0 14px">'
            "Find the right supplies.<br>In under three minutes.</h1>"
            f'<p style="font-size:18px;color:{branding.TEXT_BODY};max-width:560px;margin:0 0 30px">'
            "Procurement built only for care homes. Search once, compare every supplier "
            "side by side, and send a professional request without typing your details twice."
            "</p>",
            unsafe_allow_html=True,
        )

        # The four steps, as calm numbered cards
        steps = [
            ("1", "Tell us what you need",
             "Product, quantity, budget, and when you need it."),
            ("2", "See every option instantly",
             "Price, delivery time and a quality rating for elderly care, side by side. "
             "No emails, no waiting for quotes."),
            ("3", "We flag the best choice",
             "Weighing price, speed and quality equally. We never recommend the cheapest "
             "option if it isn't right for your residents."),
            ("4", "Send the request in one click",
             "We write it, pre-filled from your profile. You edit it if you like, then send."),
        ]
        for number, title, description in steps:
            st.markdown(
                '<div style="display:flex;gap:16px;margin-bottom:18px">'
                f'<div style="flex-shrink:0;width:34px;height:34px;border-radius:10px;'
                f'background:rgba(0,178,217,0.12);color:{branding.CYAN};display:flex;'
                f'align-items:center;justify-content:center;font-weight:800;font-size:15px">'
                f"{number}</div>"
                "<div>"
                f'<div style="font-weight:700;color:{branding.NAVY};font-size:16px;'
                f'margin-bottom:2px">{title}</div>'
                f'<div style="font-size:14.5px;color:{branding.TEXT_MUTED};line-height:1.55">'
                f"{description}</div>"
                "</div></div>",
                unsafe_allow_html=True,
            )

        branding.privacy_card()

    with right:
        st.markdown('<div style="height:78px"></div>', unsafe_allow_html=True)
        with branding.panel():

            sign_in_tab, register_tab = st.tabs(["Sign in", "Create an account"])

            # ---------------- SIGN IN ----------------
            with sign_in_tab:
                with st.form("sign_in_form"):
                    email = st.text_input("Email address")
                    password = st.text_input("Password", type="password")
                    submitted = st.form_submit_button(
                        "Sign in", use_container_width=True, type="primary"
                    )

                if submitted:
                    worked, result = auth.log_in(email, password)
                    if worked:
                        st.session_state.user = result
                        st.session_state.page = "Dashboard"
                        st.rerun()
                    else:
                        st.error(result)

            # ------------- CREATE ACCOUNT -------------
            with register_tab:
                st.caption(
                    "Free Forever plan, £0/month. No card needed — create an account "
                    "and start searching straight away."
                )
                with st.form("register_form"):
                    full_name = st.text_input("Your name")
                    new_email = st.text_input("Email address")
                    new_password = st.text_input(
                        "Choose a password", type="password",
                        help="At least 8 characters, including a letter and a number.",
                    )
                    new_password_again = st.text_input("Type your password again", type="password")
                    agreed = st.checkbox(
                        "I understand my care home data is stored in my private Sennicare account."
                    )
                    registered = st.form_submit_button(
                        "Create my account", use_container_width=True, type="primary"
                    )

                if registered:
                    if not agreed:
                        st.error("Please tick the box to continue.")
                    else:
                        worked, result = auth.register(
                            new_email, new_password, new_password_again, full_name
                        )
                        if worked:
                            st.session_state.user = result
                            st.session_state.page = "Care Home Profile"
                            flash("Account created. Let's set up your care home.")
                            st.rerun()
                        else:
                            st.error(result)


        # The plans, quietly, underneath
        st.markdown(
            f'<p style="font-size:13px;color:{branding.TEXT_MUTED};text-align:center;'
            'margin-top:6px">'
            + " &nbsp;·&nbsp; ".join(
                f"<strong>{plan['name']}</strong> £{plan['monthly_price']}/mo"
                for plan in subscriptions.PLANS
            )
            + "</p>",
            unsafe_allow_html=True,
        )


# ==========================================================================
# THE SIDEBAR
# ==========================================================================

def show_sidebar(user, profile):
    with st.sidebar:
        st.markdown(
            '<div style="display:flex;align-items:center;gap:10px;padding:6px 0 20px">'
            f"{branding.LOGO_SVG_LIGHT}"
            '<span style="font-size:22px;font-weight:800;color:#FFFFFF;'
            'letter-spacing:-0.02em">Sennicare</span></div>',
            unsafe_allow_html=True,
        )

        # ---- Who is signed in ----
        home_name = profile.get("care_home_name") or "Your care home"
        plan = subscriptions.get_plan(user["tier"])
        used = database.count_searches_this_month(user["id"])
        left = subscriptions.searches_left(user["tier"], used)
        allowance = "Unlimited searches" if left is None else f"{left} searches left"

        st.markdown(
            '<div style="background:rgba(255,255,255,0.07);border-radius:12px;'
            'padding:14px 16px;margin-bottom:18px">'
            f'<div style="color:#FFFFFF;font-weight:700;font-size:15px;line-height:1.35">'
            f"{escape(home_name)}</div>"
            f'<div style="color:rgba(255,255,255,0.6);font-size:12.5px;margin-top:4px">'
            f"{escape(user['email'])}</div>"
            f'<div style="color:{branding.CYAN};font-size:12.5px;font-weight:600;'
            f'margin-top:8px">{plan["name"]} · {allowance}</div>'
            "</div>",
            unsafe_allow_html=True,
        )

        # ---- The menu ----
        menu = list(MENU)
        if is_admin(user):
            menu.append(ADMIN_MENU)

        # "Review & Send" isn't in the menu - it's reached by choosing a supplier
        # - so while we're on it, keep Search Suppliers highlighted.
        current = st.session_state.page
        if current == "Review & Send":
            current = "Search Suppliers"

        # Each row is a button. The one for the current page is marked "primary",
        # which the stylesheet draws as the highlighted pill.
        for name in menu:
            if st.button(
                name,
                key=f"nav_{name}",
                use_container_width=True,
                type="primary" if name == current else "secondary",
            ):
                go_to(name)
                st.rerun()

        st.markdown("---")
        if st.button("Sign out", use_container_width=True):
            sign_out()
            st.rerun()


# ==========================================================================
# DRAWING A SUPPLIER OPTION AS A CARD
# ==========================================================================

def option_card_html(option, currency, style="option", label=None, why=None, saved=False):
    """
    Builds the HTML for one product card.

    style: "top"     the recommendation - magenta edge and price
           "option"  a normal alternative
           "warn"    outside their budget or delivery date
           "blocked" not suitable for elderly care - never recommended
    """
    is_top = style == "top"
    card_class = {
        "top": "sc-card sc-card--top",
        "blocked": "sc-card sc-card--blocked",
    }.get(style, "sc-card")

    chip_class = {
        "top": "sc-chip sc-chip--top",
        "warn": "sc-chip sc-chip--warn",
        "blocked": "sc-chip sc-chip--blocked",
    }.get(style, "sc-chip sc-chip--option")

    parts = [f'<div class="{card_class}">']

    # The tinted product tile
    parts.append(branding.product_tile(option["category"], "magenta" if is_top else "cyan"))

    if label:
        parts.append(f'<span class="{chip_class}">{escape(label)}</span>')
    if saved:
        parts.append('<span class="sc-chip sc-chip--saved" style="margin-left:6px">Saved</span>')

    parts.append(f'<div class="sc-card__product">{escape(option["product_name"])}</div>')
    parts.append(f'<div class="sc-card__supplier">{escape(option["supplier_name"])}</div>')

    # Total cost, large
    price_class = "sc-card__price sc-card__price--top" if is_top else "sc-card__price"
    parts.append(f'<div class="{price_class}">{money.money(option["total_cost"], currency)}</div>')
    parts.append(
        f'<div class="sc-card__unit">total &middot; '
        f'{money.money(option["price_per_unit"], currency)} per {escape(option["unit_description"])}</div>'
    )

    # The saving, if there is one
    if option["saving"] > 0:
        parts.append(
            f'<div class="sc-save-badge">Saves {money.money(option["saving"], currency)} '
            f'({option["saving_percent"]:.0f}%)</div>'
        )

    # The detail rows
    delivery = "Same day" if option["delivery_days"] == 0 else (
        "Next working day" if option["delivery_days"] == 1
        else f'{option["delivery_days"]} working days'
    )
    rows = [
        ("Delivery", delivery),
        ("Quality for elderly care", f'{option["quality_rating"]:.1f} / 5'),
        ("Units billed", f'{option["billed_units"]:,}'),
    ]
    if option["pack_size"] > 1:
        rows.append(("Cases", f'{option["cases"]} × {option["pack_size"]}'))
    if option["certifications"] and option["certifications"].lower() != "none listed":
        rows.append(("Standard", option["certifications"]))

    parts.append('<div class="sc-rows">')
    for row_label, row_value in rows:
        parts.append(
            f'<div class="sc-row"><span class="sc-row__label">{escape(row_label)}</span>'
            f'<span class="sc-row__value">{escape(row_value)}</span></div>'
        )
    parts.append("</div>")

    # Why we chose it (top recommendation only)
    if why:
        parts.append(f'<div class="sc-why">{escape(why)}</div>')

    # Warnings
    if not option["care_suitable"]:
        parts.append(
            '<div class="sc-note sc-note--warn"><strong>Not suitable for elderly care.</strong> '
            "We will not recommend this, whatever it costs.</div>"
        )
    elif option["quality_rating"] < catalogue_module.QUALITY_FLOOR:
        parts.append(
            '<div class="sc-note sc-note--warn">Below our quality standard for elderly care, '
            "so it is never recommended.</div>"
        )

    limits = []
    if option["over_budget"]:
        limits.append("over your budget")
    if option["too_slow"]:
        limits.append("slower than your delivery date")
    if limits:
        parts.append(f'<div class="sc-note sc-note--warn">This one is {" and ".join(limits)}.</div>')

    if option["extra_units"] > 0:
        parts.append(
            f'<div class="sc-note">{option["extra_units"]:,} more than you asked for, '
            "because of pack sizes.</div>"
        )

    if option["notes"]:
        parts.append(f'<div class="sc-note">{escape(option["notes"])}</div>')

    # The three scores
    parts.append(branding.score_bars(option, is_top))

    parts.append("</div>")
    return "".join(parts)


def option_buttons(user, option, key_suffix, primary=False):
    """
    The buttons under a product card: choose this supplier, and bookmark it.
    Streamlit can't put a button inside our own HTML, so they sit directly
    beneath the card and read as part of it.
    """
    choose_column, save_column = st.columns([2.4, 1])

    with choose_column:
        if st.button(
            "Choose & write request" if primary else "Choose",
            key=f"choose_{key_suffix}",
            use_container_width=True,
            type="primary" if primary else "secondary",
        ):
            st.session_state.chosen = option
            go_to("Review & Send")
            st.rerun()

    with save_column:
        already_saved = database.is_supplier_saved(
            user["id"], option["supplier_name"], option["product_name"]
        )
        if st.button(
            "★" if already_saved else "☆",
            key=f"save_{key_suffix}",
            use_container_width=True,
            help="Remove from Saved Suppliers" if already_saved else "Save this supplier",
        ):
            if already_saved:
                for saved in database.list_saved_suppliers(user["id"]):
                    if (saved["supplier_name"] == option["supplier_name"]
                            and saved["product_name"] == option["product_name"]):
                        database.delete_saved_supplier(user["id"], saved["id"])
                flash("Removed from Saved Suppliers.", "info")
            else:
                database.save_supplier(user["id"], option)
                flash(f"{option['supplier_name']} saved.")
            st.rerun()


# ==========================================================================
# SCREEN: DASHBOARD
# ==========================================================================

def show_dashboard(user, profile):
    show_flash()

    first_name = (user["full_name"] or user["email"]).split()[0]
    plan = subscriptions.get_plan(user["tier"])
    figures = database.dashboard_figures(user["id"])
    currency = profile.get("currency") or money.DEFAULT_CURRENCY

    left, right = st.columns([1, 2], gap="large")

    # ---------------- LEFT: greeting and savings ----------------
    with left:
        branding.welcome_card(
            escape(first_name), escape(profile.get("care_home_name", "")), plan["name"]
        )

        # What they've saved. We only ever claim savings we can point at:
        # the difference between what they were quoted and typical prices, on
        # requests they actually saved.
        if figures["requests_quarter"]:
            st.markdown(
                '<div class="sc-savings">'
                f'<div class="sc-stat__label">Ordered · last 90 days</div>'
                f'<div class="sc-stat__value" style="color:{branding.GREEN}">'
                f'{money.money(figures["spend_quarter"], currency, pence=False)}</div>'
                f'<div class="sc-stat__note">across {figures["requests_quarter"]} '
                f'request{"s" if figures["requests_quarter"] != 1 else ""}</div>'
                "</div>",
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                '<div class="sc-savings">'
                '<div class="sc-stat__label">Your savings</div>'
                f'<div class="sc-stat__value" style="color:{branding.GREEN};font-size:22px">'
                "Run your first search</div>"
                '<div class="sc-stat__note">Every option shows what it saves against '
                "typical market prices.</div>"
                "</div>",
                unsafe_allow_html=True,
            )

        # Nudge to finish the profile, since the request depends on it
        if not database.profile_is_complete(profile):
            st.info(
                "Finish your care home profile and every request will fill itself in.",
                icon="ℹ️",
            )
            if st.button("Complete my profile", use_container_width=True):
                go_to("Care Home Profile")
                st.rerun()

    # ---------------- RIGHT: the quick search ----------------
    with right:
        with branding.panel("What do you need?",
            "Rough figures are fine. You'll see every option we have, straight away."):

            with st.form("dashboard_search"):
                product = st.text_input(
                    "Product", placeholder="e.g. gloves, toothpaste, continence pads",
                    label_visibility="collapsed",
                )

                columns = st.columns(3)
                with columns[0]:
                    quantity = st.number_input("Quantity", min_value=1, value=100, step=10)
                with columns[1]:
                    budget = st.number_input(
                        f"Budget ({money.symbol_for(currency)}) — 0 for no limit",
                        min_value=0.0, value=0.0, step=10.0,
                    )
                with columns[2]:
                    when_text = st.selectbox("Delivery by", list(WHEN_OPTIONS.keys()), index=2)

                searched = st.form_submit_button(
                    "Find suppliers", use_container_width=True, type="primary"
                )


        if searched:
            if not product.strip():
                st.error("Please type what you need — for example 'gloves'.")
            else:
                # Hand the search over to the Search Suppliers screen
                st.session_state.pending_search = {
                    "product": product, "quantity": int(quantity),
                    "budget": budget if budget > 0 else None,
                    "when_text": when_text,
                }
                go_to("Search Suppliers")
                st.rerun()

    # ---------------- A row of figures ----------------
    st.markdown('<div style="height:6px"></div>', unsafe_allow_html=True)
    stats = st.columns(4, gap="medium")

    with stats[0]:
        branding.stat_card(
            "Searches this month",
            str(database.count_searches_this_month(user["id"])),
            "Unlimited on your plan" if subscriptions.search_allowance(user["tier"]) is None
            else f'of {subscriptions.search_allowance(user["tier"])} included',
        )
    with stats[1]:
        branding.stat_card("Requests sent", str(figures["requests_all_time"]), "all time")
    with stats[2]:
        branding.stat_card(
            "Total ordered", money.money(figures["spend_all_time"], currency, pence=False),
            "all time", tone="save",
        )
    with stats[3]:
        branding.stat_card(
            "Saved suppliers", str(figures["saved_suppliers"]),
            "bookmarked for next time", tone="accent",
        )

    # ---------------- Recent activity ----------------
    if figures["recent_searches"]:
        st.markdown('<div style="height:14px"></div>', unsafe_allow_html=True)
        with branding.panel("Recent searches", "Pick one up again in a click."):

            for number, search in enumerate(figures["recent_searches"]):
                row = st.columns([3, 1.4, 1])
                row[0].markdown(
                    f'<div style="padding-top:6px;font-weight:600;color:{branding.NAVY}">'
                    f'{escape(search["product"])}</div>',
                    unsafe_allow_html=True,
                )
                row[1].markdown(
                    f'<div style="padding-top:8px;font-size:14px;color:{branding.TEXT_MUTED}">'
                    f'{search["quantity"]:,} units · {money.uk_date(search["created_at"])}</div>',
                    unsafe_allow_html=True,
                )
                if row[2].button("Search again", key=f"again_{number}", use_container_width=True):
                    st.session_state.pending_search = {
                        "product": search["product"], "quantity": search["quantity"],
                        "budget": None, "when_text": "Within 1 week",
                    }
                    go_to("Search Suppliers")
                    st.rerun()


    branding.privacy_line()


# ==========================================================================
# SCREEN: SEARCH SUPPLIERS
# ==========================================================================

# How soon they need it, and what that means in working days
WHEN_OPTIONS = {
    "As soon as possible": 1,
    "Within 3 days": 3,
    "Within 1 week": 7,
    "Within 2 weeks": 14,
    "Within a month": 30,
    "No deadline": None,
}


def run_search(user, table, product, quantity, budget, within_days, category,
               minimum_quality, supplier):
    """Runs a search, remembers the results, and logs it against this user."""
    results = matching.search(
        table, product, int(quantity),
        budget=budget, within_days=within_days, category=category,
    )

    # The refine filters are applied after scoring, so the scores stay relative
    # to everything that genuinely matched.
    if minimum_quality > 0 or (supplier and supplier != "All suppliers"):
        kept = [
            option for option in results["options"]
            if option["quality_rating"] >= minimum_quality
            and (not supplier or supplier == "All suppliers"
                 or option["supplier_name"] == supplier)
        ]
        results["options"] = kept
        results["matches_found"] = len(kept)
        results["within_limits"] = [o for o in kept if o["within_limits"]]
        results["outside_limits"] = [o for o in kept if not o["within_limits"]]
        if results["recommendation"] not in kept:
            results["recommendation"], results["reason"] = matching.choose_recommendation(kept)
        results["cheapest"] = min(kept, key=lambda o: o["total_cost"]) if kept else None

    st.session_state.results = results
    st.session_state.search_inputs = {
        "product": product, "quantity": int(quantity), "budget": budget,
        "within_days": within_days, "category": category,
    }
    st.session_state.chosen = None

    database.log_search(
        user["id"], product, int(quantity), budget, within_days, results["matches_found"]
    )


def show_search_page(user, profile):
    show_flash()
    branding.page_title(
        "Search Suppliers",
        "Tell us what you need. We compare every supplier we have on price, speed "
        "and suitability for elderly care.",
    )

    # ---- Load the catalogue, and be honest if it's the sample data ----
    try:
        table, is_real_data = get_catalogue()
    except Exception as error:
        st.error(f"We couldn't read the supplier catalogue: {error}")
        return

    if not is_real_data:
        st.warning(
            "**You are searching example data.** The suppliers and prices below are "
            "realistic but fictional, for testing the platform. To go live, put your real "
            "supplier data in `data/suppliers.csv` — see the README for the column layout.",
            icon="⚠️",
        )

    # ---- Fair-use check for their plan ----
    used_this_month = database.count_searches_this_month(user["id"])
    if not subscriptions.can_search(user["tier"], used_this_month):
        plan = subscriptions.get_plan(user["tier"])
        st.error(
            f"You've used all {plan['searches']} searches on the {plan['name']} plan this "
            f"month. See **Subscription** to move up to unlimited searches."
        )
        if st.button("See plans", type="primary"):
            go_to("Subscription")
            st.rerun()
        return

    currency = profile.get("currency") or money.DEFAULT_CURRENCY
    pending = st.session_state.pending_search    # a search sent over from the dashboard

    filters_column, results_column = st.columns([1, 3.3], gap="large")

    # ================= LEFT: the filter rail =================
    with filters_column:
        with branding.panel("Refine"):

            with st.form("search_form"):
                product = st.text_input(
                    "What do you need?",
                    value=pending["product"] if pending else "",
                    placeholder="e.g. gloves",
                )
                quantity = st.number_input(
                    "Quantity", min_value=1, max_value=1_000_000,
                    value=pending["quantity"] if pending else 100, step=10,
                )
                budget = st.number_input(
                    f"Maximum budget ({money.symbol_for(currency)})",
                    min_value=0.0,
                    value=float(pending["budget"]) if pending and pending["budget"] else 0.0,
                    step=10.0, help="Leave at 0 for no budget limit.",
                )
                when_keys = list(WHEN_OPTIONS.keys())
                when_text = st.selectbox(
                    "Delivery by", when_keys,
                    index=when_keys.index(pending["when_text"]) if pending else 2,
                )

                st.markdown(
                    f'<div style="border-top:1px solid {branding.BORDER};margin:6px 0 14px"></div>',
                    unsafe_allow_html=True,
                )

                all_categories = ["All categories"] + catalogue_module.categories(table)
                category = st.selectbox("Product category", all_categories)

                minimum_quality = st.slider(
                    "Minimum quality rating", min_value=0.0, max_value=5.0, value=0.0, step=0.5,
                    help="Out of 5, for suitability in elderly care.",
                )

                all_suppliers = ["All suppliers"] + catalogue_module.suppliers(table)
                supplier = st.selectbox("Supplier", all_suppliers)

                searched = st.form_submit_button(
                    "Search suppliers", use_container_width=True, type="primary"
                )


        st.markdown(
            f'<p style="font-size:12.5px;color:{branding.TEXT_MUTED};line-height:1.5">'
            "Every option is ranked on price, delivery speed and suitability for elderly "
            "care, weighted equally.</p>",
            unsafe_allow_html=True,
        )

    # ---- Run the search ----
    if pending:
        # Came from the dashboard: run it immediately, then forget it
        st.session_state.pending_search = None
        run_search(
            user, table, pending["product"], pending["quantity"], pending["budget"],
            WHEN_OPTIONS[pending["when_text"]], None, 0.0, None,
        )
    elif searched:
        if not product.strip():
            st.error("Please type what you need — for example 'gloves' or 'toothpaste'.")
        else:
            run_search(
                user, table, product, quantity, budget if budget > 0 else None,
                WHEN_OPTIONS[when_text], category, minimum_quality, supplier,
            )

    # ================= RIGHT: the results =================
    with results_column:
        results = st.session_state.results

        if results is None:
            with branding.panel():
                branding.empty_state(
                    "Ready when you are",
                    "Fill in what you need on the left and press Search suppliers. "
                    "Results appear here in about a second.",
                    tile_size=92,
                )
            branding.privacy_line()
            return

        inputs = st.session_state.search_inputs

        if results["matches_found"] == 0:
            st.warning(
                f"Nothing matched **{escape(inputs['product'])}** with those filters. Try a "
                "simpler word (for example 'gloves' rather than 'blue nitrile gloves size "
                "medium'), or relax the category, quality and supplier filters.",
                icon="🔍",
            )
            branding.privacy_line()
            return

        # ---- A summary line of what was asked for ----
        summary_bits = [f'{inputs["quantity"]:,} × {escape(inputs["product"])}']
        if inputs["budget"]:
            summary_bits.append(f'under {money.money(inputs["budget"], currency)}')
        if inputs["within_days"]:
            summary_bits.append(f'within {inputs["within_days"]} days')

        st.markdown(
            f'<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;'
            'margin-bottom:16px">'
            f'<span style="font-size:21px;font-weight:800;color:{branding.NAVY}">'
            f'{results["matches_found"]} option'
            f'{"s" if results["matches_found"] != 1 else ""}</span>'
            f'<span style="color:{branding.TEXT_MUTED};font-size:15px">'
            f'{" · ".join(summary_bits)}</span></div>',
            unsafe_allow_html=True,
        )

        recommendation = results["recommendation"]

        # ---- The top recommendation, given room of its own ----
        if recommendation:
            top_column, spacer = st.columns([1.55, 1.45], gap="large")
            with top_column:
                st.markdown(
                    option_card_html(
                        recommendation, currency, style="top",
                        label="Top recommendation", why=results["reason"],
                        saved=database.is_supplier_saved(
                            user["id"], recommendation["supplier_name"],
                            recommendation["product_name"],
                        ),
                    ),
                    unsafe_allow_html=True,
                )
                option_buttons(user, recommendation, "top", primary=True)

            with spacer:
                # A quiet explainer beside the recommendation
                cheapest = results["cheapest"]
                st.markdown(
                    '<div class="sc-panel sc-panel--tight" style="margin-top:8px">'
                    '<div class="sc-panel__title" style="font-size:17px">'
                    "How we chose</div>"
                    f'<p style="font-size:14px;color:{branding.TEXT_BODY};line-height:1.6;'
                    'margin:0 0 14px">Price, delivery speed and suitability for elderly care '
                    "count equally. Anything unsuitable for elderly care is never "
                    "recommended, however cheap it is.</p>"
                    f'<div class="sc-row"><span class="sc-row__label">Cheapest found</span>'
                    f'<span class="sc-row__value">'
                    f'{money.money(cheapest["total_cost"], currency)}</span></div>'
                    f'<div class="sc-row"><span class="sc-row__label">Our pick</span>'
                    f'<span class="sc-row__value">'
                    f'{money.money(recommendation["total_cost"], currency)}</span></div>'
                    f'<div class="sc-row"><span class="sc-row__label">Fastest found</span>'
                    f'<span class="sc-row__value">'
                    f'{min(o["delivery_days"] for o in results["options"])} days</span></div>'
                    "</div>",
                    unsafe_allow_html=True,
                )
        else:
            st.error(results["reason"] or "We can't recommend any of these options.")

        # ---- Everything else, three across ----
        others = [option for option in results["options"] if option is not recommendation]

        if others:
            branding.section_heading(
                "All other options",
                "best first · anything unsuitable for elderly care is shown but never recommended",
            )

            for start in range(0, len(others), 3):
                row_options = others[start:start + 3]
                columns = st.columns(3, gap="medium")

                for column, option in zip(columns, row_options):
                    position = others.index(option) + 2
                    if not matching.passes_care_standards(option):
                        style, label = "blocked", "Not for elderly care"
                    elif not option["within_limits"]:
                        style, label = "warn", "Outside your limits"
                    else:
                        style, label = "option", f"Option {position}"

                    with column:
                        st.markdown(
                            option_card_html(
                                option, currency, style=style, label=label,
                                saved=database.is_supplier_saved(
                                    user["id"], option["supplier_name"], option["product_name"]
                                ),
                            ),
                            unsafe_allow_html=True,
                        )
                        option_buttons(user, option, f"other_{position}")

        # ---- The whole lot as a table, for anyone who prefers one ----
        with st.expander("See all options as a table"):
            comparison = pd.DataFrame([{
                "Supplier": option["supplier_name"],
                "Product": option["product_name"],
                "Per unit": money.money(option["price_per_unit"], currency),
                "Units billed": option["billed_units"],
                "Total": money.money(option["total_cost"], currency),
                "Delivery (days)": option["delivery_days"],
                "Quality /5": option["quality_rating"],
                "Suitable for elderly care": "Yes" if option["care_suitable"] else "No",
                "Saving": money.money(option["saving"], currency) if option["saving"] > 0 else "—",
                "Overall score": option["overall_score_100"],
            } for option in results["options"]])

            st.dataframe(comparison, use_container_width=True, hide_index=True)

            if subscriptions.has_feature(user["tier"], "export"):
                st.download_button(
                    "Download this comparison (CSV)",
                    comparison.to_csv(index=False).encode("utf-8"),
                    file_name=f"sennicare-comparison-{inputs['product'][:20]}.csv",
                    mime="text/csv",
                )
            else:
                st.caption("Spreadsheet export is included on the Professional plan.")

    branding.privacy_line()


# ==========================================================================
# SCREEN: REVIEW & SEND
# ==========================================================================

def show_review_and_send(user, profile):
    option = st.session_state.chosen

    if option is None:
        st.info("Choose a supplier from your search results first.")
        if st.button("Back to search", type="primary"):
            go_to("Search Suppliers")
            st.rerun()
        return

    show_flash()
    branding.page_title(
        "Review & Send Request",
        "Written for you from your care home profile and your search. Edit anything, "
        "then send it from your own email.",
    )

    if not database.profile_is_complete(profile):
        st.warning(
            "Some of your care home details are missing, so there are gaps in the message "
            "below. Fill them in on **Care Home Profile** and this completes itself.",
            icon="⚠️",
        )

    currency = profile.get("currency") or money.DEFAULT_CURRENCY
    inputs = st.session_state.search_inputs or {"quantity": option["billed_units"]}

    summary_column, message_column = st.columns([1, 2], gap="large")

    # ================= LEFT: what they're ordering =================
    with summary_column:
        rows = [
            ("Quantity", f'{inputs["quantity"]:,} {option["unit_description"]}(s)'),
            ("Order quantity", f'{option["billed_units"]:,} '
                               f'({option["cases"]} × {option["pack_size"]})'
             if option["pack_size"] > 1 else f'{option["billed_units"]:,}'),
            ("Price per unit", money.money(option["price_per_unit"], currency)),
            ("Delivery", f'{option["delivery_days"]} working days'),
            ("Quality", f'{option["quality_rating"]:.1f} / 5'),
        ]
        row_html = "".join(
            f'<div class="sc-row"><span class="sc-row__label">{escape(label)}</span>'
            f'<span class="sc-row__value">{escape(value)}</span></div>'
            for label, value in rows
        )

        saving_html = (
            f'<div class="sc-save-badge" style="margin-top:14px">Saves '
            f'{money.money(option["saving"], currency)} against typical prices</div>'
            if option["saving"] > 0 else ""
        )

        st.markdown(
            '<div class="sc-card">'
            + branding.product_tile(option["category"], "magenta")
            + f'<div class="sc-card__product">{escape(option["product_name"])}</div>'
            + f'<div class="sc-card__supplier">{escape(option["supplier_name"])}</div>'
            + f'<div class="sc-card__price sc-card__price--top">'
              f'{money.money(option["total_cost"], currency)}</div>'
            + '<div class="sc-card__unit">total expected</div>'
            + f'<div class="sc-rows">{row_html}</div>'
            + saving_html
            + "</div>",
            unsafe_allow_html=True,
        )

        st.markdown('<div style="height:12px"></div>', unsafe_allow_html=True)
        if st.button("← Back to results", use_container_width=True):
            go_to("Search Suppliers")
            st.rerun()

    # ================= RIGHT: the message =================
    with message_column:
        with branding.panel():

            controls = st.columns([1, 1.7])
            with controls[0]:
                needed_by = st.date_input(
                    "Date required",
                    value=money.days_from_now(option["delivery_days"]),
                    format="DD/MM/YYYY",          # UK format
                )
            with controls[1]:
                extra_notes = st.text_input(
                    "Anything else for the supplier? (optional)",
                    placeholder="e.g. deliver to the rear entrance, ask for Maria on arrival",
                )

            st.markdown(
                f'<div style="font-size:13.5px;font-weight:600;color:{branding.TEXT_MUTED};'
                'margin:14px 0 6px">To</div>'
                f'<div style="font-size:15px;color:{branding.NAVY};font-weight:600">'
                f'{escape(option["supplier_name"])} '
                f'<span style="color:{branding.TEXT_MUTED};font-weight:400">'
                f'&lt;{escape(option["supplier_email"] or "no address on file")}&gt;</span></div>',
                unsafe_allow_html=True,
            )

            message = request_writer.build_request(
                profile, option, inputs["quantity"],
                needed_by=needed_by, extra_notes=extra_notes,
            )

            edited_message = st.text_area(
                "Your request (edit freely)", value=message, height=420, key="request_text"
            )


        # ---- Sending ----
        send_columns = st.columns([1.4, 1, 1])

        with send_columns[0]:
            mailto = request_writer.mailto_link(profile, option, edited_message)
            st.link_button(
                "Send request", mailto, use_container_width=True,
                help="Opens your own email program with everything filled in. Press send there.",
            )

        with send_columns[1]:
            st.download_button(
                "Download as text",
                edited_message.encode("utf-8"),
                file_name=f"request-{option['supplier_name'].replace(' ', '-').lower()}.txt",
                mime="text/plain",
                use_container_width=True,
            )

        with send_columns[2]:
            if st.button("Save to My Requests", use_container_width=True):
                database.save_request(user["id"], {
                    "supplier_name": option["supplier_name"],
                    "supplier_email": option["supplier_email"],
                    "product_name": option["product_name"],
                    "quantity": option["billed_units"],
                    "unit_price": option["price_per_unit"],
                    "total_cost": option["total_cost"],
                    "currency": currency,
                    "delivery_days": option["delivery_days"],
                    "needed_by": str(needed_by),
                    "message": edited_message,
                    "status": "Sent",
                })
                flash("Saved to My Requests.")
                st.rerun()

        st.caption(
            "Sennicare doesn't email the supplier for you — the request goes from your own "
            "mailbox, so their reply comes straight back to you."
        )

    branding.privacy_line()


# ==========================================================================
# SCREEN: CARE HOME PROFILE
# ==========================================================================

def show_profile_page(user, profile):
    show_flash()
    branding.page_title(
        "My Care Home Profile",
        "Filled in once, then used to write every request for you.",
    )

    form_column, side_column = st.columns([2, 1], gap="large")

    # ================= LEFT: the form =================
    with form_column:
        with branding.panel():

            with st.form("profile_form"):
                st.markdown("##### The home")
                row = st.columns([2, 1])
                care_home_name = row[0].text_input(
                    "Care home name", value=profile.get("care_home_name", "")
                )
                beds = row[1].number_input(
                    "Number of beds", min_value=0, max_value=2000,
                    value=int(profile.get("beds") or 0),
                )

                address = st.text_input("Address", value=profile.get("address", ""))

                row = st.columns(3)
                city = row[0].text_input("Town or city", value=profile.get("city", ""))
                postcode = row[1].text_input("Postcode", value=profile.get("postcode", ""))
                country = row[2].text_input("Country", value=profile.get("country", "United Kingdom"))

                st.markdown("##### Who suppliers should contact")
                row = st.columns(3)
                contact_name = row[0].text_input("Contact name", value=profile.get("contact_name", ""))
                contact_email = row[1].text_input("Email", value=profile.get("contact_email", ""))
                contact_phone = row[2].text_input("Phone", value=profile.get("contact_phone", ""))

                st.markdown("##### How you buy")
                row = st.columns(2)
                currency_codes = list(money.CURRENCIES.keys())
                current_currency = profile.get("currency") or money.DEFAULT_CURRENCY
                currency = row[0].selectbox(
                    "Currency", currency_codes,
                    index=currency_codes.index(current_currency)
                    if current_currency in currency_codes else 0,
                    format_func=lambda code: f"{money.CURRENCIES[code]['symbol']} {code} — "
                                             f"{money.CURRENCIES[code]['name']}",
                )
                payment_terms = row[1].text_input(
                    "Preferred payment terms",
                    value=profile.get("payment_terms", "30 days from invoice"),
                )

                quality_standards = st.text_area(
                    "Quality requirements",
                    value=profile.get("quality_standards", ""),
                    placeholder="e.g. All PPE must be CE marked and latex-free. Skin products "
                                "fragrance-free and dermatologically tested. Deliveries to "
                                "include batch numbers.",
                    help="Written into every request, so suppliers know your standards up front.",
                )

                delivery_notes = st.text_area(
                    "Delivery instructions",
                    value=profile.get("delivery_notes", ""),
                    placeholder="e.g. Deliveries between 9am and 4pm, Monday to Friday. Use the "
                                "service entrance on Mill Lane. Ring the bell marked Reception.",
                )

                saved = st.form_submit_button(
                    "Save profile", use_container_width=True, type="primary"
                )


    if saved:
        database.save_profile(user["id"], {
            "care_home_name": care_home_name, "address": address, "city": city,
            "postcode": postcode, "country": country, "currency": currency,
            "contact_name": contact_name, "contact_email": contact_email,
            "contact_phone": contact_phone, "beds": beds,
            "quality_standards": quality_standards, "payment_terms": payment_terms,
            "delivery_notes": delivery_notes,
        })
        flash("Saved. Your requests will now fill themselves in.")
        st.rerun()

    # ================= RIGHT: reassurance and shortcuts =================
    with side_column:
        branding.privacy_card()

        with branding.panel("Quick actions"):
            if st.button("New supplier search", use_container_width=True, type="primary"):
                go_to("Search Suppliers")
                st.rerun()
            if st.button("View my requests", use_container_width=True):
                go_to("My Requests")
                st.rerun()
            if st.button("Saved suppliers", use_container_width=True):
                go_to("Saved Suppliers")
                st.rerun()

        # A gentle completeness check
        if database.profile_is_complete(profile):
            st.success("Your profile is complete.", icon="✅")
        else:
            missing = [
                label for label, field in [
                    ("care home name", "care_home_name"), ("address", "address"),
                    ("town or city", "city"), ("postcode", "postcode"),
                    ("contact name", "contact_name"), ("contact email", "contact_email"),
                ] if not str(profile.get(field, "")).strip()
            ]
            st.info("Still needed: " + ", ".join(missing) + ".", icon="ℹ️")


# ==========================================================================
# SCREEN: MY REQUESTS
# ==========================================================================

def show_requests_page(user, profile):
    show_flash()
    branding.page_title("My Requests", "Everything you've sent, and what happened next.")

    if not subscriptions.has_feature(user["tier"], "request_history"):
        st.info(
            "Request history is included on the **Professional** plan. You can still "
            "write and send requests — they just aren't kept here.",
            icon="ℹ️",
        )

    requests = database.list_requests(user["id"])

    if not requests:
        with branding.panel():
            branding.empty_state(
                "No requests yet",
                "Find a supplier and save the request, and it will appear here.",
            )
        if st.button("Search suppliers", type="primary"):
            go_to("Search Suppliers")
            st.rerun()
        branding.privacy_line()
        return

    currency = profile.get("currency") or money.DEFAULT_CURRENCY

    figures = st.columns(4, gap="medium")
    with figures[0]:
        branding.stat_card("Requests", str(len(requests)))
    with figures[1]:
        branding.stat_card(
            "Total value",
            money.money(sum(r["total_cost"] for r in requests), currency, pence=False),
            tone="save",
        )
    with figures[2]:
        branding.stat_card(
            "Suppliers used", str(len({r["supplier_name"] for r in requests})), tone="accent"
        )
    with figures[3]:
        awaiting = len([r for r in requests if r["status"] in ("Draft", "Sent")])
        branding.stat_card("Awaiting delivery", str(awaiting))

    st.markdown('<div style="height:16px"></div>', unsafe_allow_html=True)

    STATUSES = ["Draft", "Sent", "Confirmed", "Delivered", "Cancelled"]
    STATUS_COLOURS = {
        "Draft": branding.TEXT_MUTED, "Sent": branding.CYAN,
        "Confirmed": branding.NAVY, "Delivered": branding.GREEN,
        "Cancelled": branding.AMBER,
    }

    for request in requests:
        colour = STATUS_COLOURS.get(request["status"], branding.TEXT_MUTED)
        header = (
            f'{money.uk_date(request["created_at"])}  ·  {request["supplier_name"]}  ·  '
            f'{request["product_name"]}  ·  '
            f'{money.money(request["total_cost"], request["currency"])}  ·  {request["status"]}'
        )

        with st.expander(header):
            details = st.columns(4)
            for column, (label, value) in zip(details, [
                ("Quantity", f'{request["quantity"]:,}'),
                ("Per unit", money.money(request["unit_price"], request["currency"])),
                ("Needed by", money.uk_date(request["needed_by"])),
                ("Status", request["status"]),
            ]):
                column.markdown(
                    f'<div class="sc-stat__label">{label}</div>'
                    f'<div style="font-size:16px;font-weight:700;color:{colour if label == "Status" else branding.NAVY}">'
                    f"{escape(value)}</div>",
                    unsafe_allow_html=True,
                )

            st.text_area(
                "The request you sent", value=request["message"], height=230,
                key=f"request_message_{request['id']}", disabled=True,
            )

            actions = st.columns([2, 1, 1])
            with actions[0]:
                new_status = st.selectbox(
                    "Update status", STATUSES,
                    index=STATUSES.index(request["status"])
                    if request["status"] in STATUSES else 1,
                    key=f"status_{request['id']}",
                )
                if new_status != request["status"]:
                    database.update_request_status(user["id"], request["id"], new_status)
                    st.rerun()
            with actions[2]:
                st.markdown('<div style="height:28px"></div>', unsafe_allow_html=True)
                if st.button("Delete", key=f"delete_{request['id']}", use_container_width=True):
                    database.delete_request(user["id"], request["id"])
                    flash("Request deleted.", "info")
                    st.rerun()

    if subscriptions.has_feature(user["tier"], "export"):
        history = pd.DataFrame([{
            "Date": money.uk_date(request["created_at"]),
            "Supplier": request["supplier_name"],
            "Product": request["product_name"],
            "Quantity": request["quantity"],
            "Unit price": request["unit_price"],
            "Total cost": request["total_cost"],
            "Currency": request["currency"],
            "Needed by": money.uk_date(request["needed_by"]),
            "Status": request["status"],
        } for request in requests])

        st.download_button(
            "Download my request history (CSV)",
            history.to_csv(index=False).encode("utf-8"),
            file_name="sennicare-my-requests.csv",
            mime="text/csv",
        )

    branding.privacy_line()


# ==========================================================================
# SCREEN: SAVED SUPPLIERS
# ==========================================================================

def show_saved_suppliers(user, profile):
    show_flash()
    branding.page_title(
        "Saved Suppliers",
        "Suppliers you've bookmarked from your searches, to come back to.",
    )

    saved_list = database.list_saved_suppliers(user["id"])
    currency = profile.get("currency") or money.DEFAULT_CURRENCY

    if not saved_list:
        with branding.panel():
            branding.empty_state(
                "Nothing saved yet",
                "Press the ☆ on any search result to keep it here.",
            )
        if st.button("Search suppliers", type="primary"):
            go_to("Search Suppliers")
            st.rerun()
        branding.privacy_line()
        return

    for start in range(0, len(saved_list), 3):
        columns = st.columns(3, gap="medium")
        for column, saved in zip(columns, saved_list[start:start + 3]):
            with column:
                st.markdown(
                    '<div class="sc-card">'
                    '<span class="sc-chip sc-chip--saved">Saved '
                    f'{money.uk_date(saved["created_at"])}</span>'
                    f'<div class="sc-card__product">{escape(saved["product_name"])}</div>'
                    f'<div class="sc-card__supplier">{escape(saved["supplier_name"])}</div>'
                    '<div class="sc-rows">'
                    '<div class="sc-row"><span class="sc-row__label">Price per unit</span>'
                    f'<span class="sc-row__value">'
                    f'{money.money(saved["unit_price"], currency)}</span></div>'
                    '<div class="sc-row"><span class="sc-row__label">Delivery</span>'
                    f'<span class="sc-row__value">{saved["delivery_days"]} '
                    f'{"day" if saved["delivery_days"] == 1 else "days"}</span></div>'
                    '<div class="sc-row"><span class="sc-row__label">Quality</span>'
                    f'<span class="sc-row__value">{saved["quality_rating"]:.1f} / 5</span></div>'
                    '<div class="sc-row"><span class="sc-row__label">Contact</span>'
                    f'<span class="sc-row__value">'
                    f'{escape(saved["supplier_email"] or "—")}</span></div>'
                    "</div></div>",
                    unsafe_allow_html=True,
                )

                buttons = st.columns([2, 1])
                with buttons[0]:
                    if st.button(
                        "Search this product", key=f"research_{saved['id']}",
                        use_container_width=True,
                    ):
                        st.session_state.pending_search = {
                            "product": saved["product_name"], "quantity": 100,
                            "budget": None, "when_text": "Within 1 week",
                        }
                        go_to("Search Suppliers")
                        st.rerun()
                with buttons[1]:
                    if st.button(
                        "Remove", key=f"unsave_{saved['id']}", use_container_width=True
                    ):
                        database.delete_saved_supplier(user["id"], saved["id"])
                        flash("Removed from Saved Suppliers.", "info")
                        st.rerun()

    branding.privacy_line()


# ==========================================================================
# SCREEN: SUBSCRIPTION
# ==========================================================================

def show_subscription_page(user):
    show_flash()
    branding.page_title("Subscription", "What you're on today, and what else is available.")

    current_plan = subscriptions.get_plan(user["tier"])
    used = database.count_searches_this_month(user["id"])
    left = subscriptions.searches_left(user["tier"], used)

    figures = st.columns(3, gap="medium")
    with figures[0]:
        branding.stat_card(
            "Your plan", current_plan["name"],
            "Free forever" if current_plan["monthly_price"] == 0
            else f'£{current_plan["monthly_price"]} per month',
        )
    with figures[1]:
        branding.stat_card("Searches this month", str(used))
    with figures[2]:
        # Both plans currently include unlimited searching, so this reads
        # "Unlimited" rather than counting down to a limit that isn't there.
        branding.stat_card(
            "Remaining", "Unlimited" if left is None else str(left), tone="accent"
        )

    st.markdown('<div style="height:18px"></div>', unsafe_allow_html=True)

    # The plan cards show the SAME wording as the website's pricing page, so a
    # manager who read the site sees exactly what they expect in the app.
    current_tier = subscriptions.get_plan(user["tier"])["id"]

    columns = st.columns(len(subscriptions.PLANS), gap="medium")
    for column, plan in zip(columns, subscriptions.PLANS):
        is_current = plan["id"] == current_tier

        with column:
            features = "".join(
                f'<div class="sc-row"><span class="sc-row__label">{escape(line)}</span>'
                f'<span class="sc-row__value" style="color:{branding.GREEN}">✓</span></div>'
                for line in plan["website_features"]
            )

            price = "Free" if plan["monthly_price"] == 0 else f'£{plan["monthly_price"]}'

            st.markdown(
                f'<div class="sc-card{" sc-card--top" if is_current else ""}">'
                + (('<span class="sc-chip sc-chip--top">Your plan</span>')
                   if is_current else '<span class="sc-chip sc-chip--option">Most popular</span>')
                + f'<div class="sc-card__product" style="font-size:21px">{plan["name"]}</div>'
                + f'<div class="sc-card__price{" sc-card__price--top" if is_current else ""}" '
                  f'style="margin-top:8px">{price}</div>'
                + '<div class="sc-card__unit">per month</div>'
                + f'<p style="font-size:14px;color:{branding.TEXT_MUTED};line-height:1.55;'
                  f'margin:0 0 6px">{escape(plan["blurb"])}</p>'
                + f'<div class="sc-rows">{features}</div></div>',
                unsafe_allow_html=True,
            )

            if not is_current:
                st.button(
                    f'Ask about {plan["name"]}', key=f'ask_{plan["id"]}',
                    use_container_width=True,
                )

    st.info(
        "**Card payments aren't switched on yet.** During the pilot, plans are changed by "
        "hand — email hello@sennicare.co.uk and we'll move your account the same day.",
        icon="ℹ️",
    )


# ==========================================================================
# SCREEN: MY ACCOUNT
# ==========================================================================

def show_account_page(user):
    show_flash()
    branding.page_title("My Account", "Your sign-in details, your data, your choices.")

    left, right = st.columns([2, 1], gap="large")

    with left:
        password_tab, data_tab = st.tabs(["Password", "My data"])

        # ---------------- PASSWORD ----------------
        with password_tab:
            with branding.panel():
                st.markdown(
                    f'<div class="sc-row"><span class="sc-row__label">Signed in as</span>'
                    f'<span class="sc-row__value">{escape(user["email"])}</span></div>'
                    f'<div class="sc-row"><span class="sc-row__label">Name</span>'
                    f'<span class="sc-row__value">{escape(user["full_name"])}</span></div>'
                    f'<div style="height:18px"></div>',
                    unsafe_allow_html=True,
                )

                with st.form("password_form"):
                    current = st.text_input("Current password", type="password")
                    new = st.text_input("New password", type="password")
                    again = st.text_input("New password again", type="password")
                    changed = st.form_submit_button("Change password", type="primary")


            if changed:
                worked, note = auth.change_password(user["id"], current, new, again)
                if worked:
                    st.success(note, icon="✅")
                else:
                    st.error(note)

            st.caption(
                "Passwords are stored scrambled (hashed), never as text — so nobody at "
                "Sennicare can read yours. There is no password reset email yet during the "
                "pilot; if you get locked out, email hello@sennicare.co.uk."
            )

        # ---------------- THEIR DATA ----------------
        with data_tab:
            with branding.panel("What we hold about you"):
                st.markdown("""
                - Your sign-in email, your name and your scrambled password
                - Your care home profile, exactly as you typed it
                - The searches you've run, so we can count them against your plan
                - The requests you've saved, and the suppliers you've bookmarked

                Nothing else. We don't track you around the internet, we don't sell anything
                to anyone, and no other subscriber can see any of it.
                """)

                everything = database.export_user_data(user["id"])
                st.download_button(
                    "Download everything we hold about me (JSON)",
                    json.dumps(everything, indent=2).encode("utf-8"),
                    file_name="my-sennicare-data.json",
                    mime="application/json",
                )

            with branding.panel("Close my account",
                "This deletes your account, your care home profile, your searches, your "
                "saved requests and your bookmarks. It cannot be undone."):
                confirmation = st.text_input("Type DELETE to confirm", key="delete_confirm")
                if st.button("Delete my account permanently"):
                    if confirmation.strip().upper() == "DELETE":
                        database.delete_account(user["id"])
                        sign_out()
                        flash("Your account and all your data have been deleted.", "info")
                        st.rerun()
                    else:
                        st.error("Type DELETE in the box to confirm.")

    with right:
        branding.privacy_card()


# ==========================================================================
# SCREEN: ADMIN (you only)
# ==========================================================================

def show_admin_page(user):
    show_flash()
    branding.page_title("Admin", "For Sennicare staff. Subscribers never see this page.")

    catalogue_tab, subscribers_tab = st.tabs(["Supplier catalogue", "Subscribers"])

    # ---------------- CATALOGUE ----------------
    with catalogue_tab:
        try:
            table, is_real_data = get_catalogue()
        except Exception as error:
            st.error(f"Couldn't read the catalogue: {error}")
            return

        path, _ = catalogue_module.which_catalogue_file()
        summary = catalogue_module.catalogue_summary(table)

        if is_real_data:
            st.success(f"Using your real catalogue: `{os.path.basename(path)}`", icon="✅")
        else:
            st.warning(
                f"Using the fictional sample: `{os.path.basename(path)}`. "
                f"Create `data/suppliers.csv` to go live.",
                icon="⚠️",
            )

        figures = st.columns(4, gap="medium")
        for column, (label, value) in zip(figures, [
            ("Catalogue rows", summary["rows"]), ("Products", summary["products"]),
            ("Suppliers", summary["suppliers"]), ("Categories", summary["categories"]),
        ]):
            with column:
                branding.stat_card(label, str(value))

        st.markdown('<div style="height:16px"></div>', unsafe_allow_html=True)
        if st.button("Reload the catalogue file"):
            get_catalogue.clear()       # empties the cache so the file is re-read
            flash("Catalogue reloaded.")
            st.rerun()

        st.markdown("##### Quality check")
        problems = []

        no_market_price = table[table["typical_market_price"] <= table["price_per_unit"]]
        if len(no_market_price):
            problems.append(
                f"{len(no_market_price)} row(s) have no saving against the typical market "
                f"price — managers will see 'no saving' for these."
            )

        low_quality_suitable = table[
            (table["quality_rating"] < catalogue_module.QUALITY_FLOOR)
            & (table["care_suitable_flag"])
        ]
        if len(low_quality_suitable):
            problems.append(
                f"{len(low_quality_suitable)} row(s) are marked suitable for care but rate "
                f"below {catalogue_module.QUALITY_FLOOR}, so they can never be recommended."
            )

        single_supplier = (
            table.groupby("product_name")["supplier_name"].nunique().eq(1).sum()
        )
        if single_supplier:
            problems.append(
                f"{single_supplier} product(s) are stocked by only one supplier — managers "
                f"get nothing to compare against. Add a second source for these."
            )

        if problems:
            for problem in problems:
                st.warning(problem, icon="⚠️")
        else:
            st.success("No problems found in the catalogue.", icon="✅")

        st.markdown("##### Everything in the catalogue")
        st.dataframe(
            table[[
                "supplier_name", "product_name", "category", "unit_description",
                "price_per_unit", "typical_market_price", "pack_size",
                "min_order_units", "delivery_days", "quality_rating", "care_suitable",
            ]],
            use_container_width=True, hide_index=True,
        )

    # ---------------- SUBSCRIBERS ----------------
    with subscribers_tab:
        connection = database.get_connection()
        rows = connection.execute("""
            SELECT u.id, u.email, u.full_name, u.tier, u.created_at,
                   p.care_home_name,
                   (SELECT COUNT(*) FROM searches s WHERE s.user_id = u.id) AS searches,
                   (SELECT COUNT(*) FROM requests r WHERE r.user_id = u.id) AS requests
            FROM users u LEFT JOIN profiles p ON p.user_id = u.id
            ORDER BY u.created_at DESC
        """).fetchall()
        connection.close()

        figures = st.columns(4, gap="medium")
        with figures[0]:
            branding.stat_card("Subscribers", str(len(rows)))
        with figures[1]:
            branding.stat_card(
                "On a paid tier",
                str(len([r for r in rows
                         if subscriptions.get_plan(r["tier"])["monthly_price"] > 0])),
                tone="accent",
            )
        with figures[2]:
            branding.stat_card("Total searches", str(sum(r["searches"] for r in rows)))
        with figures[3]:
            branding.stat_card("Total requests", str(sum(r["requests"] for r in rows)))

        st.markdown('<div style="height:16px"></div>', unsafe_allow_html=True)

        subscribers = pd.DataFrame([{
            "ID": row["id"], "Email": row["email"], "Name": row["full_name"],
            "Care home": row["care_home_name"] or "—", "Plan": row["tier"],
            "Searches": row["searches"], "Requests": row["requests"],
            "Joined": money.uk_date(row["created_at"]),
        } for row in rows])
        st.dataframe(subscribers, use_container_width=True, hide_index=True)

        st.markdown("##### Move an account onto another plan")
        st.caption("Until card payments are switched on, you do this by hand here.")

        with st.form("change_tier_form"):
            columns = st.columns([2, 2, 1])
            emails = [row["email"] for row in rows]
            chosen_email = columns[0].selectbox("Subscriber", emails) if emails else None
            new_tier = columns[1].selectbox(
                "Plan", [plan["id"] for plan in subscriptions.PLANS],
                format_func=lambda tier: subscriptions.get_plan(tier)["name"],
            )
            columns[2].markdown('<div style="height:28px"></div>', unsafe_allow_html=True)
            changed = columns[2].form_submit_button("Change plan", use_container_width=True)

        if changed and chosen_email:
            matching_row = next(row for row in rows if row["email"] == chosen_email)
            auth.set_tier(matching_row["id"], new_tier)
            if matching_row["id"] == user["id"]:
                st.session_state.user["tier"] = new_tier
            flash(f'{chosen_email} moved to {subscriptions.get_plan(new_tier)["name"]}.')
            st.rerun()


# ==========================================================================
# THE ROUTER - decides which screen to show
# ==========================================================================

PAGES = {
    "Dashboard": show_dashboard,
    "Search Suppliers": show_search_page,
    "Review & Send": show_review_and_send,
    "My Requests": show_requests_page,
    "Saved Suppliers": show_saved_suppliers,
    "Care Home Profile": show_profile_page,
}


def main():
    user = st.session_state.user

    # Nobody signed in? Show the welcome screen and stop.
    if user is None:
        show_welcome_screen()
        return

    # Load THIS user's profile. Every screen below only ever sees their own data.
    profile = database.get_profile(user["id"])

    show_sidebar(user, profile)

    page = st.session_state.page

    if page in PAGES:
        PAGES[page](user, profile)
    elif page == "Subscription":
        show_subscription_page(user)
    elif page == "My Account":
        show_account_page(user)
    elif page == "Admin" and is_admin(user):
        show_admin_page(user)
    else:
        show_dashboard(user, profile)


main()
