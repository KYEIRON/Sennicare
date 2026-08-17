"""
Sennicare - finding and ranking suppliers
=========================================

This file is the brain of the platform. It does two jobs:

  1. SEARCH   - find the catalogue entries that match what the manager typed
  2. RANK     - decide which one is the TOP RECOMMENDATION

THE RANKING RULE (this is the promise Sennicare makes)
------------------------------------------------------
The top recommendation weighs THREE things equally - one third each:

     PRICE          how cheap is it, compared with the cheapest option found
     SPEED          how fast is it, compared with the fastest option found
     QUALITY        its rating out of 5, and whether it is suitable for
                    elderly care

AND there is a hard rule on top of the scoring:

     A product is NEVER recommended if it is marked unsuitable for elderly
     care, or if its quality rating is below the floor (3.5 out of 5) - no
     matter how cheap it is.

So the cheapest option can appear in the list, clearly priced, while a better
product is recommended. When that happens we say so out loud, so the manager
understands why we didn't just pick the cheap one.
"""

import math
import pandas as pd

from .catalogue import QUALITY_FLOOR


# How much each of the three things counts. They add up to 1.0 (100%).
# Change these if you ever want price to matter more than quality - but read
# PRINCIPLE 2 first, because equal weighting is the point.
WEIGHT_PRICE = 1 / 3
WEIGHT_SPEED = 1 / 3
WEIGHT_QUALITY = 1 / 3


# ==========================================================================
# STEP 1 - SEARCH
# ==========================================================================

# How much a word is worth depending on WHERE it is found. A word in the product
# name means far more than the same word in the category: searching "continence
# pads" should find continence pads, not everything filed under Continence.
POINTS_FOR_NAME = 3
POINTS_FOR_KEYWORDS = 2
POINTS_FOR_CATEGORY = 1

# Very common words that shouldn't count towards relevance on their own.
IGNORED_WORDS = {"the", "a", "an", "and", "or", "for", "of", "with", "in", "to", "some", "any"}


def search_terms(text):
    """
    Breaks what the manager typed into search terms.

    Each term is a small group of spellings that mean the same thing, so that
    "gloves" also finds "glove" and vice versa. Grouping them matters: it means a
    row is scored ONCE for the idea of "glove", not twice for happening to
    contain both spellings.
    """
    terms = []
    for raw_word in str(text).lower().replace(",", " ").replace("/", " ").split():
        word = "".join(character for character in raw_word if character.isalnum())
        if not word or word in IGNORED_WORDS:
            continue

        spellings = {word}
        if len(word) > 3 and word.endswith("s"):
            spellings.add(word[:-1])        # gloves -> glove
        else:
            spellings.add(word + "s")       # glove  -> gloves

        terms.append(spellings)
    return terms


def score_relevance(table, product_text):
    """
    Scores every row against what the manager typed. Returns two columns:

      terms_matched - HOW MANY of the typed terms the row genuinely contains.
                      A term only counts if it appears in the product name or
                      the keywords. The category alone is NOT enough - that is
                      what stops "continence pads" matching everything filed
                      under Continence.

      points        - a finer score used for ordering, giving more weight to
                      words found in the product name than in the keywords.
    """
    terms = search_terms(product_text)

    if not terms:
        zeros = pd.Series(0, index=table.index)
        return zeros, zeros

    terms_matched = pd.Series(0, index=table.index)
    points = pd.Series(0, index=table.index)

    for spellings in terms:
        # Does the row contain ANY spelling of this term, in each field?
        in_name = pd.Series(False, index=table.index)
        in_keywords = pd.Series(False, index=table.index)
        in_category = pd.Series(False, index=table.index)

        for spelling in spellings:
            in_name |= table["name_text"].str.contains(spelling, regex=False)
            in_keywords |= table["keywords_text"].str.contains(spelling, regex=False)
            in_category |= table["category_text"].str.contains(spelling, regex=False)

        # A term is "matched" only by the name or the keywords.
        terms_matched += (in_name | in_keywords).astype(int)

        # Points: award for the strongest place the term was found, not all three.
        points += (
            in_name * POINTS_FOR_NAME
            + (~in_name & in_keywords) * POINTS_FOR_KEYWORDS
            + (~in_name & ~in_keywords & in_category) * POINTS_FOR_CATEGORY
        )

    return terms_matched, points


