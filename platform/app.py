"""
============================================================================
SENNICARE - the procurement platform for care home managers
============================================================================

WHAT THIS FILE IS
-----------------
This is the app itself - every screen a care home manager sees. The working
parts it uses (the database, the search engine, the request writer) live in the
"sennicare" folder next door, each in its own file.

HOW TO RUN IT
-------------
  1. Open a terminal in this folder
  2. Type:  streamlit run app.py
  3. It opens in your web browser

THE SCREENS
-----------
  Not logged in ...... Welcome, Log in, Create account
  Logged in .......... Find Supplies, My Care Home, My Requests,
                       My Plan, My Account  (+ Admin, for you only)

A NOTE ON HOW STREAMLIT WORKS
-----------------------------
Streamlit re-runs this whole file from top to bottom every time someone clicks
something. Anything that must survive a click is kept in "st.session_state",
which is a small box of memory that persists between clicks. That is why you see
st.session_state used for the logged-in user and the current search results.
============================================================================
"""

import html
import io
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
)

# Create the database tables if this is the very first run.
database.set_up_database()

# Paint on the Sennicare colours.
branding.apply_branding()


# Which email addresses can see the Admin page. Set this on your computer with:
#   SENNICARE_ADMIN_EMAILS="you@sennicare.co.uk"
# If it isn't set, the very first account created (user number 1) is the admin.
ADMIN_EMAILS = [
    email.strip().lower()
    for email in os.environ.get("SENNICARE_ADMIN_EMAILS", "").split(",")
    if email.strip()
]


def is_admin(user):
    """True if this logged-in user should see the Admin page."""
    if ADMIN_EMAILS:
        return user["email"].lower() in ADMIN_EMAILS
    return user["id"] == 1


@st.cache_data(show_spinner=False)
def get_catalogue():
    """
    Loads the supplier spreadsheet.
    @st.cache_data means "only read the file once, then remember it" - so the
    app stays fast. If you edit the spreadsheet, press "R" in the browser or use
    the Reload button on the Admin page.
    """
    return catalogue_module.load_catalogue()


def escape(text):
    """
    Makes text safe to put inside our HTML cards.
    (Stops a stray < or & in a product name from breaking the layout.)
    """
    return html.escape(str(text))


# ==========================================================================
# WHO IS LOGGED IN
# ==========================================================================

if "user" not in st.session_state:
    st.session_state.user = None          # nobody logged in yet
if "page" not in st.session_state:
    st.session_state.page = "Find Supplies"
if "results" not in st.session_state:
    st.session_state.results = None       # the last search's results
if "chosen" not in st.session_state:
    st.session_state.chosen = None        # the supplier option they picked


def log_out():
    """Clears everything about this session and returns to the welcome screen."""
    for key in ["user", "results", "chosen", "search_inputs"]:
        st.session_state.pop(key, None)
    st.session_state.page = "Find Supplies"


# ==========================================================================
# SCREEN 1 - WELCOME / LOG IN / CREATE ACCOUNT
# Shown only when nobody is logged in.
# ==========================================================================

