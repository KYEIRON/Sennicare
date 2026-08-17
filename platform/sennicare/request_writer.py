"""
Sennicare - writing the supply request
======================================

When a manager picks a supplier, this file writes the request message for them.
It pulls the care home's details from THEIR OWN profile and the product details
from THEIR OWN search - so nothing has to be typed twice.

The manager sees the finished message, can edit any word of it, and only then
chooses to send it. Nothing leaves their account until they press the button.
"""

from datetime import date

from . import money


def build_request(profile, option, quantity, needed_by=None, extra_notes=""):
    """
    Writes a professional supply request.

    profile     - the care home's saved details (from the database)
    option      - the supplier option they chose (from the search results)
    quantity    - how many units they asked for
    needed_by   - the date they need it (a date, or None to work it out)
    extra_notes - anything they typed into the "anything else?" box

    Returns the message as plain text.
    """
    currency = profile.get("currency") or money.DEFAULT_CURRENCY

    # If they didn't give a date, use the supplier's own delivery estimate.
    if needed_by is None:
        needed_by = money.days_from_now(option["delivery_days"])

    # --- The delivery address, built from the profile, skipping blank lines ---
    address_lines = [
        profile.get("care_home_name", ""),
        profile.get("address", ""),
        profile.get("city", ""),
        profile.get("postcode", ""),
        profile.get("country", ""),
    ]
    address_block = "\n".join(line for line in address_lines if str(line).strip())

    # --- Pack wording: only mention cases if they actually come in cases ---
    if option["pack_size"] > 1:
        pack_note = (
            f"{option['cases']} case(s) of {option['pack_size']} "
            f"= {option['billed_units']} {option['unit_description']}(s)"
        )
    else:
        pack_note = f"{option['billed_units']} {option['unit_description']}(s)"

    # --- Build the message ---
    lines = []
    lines.append(f"Subject: Supply request - {option['product_name']} - {profile.get('care_home_name', '')}")
    lines.append("")
    lines.append(f"Dear {option['supplier_name']},")
    lines.append("")
    lines.append(
        f"We would like to place an order for the following. Please confirm availability, "
        f"price and delivery date by return."
    )
    lines.append("")
    lines.append("PRODUCT REQUIRED")
    lines.append(f"  Item:            {option['product_name']}")
    lines.append(f"  Quantity:        {quantity:,} {option['unit_description']}(s)")
    lines.append(f"  Order quantity:  {pack_note}")
    lines.append(f"  Price quoted:    {money.money(option['price_per_unit'], currency)} per {option['unit_description']}")
    lines.append(f"  Total expected:  {money.money(option['total_cost'], currency)}")
    lines.append(f"  Required by:     {money.uk_date(needed_by)}")

    if option["certifications"] and option["certifications"].lower() != "none listed":
        lines.append(f"  Standard:        {option['certifications']}")

    lines.append("")
    lines.append("DELIVERY ADDRESS")
    for line in address_block.split("\n"):
        lines.append(f"  {line}")

    if profile.get("delivery_notes", "").strip():
        lines.append("")
        lines.append("DELIVERY NOTES")
        lines.append(f"  {profile['delivery_notes'].strip()}")

    # --- Our standards and terms, straight from the profile ---
    if profile.get("quality_standards", "").strip():
        lines.append("")
        lines.append("OUR REQUIREMENTS")
        lines.append(f"  {profile['quality_standards'].strip()}")

    lines.append("")
    lines.append("PAYMENT TERMS")
    lines.append(f"  {profile.get('payment_terms') or '30 days from invoice'}")

    if extra_notes.strip():
        lines.append("")
        lines.append("ADDITIONAL NOTES")
        lines.append(f"  {extra_notes.strip()}")

    lines.append("")
    lines.append("Please confirm by return, including a delivery date and your invoice details.")
    lines.append("")
    lines.append("Kind regards,")
    lines.append("")
    lines.append(profile.get("contact_name", ""))
    if profile.get("care_home_name", ""):
        lines.append(profile["care_home_name"])
    if profile.get("contact_email", ""):
        lines.append(profile["contact_email"])
    if profile.get("contact_phone", ""):
        lines.append(profile["contact_phone"])

    return "\n".join(lines)


def subject_line(profile, option):
    """The email subject on its own, for the mailto link."""
    return f"Supply request - {option['product_name']} - {profile.get('care_home_name', '')}"


def body_without_subject(message):
    """
    Strips the "Subject:" line off the top of the message, because in an email
    the subject goes in its own box rather than in the body.
    """
    lines = message.split("\n")
    if lines and lines[0].startswith("Subject:"):
        # Also drop the blank line that follows it
        remaining = lines[1:]
        while remaining and remaining[0].strip() == "":
            remaining = remaining[1:]
        return "\n".join(remaining)
    return message


def mailto_link(profile, option, message):
    """
    Builds a "mailto:" web link. Clicking it opens the manager's own email
    program (Outlook, Gmail and so on) with the supplier's address, the subject
    and the whole message already filled in. They press send.

    This deliberately keeps Sennicare out of the middle: the email goes from the
    care home's own mailbox, straight to the supplier.
    """
    from urllib.parse import quote

    subject = quote(subject_line(profile, option))
    body = quote(body_without_subject(message))
    address = quote(option.get("supplier_email", ""))

    return f"mailto:{address}?subject={subject}&body={body}"