def find_matches(table, product_text, category=None):
    """
    Returns the rows of the catalogue that genuinely match the search.

    THE RULE: we keep only the rows that match AS MANY of the typed terms as the
    best row in the catalogue does.

    In practice that means:
      - "gloves"            -> every glove, because they all match the one term
      - "continence pads"   -> only products that are BOTH continence AND pads,
                               so bed protection sheets no longer creep in
      - "hand sanitiser"    -> hand sanitiser, not surface sanitiser wipes
      - a long phrase like "blue nitrile gloves size medium" still works: no row
        contains "blue" or "medium", so the best any row manages is
        nitrile + gloves, and those rows are the ones we show

    This gives an exact match when one exists and the closest thing when it
    doesn't - without ever silently returning something unrelated.
    """
    terms_matched, points = score_relevance(table, product_text)

    best = int(terms_matched.max()) if len(terms_matched) else 0

    if best == 0:
        # Nothing matched at all. If they also picked a category, show that
        # category so the search isn't a dead end.
        if category and category != "All categories":
            matches = table[table["category"] == category].copy()
            matches["relevance"] = 0
            return matches
        empty = table.iloc[0:0].copy()
        empty["relevance"] = 0
        return empty

    keep = terms_matched == best
    matches = table[keep].copy()
    matches["relevance"] = points[keep]

    if category and category != "All categories":
        matches = matches[matches["category"] == category]

    return matches


# ==========================================================================
# STEP 2 - WORK OUT THE REAL COST OF EACH OPTION
# ==========================================================================

def price_up(row, quantity):
    """
    Works out what one catalogue row would actually cost for the quantity asked
    for, respecting pack sizes and minimum orders.

    Example: a manager wants 100 gloves, they come in cases of 200, and the
    minimum order is 200. They will be billed for 200 gloves - so we say so,
    rather than quietly quoting for 100.
    """
    pack_size = max(1, int(row["pack_size"]))
    minimum = max(1, int(row["min_order_units"]))

    # Round the requested quantity up to a whole number of cases...
    cases = math.ceil(quantity / pack_size)
    billed_units = cases * pack_size

    # ...and up again if that is still below the supplier's minimum order.
    if billed_units < minimum:
        cases = math.ceil(minimum / pack_size)
        billed_units = cases * pack_size

    total_cost = billed_units * float(row["price_per_unit"])

    # What the same number of units would normally cost elsewhere
    typical_cost = billed_units * float(row["typical_market_price"])
    saving = typical_cost - total_cost

    return {
        "cases": cases,
        "billed_units": billed_units,
        "extra_units": billed_units - quantity,   # units above what they asked for
        "total_cost": total_cost,
        "typical_cost": typical_cost,
        "saving": saving,
        "saving_percent": (saving / typical_cost * 100) if typical_cost > 0 else 0.0,
    }


def build_options(matches, quantity, budget=None, within_days=None):
    """
    Turns matching catalogue rows into a list of priced, scored options.

    budget and within_days are optional. When given, options that break them are
    kept but MARKED - they appear in a separate "just outside your limits"
    section rather than vanishing, because a manager may well want to know that
    £2 more buys a far better product.
    """
    options = []

    for _, row in matches.iterrows():
        costing = price_up(row, quantity)

        over_budget = budget is not None and costing["total_cost"] > budget
        too_slow = within_days is not None and int(row["delivery_days"]) > within_days

        options.append({
            # --- who and what ---
            "supplier_name": row["supplier_name"],
            "supplier_email": row["supplier_email"],
            "product_name": row["product_name"],
            "category": row["category"],
            "unit_description": row["unit_description"],
            "certifications": row["certifications"],
            "notes": row["notes"],
            # --- numbers ---
            "price_per_unit": float(row["price_per_unit"]),
            "typical_market_price": float(row["typical_market_price"]),
            "pack_size": int(row["pack_size"]),
            "min_order_units": int(row["min_order_units"]),
            "delivery_days": int(row["delivery_days"]),
            "quality_rating": float(row["quality_rating"]),
            "care_suitable": bool(row["care_suitable_flag"]),
            # --- costing for this quantity ---
            **costing,
            # --- how well it fits what they asked for ---
            "over_budget": over_budget,
            "too_slow": too_slow,
            "within_limits": not over_budget and not too_slow,
            "relevance": int(row.get("relevance", 0)),
        })

    return options


# ==========================================================================
# STEP 3 - SCORE AND RANK
# ==========================================================================

def score_options(options):
    """
    Gives every option a score out of 100 for price, speed, quality and overall.

    Each score is RELATIVE to the other options found, which is what makes it
    meaningful: "the cheapest option available" rather than an abstract number.
    """
    if not options:
        return options

    # The best figures found anywhere in this set of results
    cheapest = min(option["total_cost"] for option in options)
    fastest = min(option["delivery_days"] for option in options)

    for option in options:
        # --- PRICE: the cheapest scores 1.0, something twice as dear scores 0.5
        option["price_score"] = cheapest / option["total_cost"] if option["total_cost"] > 0 else 1.0

        # --- SPEED: the fastest scores 1.0. We add 1 to both sides so that
        # same-day (0 days) doesn't divide by zero.
        option["speed_score"] = (fastest + 1) / (option["delivery_days"] + 1)

        # --- QUALITY: the rating out of 5, with a penalty if it is marked
        # unsuitable for elderly care.
        quality = option["quality_rating"] / 5.0
        if not option["care_suitable"]:
            quality *= 0.4
        option["quality_score"] = quality

        # --- OVERALL: the three, weighted equally
        option["overall_score"] = (
            option["price_score"] * WEIGHT_PRICE +
            option["speed_score"] * WEIGHT_SPEED +
            option["quality_score"] * WEIGHT_QUALITY
        )

        # Turn the 0-1 scores into friendlier 0-100 figures for display
        for name in ["price_score", "speed_score", "quality_score", "overall_score"]:
            option[name + "_100"] = round(option[name] * 100)

    return options


