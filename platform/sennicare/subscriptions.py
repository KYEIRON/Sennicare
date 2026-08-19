"""
Sennicare - subscription plans
==============================

The plans live HERE and nowhere else. To change a price or what a plan
includes, edit the PLANS list below - the whole app follows it automatically.

These match the pricing page on the website exactly. If you change one, change
the other: website/pricing.html and website/index.html.

No card payments yet, on purpose. Everyone starts on the free plan and you move
an account up by hand from the Admin page. When you're ready to take payments
(Stripe is the usual choice), the only thing that changes is WHO calls
auth.set_tier() - the payment provider instead of you. Nothing else in the app
needs rewriting. That is what "build the structure now" means.
"""

# ==========================================================================
# THE PLANS
#   monthly_price  - in pounds. Change freely.
#   searches       - how many searches a month. None means unlimited.
#   user_accounts  - how many logins the plan allows. None means unlimited.
#                    NOT ENFORCED YET: the app has one login per account, so
#                    this is here to match the website and to be ready for
#                    when multiple logins are built.
#   homes          - how many care homes one account can hold.
#   features       - switches the app checks with has_feature()
# ==========================================================================
PLANS = [
    {
        "id": "free",
        "name": "Free Forever",
        "monthly_price": 0,
        "searches": None,          # unlimited - the website promises no limit
        "user_accounts": 2,
        "homes": 1,
        "features": [
            "search", "top_recommendation", "request_writer", "request_history",
        ],
        "blurb": "Essential procurement visibility.",
        # What the website lists, in the website's words
        "website_features": [
            "Up to 2 user accounts",
            "Basic supplier directory access",
            "Monthly spend summary reports",
            "Standard email support",
        ],
    },
    {
        "id": "professional",
        "name": "Professional",
        "monthly_price": 49,
        "searches": None,
        "user_accounts": None,     # unlimited
        "homes": 1,
        "features": [
            "search", "top_recommendation", "request_writer",
            "request_history", "export", "price_benchmarks", "priority_support",
        ],
        "blurb": "Advanced analytics & automated savings.",
        "website_features": [
            "Unlimited user accounts",
            "Full market intelligence dashboard",
            "Automated price discrepancy alerts",
            "API integrations & export",
            "Priority 24/7 support",
        ],
    },
]

# Older accounts may still be stored under names we no longer use. This maps
# them onto the current plans so nobody loses access when they next sign in.
LEGACY_TIERS = {
    "starter": "free",          # the old £49 entry plan
    "group": "professional",    # the old £249 plan
}

# A plain-English name for each feature, used when we have to explain that
# something is not included on the current plan.
FEATURE_NAMES = {
    "search": "Supplier search",
    "top_recommendation": "Top recommendation",
    "request_writer": "Automatic request writing",
    "request_history": "Request history",
    "export": "Spreadsheet export and API",
    "price_benchmarks": "Full market intelligence dashboard",
    "multiple_homes": "Multiple care homes",
    "priority_support": "Priority 24/7 support",
}


def get_plan(tier_id):
    """
    Finds a plan by its id.

    Old accounts may be stored under a name we no longer use, so we translate
    those first (see LEGACY_TIERS). Anything still unrecognised falls back to
    the free plan, which is the safe direction to fail in - nobody is locked
    out, they just don't get paid features they haven't paid for.
    """
    tier_id = LEGACY_TIERS.get(tier_id, tier_id)
    for plan in PLANS:
        if plan["id"] == tier_id:
            return plan
    return PLANS[0]


def has_feature(tier_id, feature):
    """True if this plan includes the named feature."""
    return feature in get_plan(tier_id)["features"]


def search_allowance(tier_id):
    """How many searches a month this plan allows. None means unlimited."""
    return get_plan(tier_id)["searches"]


def searches_left(tier_id, used_this_month):
    """
    How many searches remain this month.
    Returns None when the plan is unlimited, so the app can say "Unlimited"
    rather than printing a number.
    """
    allowance = search_allowance(tier_id)
    if allowance is None:
        return None
    return max(0, allowance - used_this_month)


def can_search(tier_id, used_this_month):
    """True if this subscriber may run another search right now."""
    remaining = searches_left(tier_id, used_this_month)
    return remaining is None or remaining > 0
