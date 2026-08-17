"""
Sennicare - subscription plans
==============================

The plans live HERE and nowhere else. To change a price, a limit or what a plan
includes, edit the PLANS list below - the whole app follows it automatically.

No card payments yet, on purpose. Everyone starts on "starter" and you move an
account up by hand from the Admin page. When you're ready to take payments
(Stripe is the usual choice), the only thing that changes is WHO calls
auth.set_tier() - the payment provider instead of you. Nothing else in the app
needs rewriting. That is what "build the structure now" means.
"""

# ==========================================================================
# THE PLANS
#   monthly_price  - in pounds. Change freely.
#   searches       - how many searches a month. None means unlimited.
#   homes          - how many care homes one account can hold.
#   features       - switches the app checks with has_feature()
# ==========================================================================
PLANS = [
    {
        "id": "starter",
        "name": "Starter",
        "monthly_price": 49,
        "searches": 25,
        "homes": 1,
        "features": ["search", "top_recommendation", "request_writer"],
        "blurb": "One care home, 25 searches a month. Everything you need to start saving.",
    },
    {
        "id": "professional",
        "name": "Professional",
        "monthly_price": 99,
        "searches": None,          # unlimited
        "homes": 1,
        "features": [
            "search", "top_recommendation", "request_writer",
            "request_history", "export", "price_benchmarks",
        ],
        "blurb": "Unlimited searches, full request history, spreadsheet exports and price benchmarks.",
    },
    {
        "id": "group",
        "name": "Group",
        "monthly_price": 249,
        "searches": None,
        "homes": 10,
        "features": [
            "search", "top_recommendation", "request_writer",
            "request_history", "export", "price_benchmarks",
            "multiple_homes", "priority_support",
        ],
        "blurb": "For groups running up to 10 homes, with priority support.",
    },
]

# A plain-English name for each feature, used when we have to explain that
# something is not included on the current plan.
FEATURE_NAMES = {
    "search": "Supplier search",
    "top_recommendation": "Top recommendation",
    "request_writer": "Automatic request writing",
    "request_history": "Request history",
    "export": "Spreadsheet export",
    "price_benchmarks": "Price benchmarks",
    "multiple_homes": "Multiple care homes",
    "priority_support": "Priority support",
}


def get_plan(tier_id):
    """Finds a plan by its id. Falls back to Starter if the id is unknown."""
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