def passes_care_standards(option):
    """
    The hard rule. An option can only be recommended if it is marked suitable
    for elderly care AND meets the quality floor.
    """
    return option["care_suitable"] and option["quality_rating"] >= QUALITY_FLOOR


def rank(options):
    """
    Sorts options best-first: those inside the manager's limits first, then by
    overall score, and finally by price as a tie-breaker.
    """
    return sorted(
        options,
        key=lambda option: (
            not option["within_limits"],       # False sorts before True
            -option["overall_score"],
            option["total_cost"],
        ),
    )


def choose_recommendation(options):
    """
    Picks the top recommendation and explains it in plain English.

    Returns (the chosen option or None, the reason as text).
    """
    if not options:
        return None, ""

    # Only options that fit the budget, hit the date AND meet care standards
    eligible = [option for option in options
                if option["within_limits"] and passes_care_standards(option)]

    # If nothing fits the limits, widen to anything meeting care standards, so
    # we can still recommend something safe and say it's slightly outside.
    relaxed = False
    if not eligible:
        eligible = [option for option in options if passes_care_standards(option)]
        relaxed = True

    # If nothing at all meets care standards, we recommend nothing and say so.
    if not eligible:
        return None, (
            "None of these options meet our quality standard for elderly care, so we are "
            "not recommending any of them. They are listed below with their ratings so you "
            "can judge for yourself - but we would suggest searching for an alternative product."
        )

    best = max(eligible, key=lambda option: option["overall_score"])
    reason = explain_choice(best, options, relaxed)
    return best, reason


def explain_choice(best, all_options, relaxed=False):
    """
    Writes the sentence that appears under the top recommendation.
    Being able to explain the choice is what makes it trustworthy.
    """
    parts = []

    cheapest = min(all_options, key=lambda option: option["total_cost"])
    fastest = min(all_options, key=lambda option: option["delivery_days"])

    # Is it the cheapest, or did we knowingly pass over something cheaper?
    if best is cheapest or best["total_cost"] <= cheapest["total_cost"]:
        parts.append("it is the lowest total cost of everything we found")
    else:
        difference = best["total_cost"] - cheapest["total_cost"]
        if passes_care_standards(cheapest):
            parts.append(
                f"it costs £{difference:,.2f} more than the cheapest option but scores "
                f"better on quality and delivery"
            )
        else:
            parts.append(
                f"the cheapest option ({cheapest['supplier_name']}) is £{difference:,.2f} less "
                f"but is not suitable for elderly care, so we have not recommended it"
            )

    # Speed
    if best["delivery_days"] <= fastest["delivery_days"]:
        parts.append("it is also the fastest to arrive")
    else:
        parts.append(f"it arrives in about {best['delivery_days']} working days")

    # Quality
    parts.append(f"and it rates {best['quality_rating']:.1f} out of 5 for quality")
    if best["certifications"] and best["certifications"].lower() != "none listed":
        parts.append(f"with {best['certifications']}")

    sentence = "This is our top recommendation because " + ", ".join(parts) + "."

    if relaxed:
        sentence += (
            " Note: nothing met your budget and delivery date exactly, so this is the best "
            "safe option just outside your limits."
        )

    return sentence


# ==========================================================================
# THE WHOLE SEARCH, IN ONE CALL
# This is what the app actually uses.
# ==========================================================================

def search(table, product_text, quantity, budget=None, within_days=None, category=None):
    """
    Does everything: find, price up, score, rank, recommend.

    Returns a dictionary:
        matches_found     how many catalogue entries matched
        options           every option, best first
        within_limits     just the ones inside budget and delivery date
        outside_limits    the ones that broke a limit
        recommendation    the single best option (or None)
        reason            why it was chosen, in plain English
        cheapest          the lowest-cost option, for comparison
        total_saving      what the recommendation saves against typical prices
    """
    matches = find_matches(table, product_text, category)

    if matches.empty:
        return {
            "matches_found": 0, "options": [], "within_limits": [], "outside_limits": [],
            "recommendation": None, "reason": "", "cheapest": None, "total_saving": 0.0,
        }

    options = build_options(matches, quantity, budget, within_days)
    options = score_options(options)
    options = rank(options)

    recommendation, reason = choose_recommendation(options)

    return {
        "matches_found": len(options),
        "options": options,
        "within_limits": [option for option in options if option["within_limits"]],
        "outside_limits": [option for option in options if not option["within_limits"]],
        "recommendation": recommendation,
        "reason": reason,
        "cheapest": min(options, key=lambda option: option["total_cost"]),
        "total_saving": recommendation["saving"] if recommendation else 0.0,
    }
