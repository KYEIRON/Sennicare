"""
Sennicare - the look of the app
===============================

Streamlit (the tool that turns this Python code into a web app) has its own
default look. This file paints Sennicare's colours over the top, so the platform
matches the website: navy, magenta, cyan.

If you change a brand colour, change it here and on the website's styles.css.
"""

import streamlit as st


# The same colours as the website
NAVY = "#0A1172"
MAGENTA = "#E30B5C"
CYAN = "#00B2D9"
WHITE = "#FFFFFF"
GREY_LIGHT = "#F5F7FA"
TEXT_BODY = "#454B66"
BORDER = "#E3E8F0"
GREEN = "#0E8A5F"     # for "good" messages
AMBER = "#B26B00"     # for warnings


# The Sennicare logo, written directly into the page as an SVG drawing:
# navy house, cyan heartbeat, magenta heart on the roof. Same as the website.
#
# It is deliberately kept on ONE line. Streamlit's markdown treats indented
# lines as a block of example code, so multi-line HTML gets printed on screen
# as raw text instead of being drawn.
LOGO_SVG = (
    '<svg viewBox="0 0 64 64" width="42" height="42" aria-hidden="true">'
    '<path d="M32 18 L25.4 11.4 A4.65 4.65 0 0 1 32 4.8 A4.65 4.65 0 0 1 38.6 11.4 Z" fill="#E30B5C"/>'
    '<path d="M7 36 L32 17 L57 36 M11 33 L11 58 M53 33 L53 58 M11 58 L53 58" fill="none" '
    'stroke="#0A1172" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
    '<path d="M15 47 H22 L26.5 38 L31 55 L35.5 44 L39 47 H49" fill="none" '
    'stroke="#00B2D9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    "</svg>"
)


def apply_branding():
    """
    Injects our colours and spacing into the page.
    Called once at the top of app.py.
    """
    st.markdown(f"""
    <style>
      /* ---- Fonts and body text ---- */
      html, body, [class*="css"] {{
        font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
      }}

      /* ---- Headings in Sennicare navy ---- */
      h1, h2, h3, h4 {{ color: {NAVY}; letter-spacing: -0.02em; }}

      /* ---- Buttons: magenta, like the website's call-to-action ---- */
      .stButton > button, .stFormSubmitButton > button, .stDownloadButton > button {{
        background: {MAGENTA};
        color: {WHITE};
        border: none;
        border-radius: 8px;
        font-weight: 700;
        padding: 0.55rem 1.3rem;
        transition: background 0.15s ease;
      }}
      .stButton > button:hover, .stFormSubmitButton > button:hover,
      .stDownloadButton > button:hover {{
        background: #C10A4E;
        color: {WHITE};
      }}
      /* "secondary" buttons are outlined navy instead of solid magenta */
      .stButton > button[kind="secondary"] {{
        background: {WHITE};
        color: {NAVY};
        border: 1.5px solid {BORDER};
      }}
      .stButton > button[kind="secondary"]:hover {{
        border-color: {CYAN};
        color: {NAVY};
        background: {GREY_LIGHT};
      }}

      /* ---- The sidebar ---- */
      section[data-testid="stSidebar"] {{
        background: {GREY_LIGHT};
        border-right: 1px solid {BORDER};
      }}

      /* ---- Tabs: cyan underline on the selected tab ---- */
      .stTabs [aria-selected="true"] {{
        color: {NAVY} !important;
        border-bottom-color: {CYAN} !important;
      }}

      /* ---- Our own card styles, used for search results ---- */
      .sc-card {{
        background: {WHITE};
        border: 1px solid {BORDER};
        border-left: 5px solid {CYAN};
        border-radius: 12px;
        padding: 18px 20px;
        margin-bottom: 14px;
      }}
      .sc-card--top {{
        border: 2px solid {MAGENTA};
        border-left-width: 6px;
        background: rgba(227, 11, 92, 0.04);
      }}
      .sc-card--warn {{
        border-left-color: {AMBER};
        background: {GREY_LIGHT};
      }}
      .sc-card--blocked {{
        border-left-color: #9AA0B4;
        background: {GREY_LIGHT};
      }}

      /* The little "TOP RECOMMENDATION" flag */
      .sc-flag {{
        display: inline-block;
        background: {MAGENTA};
        color: {WHITE};
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 4px 12px;
        border-radius: 999px;
        margin-bottom: 10px;
      }}
      .sc-flag--quality {{ background: {NAVY}; }}
      .sc-flag--warn    {{ background: {AMBER}; }}
      .sc-flag--blocked {{ background: #6B7280; }}

      /* Product name inside a card */
      .sc-product {{ font-size: 19px; font-weight: 800; color: {NAVY}; margin-bottom: 2px; }}
      .sc-supplier {{ font-size: 15px; color: {TEXT_BODY}; margin-bottom: 12px; }}

      /* The row of figures inside a card */
      .sc-figures {{ display: flex; flex-wrap: wrap; gap: 26px; margin: 12px 0; }}
      .sc-figure__label {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: {TEXT_BODY}; }}
      .sc-figure__value {{ font-size: 22px; font-weight: 800; color: {NAVY}; line-height: 1.2; }}
      .sc-figure__value--total {{ color: {MAGENTA}; }}
      .sc-figure__value--save  {{ color: {GREEN}; }}

      .sc-note   {{ font-size: 14px; color: {TEXT_BODY}; margin-top: 6px; }}
      .sc-reason {{ font-size: 15px; color: {NAVY}; margin-top: 10px; font-weight: 500; }}

      /* Saving badge */
      .sc-saving {{
        display: inline-block; background: rgba(14, 138, 95, 0.10); color: {GREEN};
        border-radius: 6px; padding: 3px 10px; font-size: 14px; font-weight: 700;
      }}

      /* Privacy line, shown small and quiet at the bottom of pages */
      .sc-privacy {{
        font-size: 13px; color: {TEXT_BODY}; border-top: 1px solid {BORDER};
        padding-top: 12px; margin-top: 26px;
      }}
    </style>
    """, unsafe_allow_html=True)


def page_header(title, subtitle=""):
    """
    Draws the logo, the Sennicare name and a page title.

    IMPORTANT: the HTML below is built as ONE long line with no indentation.
    Streamlit reads indented lines as a block of example code and would print
    the raw HTML on screen instead of drawing it.
    """
    subtitle_html = (
        f'<p style="color:{TEXT_BODY};font-size:17px;margin:0 0 22px">{subtitle}</p>'
        if subtitle else ""
    )

    header_html = (
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:2px">'
        + LOGO_SVG
        + f'<span style="font-size:26px;font-weight:800;color:{NAVY};'
          f'letter-spacing:-0.02em">Sennicare</span>'
        + "</div>"
        + f'<h1 style="margin:8px 0 4px;font-size:32px">{title}</h1>'
        + subtitle_html
    )

    st.markdown(header_html, unsafe_allow_html=True)


def privacy_footer():
    """The reassurance line shown at the bottom of the working pages."""
    st.markdown(
        '<p class="sc-privacy">🔒 Your care home details, searches and requests are stored in '
        'your own account. No other subscriber can see them, and nothing is shared with a '
        'supplier until you choose to send a request.</p>',
        unsafe_allow_html=True,
    )
