"""
Sennicare - money and dates
===========================

One small file that knows how to print money and dates properly. Everything
else in the app asks this file, which means:

  - Pounds are shown as £1,234.50 everywhere, never as 1234.5
  - Dates are shown the UK way, 17/08/2026, never the American way
  - Adding dollars or Canadian dollars later is a two-line change (see CURRENCIES)

The prices in the supplier catalogue are stored in one currency (pounds by
default). Converting between currencies needs live exchange rates, which is a
job for later - so for now a care home simply works in its own currency and the
catalogue is priced in it.
"""

from datetime import datetime, date, timedelta


# ==========================================================================
# CURRENCIES
# To add one, copy a line. "code" is what gets stored in the database.
# ==========================================================================
CURRENCIES = {
    "GBP": {"symbol": "£",  "name": "British Pound",     "country": "United Kingdom"},
    "USD": {"symbol": "$",  "name": "US Dollar",         "country": "United States"},
    "CAD": {"symbol": "C$", "name": "Canadian Dollar",   "country": "Canada"},
    "EUR": {"symbol": "€",  "name": "Euro",              "country": "Ireland"},
    "AUD": {"symbol": "A$", "name": "Australian Dollar", "country": "Australia"},
}

DEFAULT_CURRENCY = "GBP"


def symbol_for(currency_code):
    """The symbol for a currency code, e.g. "GBP" gives "£"."""
    return CURRENCIES.get(currency_code, CURRENCIES[DEFAULT_CURRENCY])["symbol"]


def money(amount, currency_code=DEFAULT_CURRENCY, pence=True):
    """
    Formats an amount as money.
      money(1234.5)               gives  "£1,234.50"
      money(1234.5, pence=False)  gives  "£1,235"
      money(20, "USD")            gives  "$20.00"

    The ",.2f" below means "use thousands commas and two decimal places".
    """
    symbol = symbol_for(currency_code)
    if pence:
        return f"{symbol}{amount:,.2f}"
    return f"{symbol}{round(amount):,}"


def uk_date(value):
    """
    Shows a date the UK way: DD/MM/YYYY.
    Accepts a date, a datetime, or a stored text date like "2026-08-17T09:30:00".
    """
    if value is None or value == "":
        return ""

    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return value          # not a date we recognise - show it as-is

    return value.strftime("%d/%m/%Y")


def days_from_now(number_of_days):
    """The date a given number of days from today - e.g. for a delivery date."""
    return date.today() + timedelta(days=int(number_of_days))


def working_out(amount, currency_code=DEFAULT_CURRENCY):
    """
    A shorter money format for use inside sentences, without pence:
    "saves you £342".
    """
    return money(amount, currency_code, pence=False)
