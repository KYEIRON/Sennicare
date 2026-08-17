"""
Sennicare platform - the working parts
======================================

This folder holds the pieces the app is built from. Each file does one job, so
you always know where to look:

  database.py        Stores everything. Keeps each subscriber's data separate.
  auth.py            Registration, login, passwords.
  subscriptions.py   The subscription plans and what each one unlocks.
  catalogue.py       Reads the supplier spreadsheet.
  matching.py        Searches, scores and picks the top recommendation.
  request_writer.py  Writes the supply request message.
  money.py           Prints money and dates properly (£ and DD/MM/YYYY).
  branding.py        Makes the app look like Sennicare.

The app itself - the screens a manager sees - is in ../app.py
"""

__version__ = "0.1.0"