def show_welcome_screen():
    left, right = st.columns([1.1, 1], gap="large")

    # ---- Left: what Sennicare is ----
    with left:
        branding.page_header(
            "Find the right supplies. In under three minutes.",
            "Sennicare is a procurement platform built only for care homes. "
            "Search once, compare every supplier side by side, and send a "
            "professional request without typing your details twice.",
        )

        st.markdown("""
        **How it works**

        1. **Tell us what you need** — product, quantity, budget and when you need it.
        2. **See every option instantly** — price, delivery time and a quality rating
           for elderly care, side by side. No emails. No waiting for quotes.
        3. **We flag the best choice** — weighing price, speed and quality equally.
           We never recommend the cheapest option if it isn't right for your residents.
        4. **Send the request in one click** — we write it, pre-filled from your profile.

        **Your data stays in your account.** Your care home details and searches are
        private to you. No other subscriber can see them, and nothing reaches a supplier
        until you press send.
        """)

        st.markdown("---")
        st.markdown("**Plans**")
        plan_columns = st.columns(len(subscriptions.PLANS))
        for column, plan in zip(plan_columns, subscriptions.PLANS):
            with column:
                allowance = plan["searches"] or "Unlimited"
                st.markdown(
                    f"**{plan['name']}**  \n"
                    f"£{plan['monthly_price']}/month  \n"
                    f"{allowance} searches  \n"
                    f"<span style='font-size:13px;color:#454B66'>{plan['blurb']}</span>",
                    unsafe_allow_html=True,
                )

    # ---- Right: the log in / create account box ----
    with right:
        st.markdown("### ")
        log_in_tab, register_tab = st.tabs(["Log in", "Create an account"])

        # ---------------- LOG IN ----------------
        with log_in_tab:
            with st.form("log_in_form"):
                email = st.text_input("Email address", key="login_email")
                password = st.text_input("Password", type="password", key="login_password")
                submitted = st.form_submit_button("Log in", use_container_width=True)

            if submitted:
                worked, result = auth.log_in(email, password)
                if worked:
                    st.session_state.user = result
                    st.rerun()          # redraw the page, now logged in
                else:
                    st.error(result)

        # ------------- CREATE ACCOUNT -------------
        with register_tab:
            st.caption(
                "Starter plan, £49/month. No card needed during our pilot — "
                "create an account and start searching straight away."
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
                registered = st.form_submit_button("Create my account", use_container_width=True)

            if registered:
                if not agreed:
                    st.error("Please tick the box to continue.")
                else:
                    worked, result = auth.register(
                        new_email, new_password, new_password_again, full_name
                    )
                    if worked:
                        st.session_state.user = result
                        st.session_state.page = "My Care Home"   # profile first
                        st.success("Account created. Let's set up your care home.")
                        st.rerun()
                    else:
                        st.error(result)


# ==========================================================================
# THE SIDEBAR - shown once logged in
# ==========================================================================

def show_sidebar(user, profile):
    with st.sidebar:
        st.markdown(
            f'<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'
            f'{branding.LOGO_SVG}'
            f'<span style="font-size:21px;font-weight:800;color:{branding.NAVY}">Sennicare</span></div>',
            unsafe_allow_html=True,
        )

        home_name = profile.get("care_home_name") or "Your care home"
        st.markdown(f"**{escape(home_name)}**  \n{escape(user['email'])}")

        plan = subscriptions.get_plan(user["tier"])
        used = database.count_searches_this_month(user["id"])
        left = subscriptions.searches_left(user["tier"], used)
        allowance_text = "Unlimited searches" if left is None else f"{left} searches left this month"
        st.caption(f"{plan['name']} plan · {allowance_text}")

        st.markdown("---")

        pages = ["Find Supplies", "My Care Home", "My Requests", "My Plan", "My Account"]
        if is_admin(user):
            pages.append("Admin")

        # The radio buttons act as the menu. index=... keeps the right one
        # selected after the page redraws.
        current = st.session_state.page if st.session_state.page in pages else pages[0]
        choice = st.radio("Menu", pages, index=pages.index(current), label_visibility="collapsed")
        if choice != st.session_state.page:
            st.session_state.page = choice
            st.rerun()

        st.markdown("---")
        if st.button("Log out", use_container_width=True, type="secondary"):
            log_out()
            st.rerun()


# ==========================================================================
# DRAWING A SUPPLIER OPTION AS A CARD
# ==========================================================================

def render_option_card(option, currency, style="normal", flag_text=None, reason=None):
    """
    Draws one supplier option.
    style: "top" (the recommendation), "warn" (outside their limits),
           "blocked" (fails care standards), or "normal".
    """
    card_class = {
        "top": "sc-card sc-card--top",
        "warn": "sc-card sc-card--warn",
        "blocked": "sc-card sc-card--blocked",
    }.get(style, "sc-card")

    flag_class = {
        "top": "sc-flag",
        "warn": "sc-flag sc-flag--warn",
        "blocked": "sc-flag sc-flag--blocked",
    }.get(style, "sc-flag sc-flag--quality")

    pieces = [f'<div class="{card_class}">']

    if flag_text:
        pieces.append(f'<span class="{flag_class}">{escape(flag_text)}</span>')

    pieces.append(f'<div class="sc-product">{escape(option["product_name"])}</div>')
    pieces.append(f'<div class="sc-supplier">{escape(option["supplier_name"])}</div>')

    # --- The row of figures ---
    total_class = "sc-figure__value sc-figure__value--total" if style == "top" else "sc-figure__value"
    delivery_text = "Same day" if option["delivery_days"] == 0 else (
        "Next working day" if option["delivery_days"] == 1 else f"{option['delivery_days']} working days"
    )

    pieces.append('<div class="sc-figures">')
    pieces.append(
        f'<div><div class="sc-figure__label">Total cost</div>'
        f'<div class="{total_class}">{money.money(option["total_cost"], currency)}</div></div>'
    )
    pieces.append(
        f'<div><div class="sc-figure__label">Per {escape(option["unit_description"])}</div>'
        f'<div class="sc-figure__value">{money.money(option["price_per_unit"], currency)}</div></div>'
    )
    pieces.append(
        f'<div><div class="sc-figure__label">Delivery</div>'
        f'<div class="sc-figure__value">{escape(delivery_text)}</div></div>'
    )
    pieces.append(
        f'<div><div class="sc-figure__label">Quality for elderly care</div>'
        f'<div class="sc-figure__value">{option["quality_rating"]:.1f} / 5</div></div>'
    )
    if option["saving"] > 0:
        pieces.append(
            f'<div><div class="sc-figure__label">You save</div>'
            f'<div class="sc-figure__value sc-figure__value--save">'
            f'{money.money(option["saving"], currency)}</div></div>'
        )
    pieces.append("</div>")

    # --- The saving, spelled out ---
    if option["saving"] > 0:
        pieces.append(
            f'<span class="sc-saving">Saves {money.money(option["saving"], currency)} '
            f'({option["saving_percent"]:.0f}%) against typical prices of '
            f'{money.money(option["typical_cost"], currency)}</span>'
        )

    # --- Order details and any warnings ---
    order_bits = []
    if option["pack_size"] > 1:
        order_bits.append(
            f'Supplied in cases of {option["pack_size"]} — '
            f'{option["cases"]} case(s) = {option["billed_units"]:,} {escape(option["unit_description"])}s'
        )
    if option["extra_units"] > 0:
        order_bits.append(f'{option["extra_units"]:,} more than you asked for, because of pack sizes')
    if option["min_order_units"] > 1:
        order_bits.append(f'Minimum order {option["min_order_units"]:,}')
    if option["certifications"] and option["certifications"].lower() != "none listed":
        order_bits.append(escape(option["certifications"]))

    if order_bits:
        pieces.append(f'<div class="sc-note">{" · ".join(order_bits)}</div>')

    if option["notes"]:
        pieces.append(f'<div class="sc-note">{escape(option["notes"])}</div>')

    if not option["care_suitable"]:
        pieces.append(
            '<div class="sc-note"><strong>⚠️ Not suitable for elderly care</strong> — '
            'we will not recommend this, whatever it costs.</div>'
        )

    warnings = []
    if option["over_budget"]:
        warnings.append("over your budget")
    if option["too_slow"]:
        warnings.append("slower than your delivery date")
    if warnings:
        pieces.append(f'<div class="sc-note">⚠️ This option is {" and ".join(warnings)}.</div>')

    # --- Why we chose it (top recommendation only) ---
    if reason:
        pieces.append(f'<div class="sc-reason">{escape(reason)}</div>')

    # --- The three scores, so the ranking is never a black box ---
    pieces.append(
        f'<div class="sc-note">Scores out of 100 — price {option["price_score_100"]}, '
        f'speed {option["speed_score_100"]}, quality {option["quality_score_100"]} '
        f'→ <strong>overall {option["overall_score_100"]}</strong></div>'
    )

    pieces.append("</div>")
    st.markdown("".join(pieces), unsafe_allow_html=True)


# ==========================================================================
# SCREEN 2 - FIND SUPPLIES (the main event)
# ==========================================================================

def show_search_page(user, profile):
    branding.page_header(
        "Find Supplies",
        "Tell us what you need. We'll show you every option we have, instantly.",
    )

    # --- Load the catalogue, and be honest if it's the sample data ---
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

    # --- Nudge them to finish their profile, because the request needs it ---
    if not database.profile_is_complete(profile):
        st.info(
            "Fill in your care home details on **My Care Home** first — then every request "
            "you send is filled in for you automatically.",
            icon="ℹ️",
        )

    # --- Fair-use check for their plan ---
    used_this_month = database.count_searches_this_month(user["id"])
    if not subscriptions.can_search(user["tier"], used_this_month):
        plan = subscriptions.get_plan(user["tier"])
        st.error(
            f"You've used all {plan['searches']} searches on the {plan['name']} plan this month. "
            f"See **My Plan** to move up to unlimited searches."
        )
        return

    currency = profile.get("currency") or money.DEFAULT_CURRENCY

    # ---------------- THE SEARCH FORM ----------------
    with st.form("search_form"):
        st.markdown("#### What do you need?")

        row1_left, row1_right = st.columns([2, 1])
        with row1_left:
            product = st.text_input(
                "Product",
                placeholder="e.g. toothpaste, gloves, continence pads",
                help="Type it however you'd say it. We search product names, categories and keywords.",
            )
        with row1_right:
            all_categories = ["All categories"] + catalogue_module.categories(table)
            category = st.selectbox("Category (optional)", all_categories)

        row2 = st.columns(3)
        with row2[0]:
            quantity = st.number_input(
                "Quantity needed", min_value=1, max_value=1_000_000, value=100, step=10,
                help="How many units. We'll round up to whole cases where a supplier requires it.",
            )
        with row2[1]:
            budget = st.number_input(
                f"Maximum budget ({money.symbol_for(currency)})",
                min_value=0.0, value=0.0, step=10.0,
                help="Leave at 0 for no budget limit.",
            )
        with row2[2]:
            when_options = {
                "As soon as possible": 1,
                "Within 3 days": 3,
                "Within 1 week": 7,
                "Within 2 weeks": 14,
                "Within a month": 30,
                "No deadline": None,
            }
            when_text = st.selectbox("When do you need it?", list(when_options.keys()), index=2)

        searched = st.form_submit_button("Search suppliers", use_container_width=True)

    # ---------------- RUN THE SEARCH ----------------
    if searched:
        if not product.strip():
            st.error("Please type what you need — for example 'gloves' or 'toothpaste'.")
        else:
            within_days = when_options[when_text]
            budget_or_none = budget if budget > 0 else None

            results = matching.search(
                table, product, int(quantity),
                budget=budget_or_none, within_days=within_days,
                category=category,
            )

            # Remember the search and its results across clicks
            st.session_state.results = results
            st.session_state.search_inputs = {
                "product": product, "quantity": int(quantity),
                "budget": budget_or_none, "within_days": within_days,
                "when_text": when_text,
            }
            st.session_state.chosen = None

            # Log it (for the monthly allowance) - only ever against this user
            database.log_search(
                user["id"], product, int(quantity), budget_or_none,
                within_days, results["matches_found"],
            )

    # ---------------- SHOW THE RESULTS ----------------
    results = st.session_state.results
    if results is None:
        branding.privacy_footer()
        return

    inputs = st.session_state.search_inputs

    if results["matches_found"] == 0:
        st.warning(
            f"We found nothing matching **{escape(inputs['product'])}**. Try a simpler word "
            f"(for example 'gloves' rather than 'blue nitrile gloves size medium'), or clear "
            f"the category filter."
        )
        branding.privacy_footer()
        return

    st.markdown("---")
    st.markdown(
        f"#### {results['matches_found']} option"
        f"{'s' if results['matches_found'] != 1 else ''} for "
        f"{inputs['quantity']:,} × {escape(inputs['product'])}"
    )

    # --- The top recommendation, front and centre ---
    recommendation = results["recommendation"]
    if recommendation:
        render_option_card(
            recommendation, currency, style="top",
            flag_text="Top recommendation",
            reason=results["reason"],
        )
        if st.button(
            f"Choose {recommendation['supplier_name']} → write my request",
            key="choose_top", use_container_width=True,
        ):
            st.session_state.chosen = recommendation
            st.rerun()
    else:
        st.error(results["reason"] or "We can't recommend any of these options.")

    # --- Everything else, for comparison ---
    others = [option for option in results["options"] if option is not recommendation]

    if others:
        st.markdown("#### All other options")
        st.caption(
            "Every option we found, best first. Anything unsuitable for elderly care is "
            "shown but never recommended."
        )

        for number, option in enumerate(others):
            if not matching.passes_care_standards(option):
                style, flag = "blocked", "Not recommended for elderly care"
            elif not option["within_limits"]:
                style, flag = "warn", "Just outside your limits"
            else:
                style, flag = "normal", f"Option {number + 2}"

            render_option_card(option, currency, style=style, flag_text=flag)

            if st.button(
                f"Choose {option['supplier_name']}",
                key=f"choose_{number}", type="secondary",
            ):
                st.session_state.chosen = option
                st.rerun()

    # --- A plain comparison table, for anyone who prefers a spreadsheet view ---
    with st.expander("See all options as a table"):
        comparison = pd.DataFrame([{
            "Supplier": option["supplier_name"],
            "Product": option["product_name"],
            f"Per {option['unit_description']}": money.money(option["price_per_unit"], currency),
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

    # --- If they've chosen a supplier, write the request ---
    if st.session_state.chosen:
        st.markdown("---")
        show_request_writer(user, profile, st.session_state.chosen, inputs)

    branding.privacy_footer()


# ==========================================================================
# SCREEN 3 - THE REQUEST, WRITTEN FOR THEM
# ==========================================================================

def show_request_writer(user, profile, option, inputs):
    st.markdown("#### Your request is written and ready")
    st.caption(
        "Filled in from your care home profile and your search. Edit anything you like, "
        "then send it from your own email — it goes straight to the supplier."
    )

    if not database.profile_is_complete(profile):
        st.warning(
            "Some of your care home details are missing, so there are gaps in the message "
            "below. Fill them in on **My Care Home** and this will complete itself.",
            icon="⚠️",
        )

    currency = profile.get("currency") or money.DEFAULT_CURRENCY

    # A short summary of what they're about to ask for
    summary = st.columns(4)
    summary[0].metric("Supplier", option["supplier_name"])
    summary[1].metric("Total cost", money.money(option["total_cost"], currency))
    summary[2].metric("Units", f"{option['billed_units']:,}")
    summary[3].metric("Delivery", f"{option['delivery_days']} days")

    # Let them adjust the date and add a note before we write it
    controls = st.columns([1, 2])
    with controls[0]:
        needed_by = st.date_input(
            "Date required",
            value=money.days_from_now(option["delivery_days"]),
            format="DD/MM/YYYY",           # UK format, as agreed
        )
    with controls[1]:
        extra_notes = st.text_input(
            "Anything else to tell the supplier? (optional)",
            placeholder="e.g. deliver to the rear entrance, ask for Maria on arrival",
        )

    # Write the message
    message = request_writer.build_request(
        profile, option, inputs["quantity"], needed_by=needed_by, extra_notes=extra_notes
    )

    edited_message = st.text_area(
        "Your request (edit freely)", value=message, height=430, key="request_text"
    )

    # --- Sending it ---
    st.markdown("##### Send it")
    send_columns = st.columns([1, 1, 1])

    with send_columns[0]:
        mailto = request_writer.mailto_link(profile, option, edited_message)
        st.link_button(
            "Open in my email app", mailto, use_container_width=True,
            help="Opens your own email program with everything filled in. Press send there.",
        )

    with send_columns[1]:
        st.download_button(
            "Download as a text file",
            edited_message.encode("utf-8"),
            file_name=f"request-{option['supplier_name'].replace(' ', '-').lower()}.txt",
            mime="text/plain",
            use_container_width=True,
        )

    with send_columns[2]:
        if st.button("Save to My Requests", use_container_width=True, type="secondary"):
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
            st.success("Saved to My Requests.")

    st.caption(
        "Sennicare doesn't email the supplier for you — the request goes from your own "
        "mailbox, so their reply comes straight back to you."
    )


# ==========================================================================
# SCREEN 4 - MY CARE HOME (the private profile)
# ==========================================================================

def show_profile_page(user, profile):
    branding.page_header(
        "My Care Home",
        "Saved once, then used to fill in every request automatically. Private to your account.",
    )

    # Show the "saved" confirmation from the last click.
    # We have to do it this way round: saving refreshes the page, and a message
    # printed before a refresh disappears before anyone can read it. So we leave
    # ourselves a note in session_state and print it after the refresh.
    if st.session_state.pop("profile_just_saved", False):
        st.success("Saved. Your requests will now fill themselves in.", icon="✅")

    with st.form("profile_form"):
        st.markdown("#### The home")
        row = st.columns([2, 1])
        care_home_name = row[0].text_input("Care home name", value=profile.get("care_home_name", ""))
        beds = row[1].number_input(
            "Number of beds", min_value=0, max_value=2000,
            value=int(profile.get("beds") or 0),
        )

        address = st.text_input("Address", value=profile.get("address", ""))

        row = st.columns(3)
        city = row[0].text_input("Town or city", value=profile.get("city", ""))
        postcode = row[1].text_input("Postcode", value=profile.get("postcode", ""))
        country = row[2].text_input("Country", value=profile.get("country", "United Kingdom"))

        st.markdown("#### Who suppliers should contact")
        row = st.columns(3)
        contact_name = row[0].text_input("Contact name", value=profile.get("contact_name", ""))
        contact_email = row[1].text_input("Contact email", value=profile.get("contact_email", ""))
        contact_phone = row[2].text_input("Contact phone", value=profile.get("contact_phone", ""))

        st.markdown("#### How you buy")
        row = st.columns(2)

        currency_codes = list(money.CURRENCIES.keys())
        current_currency = profile.get("currency") or money.DEFAULT_CURRENCY
        currency = row[0].selectbox(
            "Currency",
            currency_codes,
            index=currency_codes.index(current_currency) if current_currency in currency_codes else 0,
            format_func=lambda code: f"{money.CURRENCIES[code]['symbol']} {code} — {money.CURRENCIES[code]['name']}",
        )
        payment_terms = row[1].text_input(
            "Your payment terms", value=profile.get("payment_terms", "30 days from invoice"),
        )

        quality_standards = st.text_area(
            "Standards you require of suppliers",
            value=profile.get("quality_standards", ""),
            placeholder="e.g. All PPE must be CE marked and latex-free. Skin products must be "
                        "fragrance-free and dermatologically tested. Deliveries must include batch numbers.",
            help="This is written into every request you send, so suppliers know your requirements up front.",
        )

        delivery_notes = st.text_area(
            "Delivery instructions",
            value=profile.get("delivery_notes", ""),
            placeholder="e.g. Deliveries between 9am and 4pm, Monday to Friday. Use the service "
                        "entrance on Mill Lane. Ring the bell marked Reception.",
        )

        saved = st.form_submit_button("Save my details", use_container_width=True)

    if saved:
        database.save_profile(user["id"], {
            "care_home_name": care_home_name, "address": address, "city": city,
            "postcode": postcode, "country": country, "currency": currency,
            "contact_name": contact_name, "contact_email": contact_email,
            "contact_phone": contact_phone, "beds": beds,
            "quality_standards": quality_standards, "payment_terms": payment_terms,
            "delivery_notes": delivery_notes,
        })
        # Leave the note for after the refresh (see the top of this function)
        st.session_state.profile_just_saved = True
        st.rerun()

    branding.privacy_footer()


# ==========================================================================
# SCREEN 5 - MY REQUESTS
# ==========================================================================

def show_requests_page(user, profile):
    branding.page_header("My Requests", "Everything you've sent, and what happened next.")

    if not subscriptions.has_feature(user["tier"], "request_history"):
        st.info(
            "Request history is included on the **Professional** plan. On Starter you can "
            "still write and send requests — they just aren't kept here. See **My Plan**.",
            icon="ℹ️",
        )

    requests = database.list_requests(user["id"])

    if not requests:
        st.info("No saved requests yet. Find a supplier on **Find Supplies** and save the request.")
        branding.privacy_footer()
        return

    # A few headline numbers
    total_spend = sum(request["total_cost"] for request in requests)
    currency = profile.get("currency") or money.DEFAULT_CURRENCY

    figures = st.columns(3)
    figures[0].metric("Requests saved", len(requests))
    figures[1].metric("Total value", money.money(total_spend, currency))
    figures[2].metric("Suppliers used", len({request["supplier_name"] for request in requests}))

    st.markdown("---")

    STATUSES = ["Draft", "Sent", "Confirmed", "Delivered", "Cancelled"]

    for request in requests:
        header = (
            f"{money.uk_date(request['created_at'])} · {request['supplier_name']} · "
            f"{request['product_name']} · {money.money(request['total_cost'], request['currency'])} "
            f"· {request['status']}"
        )
        with st.expander(header):
            details = st.columns([1, 1, 1, 1])
            details[0].markdown(f"**Quantity**  \n{request['quantity']:,}")
            details[1].markdown(
                f"**Per unit**  \n{money.money(request['unit_price'], request['currency'])}")
            details[2].markdown(f"**Needed by**  \n{money.uk_date(request['needed_by'])}")
            details[3].markdown(f"**Supplier email**  \n{request['supplier_email'] or '—'}")

            st.text_area(
                "The request you sent", value=request["message"], height=240,
                key=f"request_message_{request['id']}", disabled=True,
            )

            actions = st.columns([2, 1])
            with actions[0]:
                new_status = st.selectbox(
                    "Update status", STATUSES,
                    index=STATUSES.index(request["status"]) if request["status"] in STATUSES else 1,
                    key=f"status_{request['id']}",
                )
                if new_status != request["status"]:
                    database.update_request_status(user["id"], request["id"], new_status)
                    st.rerun()
            with actions[1]:
                st.markdown("&nbsp;")
                if st.button("Delete", key=f"delete_{request['id']}", type="secondary"):
                    database.delete_request(user["id"], request["id"])
                    st.rerun()

    # Export the whole history
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

    branding.privacy_footer()


# ==========================================================================
# SCREEN 6 - MY PLAN
# ==========================================================================

def show_plan_page(user):
    branding.page_header("My Plan", "What you're on today, and what else is available.")

    current_plan = subscriptions.get_plan(user["tier"])
    used = database.count_searches_this_month(user["id"])
    left = subscriptions.searches_left(user["tier"], used)

    figures = st.columns(3)
    figures[0].metric("Your plan", current_plan["name"])
    figures[1].metric("Searches this month", used)
    figures[2].metric("Remaining", "Unlimited" if left is None else left)

    st.markdown("---")

    columns = st.columns(len(subscriptions.PLANS))
    for column, plan in zip(columns, subscriptions.PLANS):
        with column:
            is_current = plan["id"] == user["tier"]
            st.markdown(f"### {plan['name']}")
            st.markdown(f"**£{plan['monthly_price']} / month**")
            st.caption(plan["blurb"])

            allowance = "Unlimited searches" if plan["searches"] is None else f"{plan['searches']} searches a month"
            st.markdown(f"- {allowance}")
            st.markdown(f"- {plan['homes']} care home{'s' if plan['homes'] > 1 else ''}")
            for feature in plan["features"]:
                st.markdown(f"- {subscriptions.FEATURE_NAMES.get(feature, feature)}")

            if is_current:
                st.success("Your current plan")
            else:
                st.button(
                    f"Ask about {plan['name']}", key=f"ask_{plan['id']}",
                    type="secondary", use_container_width=True,
                )

    st.info(
        "**Card payments aren't switched on yet.** During the pilot, plans are changed by "
        "hand — email hello@sennicare.co.uk and we'll move your account the same day.",
        icon="ℹ️",
    )


# ==========================================================================
# SCREEN 7 - MY ACCOUNT (password, data, deletion)
# ==========================================================================

def show_account_page(user):
    branding.page_header("My Account", "Your login, your data, your choices.")

    account_tab, data_tab = st.tabs(["Password", "My data"])

    # ---------------- PASSWORD ----------------
    with account_tab:
        st.markdown(f"**Signed in as** {escape(user['email'])}")
        st.markdown(f"**Name** {escape(user['full_name'])}")

        st.markdown("---")
        st.markdown("#### Change my password")
        with st.form("password_form"):
            current = st.text_input("Current password", type="password")
            new = st.text_input("New password", type="password")
            again = st.text_input("New password again", type="password")
            changed = st.form_submit_button("Change password")

        if changed:
            worked, note = auth.change_password(user["id"], current, new, again)
            if worked:
                st.success(note)
            else:
                st.error(note)

        st.caption(
            "We store passwords scrambled (hashed), never as text — so nobody at Sennicare "
            "can read yours. There is no password reset email yet during the pilot; if you "
            "get locked out, email hello@sennicare.co.uk."
        )

    # ---------------- THEIR DATA ----------------
    with data_tab:
        st.markdown("#### What we hold about you")
        st.markdown("""
        - Your login email, your name and your scrambled password
        - Your care home profile, exactly as you typed it
        - The searches you've run (so we can count them against your plan)
        - The requests you've saved

        Nothing else. We don't track you around the internet, we don't sell anything to
        anyone, and no other subscriber can see any of it.
        """)

        everything = database.export_user_data(user["id"])

        st.download_button(
            "Download everything we hold about me (JSON)",
            json.dumps(everything, indent=2).encode("utf-8"),
            file_name="my-sennicare-data.json",
            mime="application/json",
        )

        st.markdown("---")
        st.markdown("#### Close my account")
        st.caption(
            "This deletes your account, your care home profile, your searches and your saved "
            "requests. It cannot be undone."
        )

        confirmation = st.text_input('Type DELETE to confirm', key="delete_confirm")
        if st.button("Delete my account permanently", type="secondary"):
            if confirmation.strip().upper() == "DELETE":
                database.delete_account(user["id"])
                log_out()
                st.success("Your account and all your data have been deleted.")
                st.rerun()
            else:
                st.error("Type DELETE in the box to confirm.")


# ==========================================================================
# SCREEN 8 - ADMIN (you only)
# ==========================================================================

def show_admin_page(user):
    branding.page_header("Admin", "For Sennicare staff. Subscribers never see this page.")

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
            st.success(f"Using your real catalogue: `{os.path.basename(path)}`")
        else:
            st.warning(
                f"Using the fictional sample: `{os.path.basename(path)}`. "
                f"Create `data/suppliers.csv` to go live."
            )

        figures = st.columns(4)
        figures[0].metric("Catalogue rows", summary["rows"])
        figures[1].metric("Products", summary["products"])
        figures[2].metric("Suppliers", summary["suppliers"])
        figures[3].metric("Categories", summary["categories"])

        if st.button("Reload the catalogue file", type="secondary"):
            get_catalogue.clear()      # empties the cache so the file is re-read
            st.rerun()

        st.markdown("#### Everything in the catalogue")
        st.dataframe(
            table[[
                "supplier_name", "product_name", "category", "unit_description",
                "price_per_unit", "typical_market_price", "pack_size",
                "min_order_units", "delivery_days", "quality_rating", "care_suitable",
            ]],
            use_container_width=True, hide_index=True,
        )

        st.markdown("#### Quality check")
        problems = []
        no_market_price = table[table["typical_market_price"] <= table["price_per_unit"]]
        if len(no_market_price):
            problems.append(
                f"{len(no_market_price)} row(s) have no saving against the typical market price — "
                f"managers will see 'no saving' for these."
            )
        low_quality_suitable = table[(table["quality_rating"] < catalogue_module.QUALITY_FLOOR) &
                                     (table["care_suitable_flag"])]
        if len(low_quality_suitable):
            problems.append(
                f"{len(low_quality_suitable)} row(s) are marked suitable for care but rate below "
                f"{catalogue_module.QUALITY_FLOOR}, so they can never be recommended."
            )
        if problems:
            for problem in problems:
                st.warning(problem)
        else:
            st.success("No problems found in the catalogue.")

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

        subscribers = pd.DataFrame([{
            "ID": row["id"],
            "Email": row["email"],
            "Name": row["full_name"],
            "Care home": row["care_home_name"] or "—",
            "Plan": row["tier"],
            "Searches": row["searches"],
            "Requests": row["requests"],
            "Joined": money.uk_date(row["created_at"]),
        } for row in rows])

        st.metric("Subscribers", len(subscribers))
        st.dataframe(subscribers, use_container_width=True, hide_index=True)

        st.markdown("#### Move an account onto another plan")
        st.caption("Until card payments are switched on, you do this by hand here.")

        with st.form("change_tier_form"):
            columns = st.columns([2, 2, 1])
            emails = [row["email"] for row in rows]
            chosen_email = columns[0].selectbox("Subscriber", emails) if emails else None
            new_tier = columns[1].selectbox(
                "Plan", [plan["id"] for plan in subscriptions.PLANS],
                format_func=lambda tier: subscriptions.get_plan(tier)["name"],
            )
            columns[2].markdown("&nbsp;")
            changed = st.form_submit_button("Change plan")

        if changed and chosen_email:
            matching_row = next(row for row in rows if row["email"] == chosen_email)
            auth.set_tier(matching_row["id"], new_tier)
            # If you changed your own plan, update this session too.
            if matching_row["id"] == user["id"]:
                st.session_state.user["tier"] = new_tier
            st.success(f"{chosen_email} moved to {subscriptions.get_plan(new_tier)['name']}.")
            st.rerun()


# ==========================================================================
# THE ROUTER - decides which screen to show
# ==========================================================================

def main():
    user = st.session_state.user

    # Nobody logged in? Show the welcome screen and stop.
    if user is None:
        show_welcome_screen()
        return

    # Load THIS user's profile. Every page below gets only their own data.
    profile = database.get_profile(user["id"])

    show_sidebar(user, profile)

    page = st.session_state.page
    if page == "Find Supplies":
        show_search_page(user, profile)
    elif page == "My Care Home":
        show_profile_page(user, profile)
    elif page == "My Requests":
        show_requests_page(user, profile)
    elif page == "My Plan":
        show_plan_page(user)
    elif page == "My Account":
        show_account_page(user)
    elif page == "Admin" and is_admin(user):
        show_admin_page(user)
    else:
        show_search_page(user, profile)


main()
