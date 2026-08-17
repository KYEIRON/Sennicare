"""
Sennicare - the look of the app
===============================

Streamlit (the tool that turns this Python code into a web app) has its own
default look. This file paints Sennicare's design over the top.

THE DESIGN, IN WORDS
--------------------
Calm and modern. That means:
  - Soft off-white page, white cards, generous space between things
  - Deep navy sidebar - steady and quiet, not a block of shouting colour
  - Cyan used lightly, as tints and thin accents
  - MAGENTA USED SPARINGLY: one primary action per screen. It is the loudest
    colour we own, so it only marks the thing we want the manager to do next.
  - Rounded corners, soft shadows, thin borders - nothing heavy

If you change a brand colour, change it here and in the website's styles.css.

A NOTE ON WRITING HTML HERE
---------------------------
Every piece of HTML in this file is built as ONE long line with no leading
spaces. Streamlit reads indented lines as a block of example code, and would
print the raw HTML on screen instead of drawing it.
"""

import streamlit as st


# ==========================================================================
# THE PALETTE
# ==========================================================================

# The brand colours, exactly as on the website
NAVY = "#0A1172"
MAGENTA = "#E30B5C"
CYAN = "#00B2D9"
WHITE = "#FFFFFF"
GREY_LIGHT = "#F5F7FA"

# Supporting shades, mixed from the brand colours to keep everything calm
NAVY_DEEP = "#070C52"      # the sidebar
NAVY_SOFT = "#2A3170"      # sidebar dividers and hover
MAGENTA_DARK = "#C10A4E"   # button hover
TEXT_BODY = "#454B66"      # body text: navy-grey, softer than black
TEXT_MUTED = "#7A8099"     # captions and labels
BORDER = "#E6EAF2"         # thin borders
CANVAS = "#FAFBFD"         # the page behind the cards
GREEN = "#0E8A5F"          # savings, "good"
AMBER = "#B26B00"          # warnings

# The logo, on one line (see the note at the top of this file)
LOGO_SVG = (
    '<svg viewBox="0 0 64 64" width="38" height="38" aria-hidden="true">'
    '<path d="M32 18 L25.4 11.4 A4.65 4.65 0 0 1 32 4.8 A4.65 4.65 0 0 1 38.6 11.4 Z" fill="#E30B5C"/>'
    '<path d="M7 36 L32 17 L57 36 M11 33 L11 58 M53 33 L53 58 M11 58 L53 58" fill="none" '
    'stroke="#0A1172" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
    '<path d="M15 47 H22 L26.5 38 L31 55 L35.5 44 L39 47 H49" fill="none" '
    'stroke="#00B2D9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    "</svg>"
)

# The same logo with a white house, for the navy sidebar
LOGO_SVG_LIGHT = LOGO_SVG.replace('stroke="#0A1172"', 'stroke="#FFFFFF"')


# ==========================================================================
# PRODUCT TILES
# The mockups showed a photograph on every product card. We don't have
# photographs of supplier products - and inventing them would be misleading -
# so instead each card gets a calm tinted tile with a line drawing that suits
# its category. It reads as designed rather than as a missing image.
# ==========================================================================

CATEGORY_ICONS = {
    "PPE": '<path d="M18 26v-9a3 3 0 0 1 6 0v7m0-2v-8a3 3 0 0 1 6 0v9m0-3v-6a3 3 0 0 1 6 0v9m0-4a3 3 0 0 1 6 0v14a12 12 0 0 1-12 12h-2a12 12 0 0 1-12-12v-6a3 3 0 0 1 6 0"/>',
    "Continence": '<rect x="12" y="16" width="32" height="24" rx="6"/><path d="M20 16v-4h16v4M12 28h32"/>',
    "Hygiene": '<path d="M14 20h28l-2 24H16z"/><path d="M22 20v-6h12v6M20 30h16"/>',
    "Oral Care": '<path d="M16 40l18-24 6 4-18 24-8 2z"/><path d="M34 16l6 4"/>',
    "Personal Care": '<rect x="18" y="18" width="20" height="26" rx="5"/><path d="M24 18v-6h8v6M24 28h8"/>',
    "Infection Control": '<path d="M28 10l14 6v12c0 10-6 17-14 20-8-3-14-10-14-20V16z"/><path d="M22 28l4 4 8-9"/>',
    "Waste": '<path d="M14 20h28l-3 24H17z"/><path d="M20 20v-6h16v6M24 27v10M32 27v10"/>',
    "Housekeeping": '<path d="M28 8v20M18 28h20l4 20H14z"/>',
    "Laundry": '<rect x="12" y="12" width="32" height="32" rx="6"/><circle cx="28" cy="30" r="8"/><path d="M18 19h6"/>',
    "Nutrition": '<path d="M20 12v14a8 8 0 0 0 16 0V12"/><path d="M28 34v12M20 46h16"/>',
    "Dining": '<path d="M18 10v18M14 10v8a4 4 0 0 0 8 0v-8M18 28v18"/><path d="M38 10c4 4 4 10 0 14v22"/>',
    "Clinical": '<path d="M28 14v28M14 28h28"/>',
    "Moving and Handling": '<path d="M10 34h36M14 34V20a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v14"/><path d="M20 34v10M36 34v10"/>',
}

# Used when a category has no icon of its own
DEFAULT_ICON = '<rect x="12" y="18" width="32" height="24" rx="5"/><path d="M12 26h32M28 18v24"/>'


def product_tile(category, tint="cyan", size=104):
    """
    Draws the tinted tile that sits at the top of a product card.
    tint: "cyan" for a normal option, "magenta" for the top recommendation.
    """
    icon = CATEGORY_ICONS.get(category, DEFAULT_ICON)

    if tint == "magenta":
        background = "rgba(227, 11, 92, 0.07)"
        stroke = MAGENTA
    else:
        background = "rgba(0, 178, 217, 0.08)"
        stroke = CYAN

    return (
        f'<div style="background:{background};border-radius:14px;height:{size}px;'
        f'display:flex;align-items:center;justify-content:center;margin-bottom:16px">'
        f'<svg viewBox="0 0 56 56" width="{int(size * 0.46)}" height="{int(size * 0.46)}" '
        f'fill="none" stroke="{stroke}" stroke-width="2.2" stroke-linecap="round" '
        f'stroke-linejoin="round" aria-hidden="true">{icon}</svg>'
        f"</div>"
    )


# ==========================================================================
# THE STYLESHEET
# ==========================================================================

def apply_branding():
    """Injects the whole design. Called once at the top of app.py."""
    st.markdown(f"""
    <style>
      /* ================= FOUNDATIONS ================= */
      html, body, [class*="css"], button, input, textarea, select {{
        font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
      }}

      /* A soft off-white page, so white cards lift off it gently */
      [data-testid="stAppViewContainer"] {{ background: {CANVAS}; }}
      [data-testid="stHeader"] {{ background: transparent; }}

      /* Room to breathe - the main thing that makes an interface feel calm */
      .block-container {{ padding-top: 2.2rem; padding-bottom: 4rem; max-width: 1300px; }}

      h1, h2, h3, h4 {{ color: {NAVY}; letter-spacing: -0.022em; font-weight: 800; }}
      h1 {{ font-size: 33px; }}
      h2 {{ font-size: 24px; }}
      h3 {{ font-size: 19px; }}
      p, li, label, .stMarkdown {{ color: {TEXT_BODY}; }}

      /* ================= SIDEBAR ================= */
      section[data-testid="stSidebar"] {{
        background: {NAVY_DEEP};
        border-right: none;
      }}
      section[data-testid="stSidebar"] * {{ color: rgba(255,255,255,0.86); }}
      section[data-testid="stSidebar"] h1,
      section[data-testid="stSidebar"] h2,
      section[data-testid="stSidebar"] h3,
      section[data-testid="stSidebar"] strong {{ color: {WHITE}; }}
      section[data-testid="stSidebar"] hr {{ border-color: {NAVY_SOFT}; margin: 1.1rem 0; }}

      /* ---- The menu ----
         Each menu item is a Streamlit button, styled to read as a navigation
         row: transparent, left-aligned, with the current page marked by a soft
         cyan pill.

         Buttons rather than a radio, because the app itself needs to be able to
         move the manager between screens - for example, running a search typed
         on the dashboard over on the results screen. A radio remembers what the
         user last clicked and fights those moves. */
      section[data-testid="stSidebar"] button[data-testid^="stBaseButton-"] {{
        background: transparent;
        border: none;
        box-shadow: none;
        border-radius: 10px;
        padding: 9px 14px;
      }}
      /* Streamlit centres a button's label inside its own inner box, so the
         inner box has to be told to align left as well as the button itself. */
      section[data-testid="stSidebar"] button[data-testid^="stBaseButton-"] > div {{
        justify-content: flex-start;
        width: 100%;
      }}
      section[data-testid="stSidebar"] button[data-testid^="stBaseButton-"] p {{
        text-align: left;
        width: 100%;
        margin: 0;
        font-size: 15.5px;
        font-weight: 500;
        color: rgba(255,255,255,0.82) !important;
      }}
      section[data-testid="stSidebar"] button[data-testid^="stBaseButton-"]:hover {{
        background: rgba(255,255,255,0.08);
        border: none;
        box-shadow: none;
      }}
      section[data-testid="stSidebar"] button[data-testid^="stBaseButton-"]:hover p {{
        color: {WHITE} !important;
      }}
      /* The page you are on: a soft cyan-tinted pill with a cyan edge */
      section[data-testid="stSidebar"] button[data-testid="stBaseButton-primary"] {{
        background: rgba(0, 178, 217, 0.17);
        box-shadow: inset 3px 0 0 {CYAN};
      }}
      section[data-testid="stSidebar"] button[data-testid="stBaseButton-primary"] p {{
        color: {WHITE} !important;
        font-weight: 700;
      }}
      section[data-testid="stSidebar"] button[data-testid="stBaseButton-primary"]:hover {{
        background: rgba(0, 178, 217, 0.24);
        box-shadow: inset 3px 0 0 {CYAN};
      }}
      /* Menu rows sit closer together than normal stacked buttons */
      section[data-testid="stSidebar"] [data-testid="stVerticalBlock"] {{ gap: 0.15rem; }}

      /* ---- Panels ----
         st.container(border=True) is how we group widgets inside a card.
         Streamlit builds it from a "stVerticalBlock", and its border colour
         comes from the theme in .streamlit/config.toml. All we add here is our
         rounder corner and a little more breathing room inside. */
      [data-testid="stVerticalBlock"] {{ border-radius: 16px; }}
      [data-testid="stLayoutWrapper"] {{ border-radius: 16px; }}

      /* ================= BUTTONS =================
         Streamlit labels its buttons with data-testid, e.g.
             stBaseButton-secondary        an ordinary button
             stBaseButton-primary          one marked type="primary"
             stBaseButton-secondaryFormSubmit  a button inside a form
             stBaseButton-primaryFormSubmit    ... marked type="primary"
         We style by those, because they are what the page actually contains.

         The label inside a button is a separate <p>, which inherits the page's
         body colour - so wherever we change a button's background we have to
         set the label colour too, or we get dark text on magenta. */

      /* ---- Quiet by default: white surface, thin border ---- */
      button[data-testid="stBaseButton-secondary"],
      button[data-testid="stBaseButton-secondaryFormSubmit"] {{
        background: {WHITE};
        border: 1px solid {BORDER};
        border-radius: 10px;
        font-weight: 600;
        font-size: 15px;
        padding: 0.5rem 1.15rem;
        transition: all 0.15s ease;
        box-shadow: 0 1px 2px rgba(10,17,114,0.04);
      }}
      button[data-testid="stBaseButton-secondary"] p,
      button[data-testid="stBaseButton-secondaryFormSubmit"] p {{
        color: {NAVY} !important;
        font-weight: 600;
      }}
      button[data-testid="stBaseButton-secondary"]:hover,
      button[data-testid="stBaseButton-secondaryFormSubmit"]:hover {{
        border-color: {CYAN};
        background: {WHITE};
        box-shadow: 0 3px 10px rgba(10,17,114,0.07);
      }}

      /* ---- MAGENTA, for the one primary action on a screen ---- */
      button[data-testid="stBaseButton-primary"],
      button[data-testid="stBaseButton-primaryFormSubmit"] {{
        background: {MAGENTA};
        border: none;
        border-radius: 10px;
        font-weight: 700;
        font-size: 15px;
        padding: 0.5rem 1.15rem;
        transition: all 0.15s ease;
        box-shadow: 0 2px 10px rgba(227,11,92,0.20);
      }}
      button[data-testid="stBaseButton-primary"] p,
      button[data-testid="stBaseButton-primaryFormSubmit"] p,
      [data-testid="stLinkButton"] a p,
      [data-testid="stLinkButton"] a {{
        color: {WHITE} !important;
        font-weight: 700;
      }}
      button[data-testid="stBaseButton-primary"]:hover,
      button[data-testid="stBaseButton-primaryFormSubmit"]:hover {{
        background: {MAGENTA_DARK};
        box-shadow: 0 5px 16px rgba(227,11,92,0.28);
      }}

      /* ---- Download buttons: quiet, like an ordinary button ---- */
      button[data-testid="stBaseButton-secondary"][kind="secondary"] p {{ color: {NAVY} !important; }}

      /* ---- Link buttons (e.g. "Send request") match the primary style ---- */
      [data-testid="stLinkButton"] a {{
        background: {MAGENTA} !important;
        border: none !important;
        border-radius: 10px !important;
        box-shadow: 0 2px 10px rgba(227,11,92,0.20);
      }}
      [data-testid="stLinkButton"] a:hover {{ background: {MAGENTA_DARK} !important; }}

      /* ================= FORM FIELDS ================= */
      .stTextInput input, .stNumberInput input, .stTextArea textarea,
      .stDateInput input, [data-baseweb="select"] > div {{
        border-radius: 10px !important;
        border-color: {BORDER} !important;
        background: {WHITE} !important;
        color: {NAVY} !important;
        font-size: 15px !important;
      }}
      .stTextInput input:focus, .stNumberInput input:focus, .stTextArea textarea:focus {{
        border-color: {CYAN} !important;
        box-shadow: 0 0 0 3px rgba(0,178,217,0.12) !important;
      }}
      /* Field labels: small, quiet, and above the box */
      .stTextInput label p, .stNumberInput label p, .stTextArea label p,
      .stSelectbox label p, .stDateInput label p, .stSlider label p {{
        font-size: 13.5px !important;
        font-weight: 600 !important;
        color: {TEXT_MUTED} !important;
        text-transform: none;
      }}

      /* Streamlit's form boxes: we draw our own cards, so lose the default border */
      [data-testid="stForm"] {{
        border: none;
        padding: 0;
      }}

      /* ================= TABS ================= */
      .stTabs [data-baseweb="tab-list"] {{ gap: 4px; border-bottom: 1px solid {BORDER}; }}
      .stTabs [data-baseweb="tab"] {{
        font-weight: 600; font-size: 15px; color: {TEXT_MUTED};
      }}
      .stTabs [aria-selected="true"] {{
        color: {NAVY} !important;
        border-bottom-color: {CYAN} !important;
      }}

      /* ================= OUR OWN CARDS ================= */
      /* The plain white card that most things sit in */
      .sc-panel {{
        background: {WHITE};
        border: 1px solid {BORDER};
        border-radius: 16px;
        padding: 26px 28px;
        box-shadow: 0 1px 3px rgba(10,17,114,0.04);
        margin-bottom: 18px;
      }}
      .sc-panel--tight {{ padding: 20px 22px; }}

      /* A card heading with a quiet caption under it */
      .sc-panel__title {{ font-size: 20px; font-weight: 800; color: {NAVY}; margin: 0 0 4px; }}
      .sc-panel__caption {{ font-size: 14.5px; color: {TEXT_MUTED}; margin: 0 0 18px; }}

      /* ---- The welcome card on the dashboard: a soft navy-to-cyan wash ---- */
      .sc-welcome {{
        background: linear-gradient(135deg, {NAVY} 0%, #14237F 55%, #0E4E97 100%);
        border-radius: 16px;
        padding: 26px 28px;
        color: {WHITE};
        margin-bottom: 18px;
        position: relative;
        overflow: hidden;
      }}
      /* A very faint house outline in the corner, for warmth */
      .sc-welcome::after {{
        content: "";
        position: absolute; right: -28px; bottom: -34px;
        width: 150px; height: 150px;
        background: rgba(255,255,255,0.05);
        border-radius: 30px;
        transform: rotate(18deg);
      }}
      /* The colours here are forced with !important because the page-wide
         body text colour would otherwise win and leave dark text on navy. */
      .sc-welcome__hello {{
        font-size: 14px; margin: 0 !important;
        color: rgba(255,255,255,0.78) !important;
      }}
      .sc-welcome__name {{
        font-size: 27px; font-weight: 800; margin: 2px 0 7px !important;
        color: {WHITE} !important; letter-spacing: -0.02em;
      }}
      .sc-welcome__home {{
        font-size: 15px; margin: 0 !important;
        color: rgba(255,255,255,0.9) !important;
      }}

      /* ---- A figure card: big number, small label ---- */
      .sc-stat {{
        background: {WHITE};
        border: 1px solid {BORDER};
        border-radius: 16px;
        padding: 20px 22px;
        box-shadow: 0 1px 3px rgba(10,17,114,0.04);
        height: 100%;
      }}
      .sc-stat__label {{
        font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.07em;
        color: {TEXT_MUTED}; font-weight: 700; margin-bottom: 6px;
      }}
      .sc-stat__value {{ font-size: 29px; font-weight: 800; color: {NAVY}; line-height: 1.15; }}
      .sc-stat__value--save {{ color: {GREEN}; }}
      .sc-stat__value--accent {{ color: {CYAN}; }}
      .sc-stat__note {{ font-size: 13.5px; color: {TEXT_MUTED}; margin-top: 5px; }}

      /* ---- The savings card: a soft green wash, because it is good news ---- */
      .sc-savings {{
        background: linear-gradient(135deg, rgba(14,138,95,0.09), rgba(0,178,217,0.07));
        border: 1px solid rgba(14,138,95,0.18);
        border-radius: 16px;
        padding: 20px 22px;
        margin-bottom: 18px;
      }}

      /* ================= PRODUCT CARDS ================= */
      .sc-card {{
        background: {WHITE};
        border: 1px solid {BORDER};
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(10,17,114,0.04);
        height: 100%;
        transition: box-shadow 0.18s ease, transform 0.18s ease;
      }}
      .sc-card:hover {{ box-shadow: 0 8px 24px rgba(10,17,114,0.09); transform: translateY(-2px); }}

      /* The top recommendation: a magenta edge, and the faintest magenta wash */
      .sc-card--top {{
        border: 1.5px solid rgba(227,11,92,0.40);
        background: linear-gradient(180deg, rgba(227,11,92,0.035), {WHITE} 55%);
        box-shadow: 0 4px 18px rgba(227,11,92,0.08);
      }}
      /* Not right for elderly care: deliberately drained of colour */
      .sc-card--blocked {{ background: {GREY_LIGHT}; border-color: #DBDFE9; }}
      .sc-card--blocked:hover {{ transform: none; box-shadow: 0 1px 3px rgba(10,17,114,0.04); }}

      /* ---- Small labels that sit on a card ---- */
      .sc-chip {{
        display: inline-block;
        font-size: 11px; font-weight: 800;
        letter-spacing: 0.08em; text-transform: uppercase;
        padding: 5px 11px; border-radius: 999px;
        margin-bottom: 12px;
      }}
      .sc-chip--top     {{ background: {MAGENTA}; color: {WHITE}; }}
      .sc-chip--option  {{ background: rgba(0,178,217,0.12); color: #027A94; }}
      .sc-chip--warn    {{ background: rgba(178,107,0,0.12); color: {AMBER}; }}
      .sc-chip--blocked {{ background: #E2E5EC; color: #5C6478; }}
      .sc-chip--saved   {{ background: rgba(10,17,114,0.07); color: {NAVY}; }}

      .sc-card__product {{ font-size: 17px; font-weight: 800; color: {NAVY}; line-height: 1.3; margin-bottom: 3px; }}
      .sc-card__supplier {{ font-size: 14px; color: {TEXT_MUTED}; margin-bottom: 16px; }}

      /* The price, and the row of smaller figures under it */
      .sc-card__price {{ font-size: 27px; font-weight: 800; color: {NAVY}; line-height: 1.1; }}
      .sc-card__price--top {{ color: {MAGENTA}; }}
      .sc-card__unit {{ font-size: 13.5px; color: {TEXT_MUTED}; margin-bottom: 14px; }}

      .sc-rows {{ border-top: 1px solid {BORDER}; padding-top: 12px; margin-top: 4px; }}
      .sc-row {{ display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; padding: 3px 0; }}
      .sc-row__label {{ color: {TEXT_MUTED}; }}
      .sc-row__value {{ color: {NAVY}; font-weight: 600; text-align: right; }}

      .sc-save-badge {{
        display: inline-block; background: rgba(14,138,95,0.10); color: {GREEN};
        border-radius: 8px; padding: 4px 10px; font-size: 13px; font-weight: 700;
        margin-bottom: 12px;
      }}

      .sc-why {{
        background: rgba(0,178,217,0.06);
        border-left: 3px solid {CYAN};
        border-radius: 0 10px 10px 0;
        padding: 12px 14px;
        font-size: 14px;
        color: {NAVY};
        margin-top: 14px;
        line-height: 1.55;
      }}
      .sc-note {{ font-size: 13px; color: {TEXT_MUTED}; margin-top: 10px; line-height: 1.5; }}
      .sc-note--warn {{ color: {AMBER}; }}

      /* The three scores, drawn as thin bars so they can be read at a glance */
      .sc-scores {{ margin-top: 14px; }}
      .sc-score {{ display: flex; align-items: center; gap: 9px; margin-bottom: 6px; font-size: 12.5px; }}
      .sc-score__name {{ width: 52px; color: {TEXT_MUTED}; }}
      .sc-score__track {{ flex: 1; height: 5px; background: {GREY_LIGHT}; border-radius: 999px; overflow: hidden; }}
      .sc-score__fill {{ height: 100%; border-radius: 999px; background: {CYAN}; }}
      .sc-score__fill--top {{ background: {MAGENTA}; }}
      .sc-score__number {{ width: 26px; text-align: right; color: {NAVY}; font-weight: 700; }}

      /* ================= THE PRIVACY CARD ================= */
      .sc-privacy-card {{
        background: linear-gradient(150deg, rgba(0,178,217,0.10), rgba(10,17,114,0.06));
        border: 1px solid rgba(0,178,217,0.22);
        border-radius: 16px;
        padding: 22px 24px;
        margin-bottom: 18px;
      }}
      .sc-privacy-card h3 {{ font-size: 18px; margin: 12px 0 8px; }}
      .sc-privacy-card p {{ font-size: 14px; color: {TEXT_BODY}; margin: 0; line-height: 1.6; }}
      .sc-lock {{
        width: 42px; height: 42px; border-radius: 12px; background: {WHITE};
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(10,17,114,0.08);
      }}

      /* The quiet reassurance line at the bottom of a page */
      .sc-privacy-line {{
        font-size: 13px; color: {TEXT_MUTED};
        border-top: 1px solid {BORDER};
        padding-top: 14px; margin-top: 34px;
      }}

      /* ================= ODDS AND ENDS ================= */
      /* Streamlit's own alert boxes, softened to match */
      [data-testid="stAlert"] {{ border-radius: 12px; border: none; font-size: 14.5px; }}

      /* Dataframes */
      [data-testid="stDataFrame"] {{ border-radius: 12px; overflow: hidden; border: 1px solid {BORDER}; }}

      /* Expanders */
      [data-testid="stExpander"] {{
        border: 1px solid {BORDER}; border-radius: 12px; background: {WHITE};
      }}
      [data-testid="stExpander"] summary {{ font-weight: 600; color: {NAVY}; font-size: 15px; }}

      /* Sliders in the brand cyan */
      .stSlider [data-baseweb="slider"] [role="slider"] {{ background: {CYAN} !important; }}

      /* Hide the "Deploy" button and menu, so the app looks like a product */
      [data-testid="stToolbar"] {{ display: none; }}
      footer {{ display: none; }}
    </style>
    """, unsafe_allow_html=True)


# ==========================================================================
# BUILDING BLOCKS THE PAGES USE
# ==========================================================================

def page_title(title, subtitle=""):
    """The heading at the top of a page."""
    caption = (
        f'<p style="color:{TEXT_MUTED};font-size:16px;margin:6px 0 22px;max-width:720px">{subtitle}</p>'
        if subtitle else '<div style="height:14px"></div>'
    )
    st.markdown(
        f'<h1 style="margin:0;font-size:33px">{title}</h1>{caption}',
        unsafe_allow_html=True,
    )


def welcome_card(first_name, care_home_name, plan_name):
    """The greeting card at the top of the dashboard."""
    home_line = care_home_name or "Add your care home details to get started"
    st.markdown(
        '<div class="sc-welcome">'
        '<p class="sc-welcome__hello">Welcome back,</p>'
        f'<p class="sc-welcome__name">{first_name}</p>'
        f'<p class="sc-welcome__home">{home_line} &middot; {plan_name} plan</p>'
        "</div>",
        unsafe_allow_html=True,
    )


def stat_card(label, value, note="", tone=""):
    """
    A figure card. tone: "" (navy), "save" (green), "accent" (cyan).
    """
    tone_class = f" sc-stat__value--{tone}" if tone else ""
    note_html = f'<div class="sc-stat__note">{note}</div>' if note else ""
    st.markdown(
        '<div class="sc-stat">'
        f'<div class="sc-stat__label">{label}</div>'
        f'<div class="sc-stat__value{tone_class}">{value}</div>'
        f"{note_html}"
        "</div>",
        unsafe_allow_html=True,
    )


def panel(title="", caption=""):
    """
    A white card that can hold Streamlit widgets (forms, buttons, text boxes).

    Use it with "with":

        with branding.panel("What do you need?", "Rough figures are fine."):
            product = st.text_input("Product")

    WHY IT WORKS THIS WAY
    ---------------------
    Streamlit draws each element as its own separate box on the page, so we
    cannot simply write an opening <div> before some widgets and a closing one
    after - the browser closes our tag straight away and the widgets end up
    outside the card. st.container(border=True) is Streamlit's own way of
    grouping things inside a bordered box, so we use that and then tidy up its
    appearance in the stylesheet.
    """
    box = st.container(border=True)
    if title or caption:
        with box:
            heading = f'<div class="sc-panel__title">{title}</div>' if title else ""
            caption_html = f'<div class="sc-panel__caption">{caption}</div>' if caption else ""
            st.markdown(heading + caption_html, unsafe_allow_html=True)
    return box


def section_heading(title, caption=""):
    """A heading that sits directly on the page, between cards."""
    caption_html = (
        f'<span style="color:{TEXT_MUTED};font-size:14.5px;margin-left:10px">{caption}</span>'
        if caption else ""
    )
    st.markdown(
        f'<div style="margin:26px 0 6px"><span style="font-size:19px;font-weight:800;'
        f'color:{NAVY}">{title}</span>{caption_html}</div>',
        unsafe_allow_html=True,
    )


def empty_state(title, message, tile_size=88):
    """The friendly 'nothing here yet' block used on empty pages."""
    st.markdown(
        '<div style="text-align:center;padding:40px 20px">'
        f'<div style="max-width:{tile_size}px;margin:0 auto">'
        f"{product_tile('', 'cyan', tile_size)}</div>"
        f'<div style="font-size:19px;font-weight:700;color:{NAVY};margin-bottom:6px">'
        f"{title}</div>"
        f'<p style="color:{TEXT_MUTED};font-size:15px;max-width:420px;margin:0 auto">'
        f"{message}</p></div>",
        unsafe_allow_html=True,
    )


def privacy_card():
    """The 'your data stays in your private account' reassurance card."""
    lock = (
        '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="#0A1172" '
        'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
        '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/>'
        '<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/></svg>'
    )
    st.markdown(
        '<div class="sc-privacy-card">'
        f'<div class="sc-lock">{lock}</div>'
        "<h3>Your data stays in your private account</h3>"
        "<p>Your care home details, searches and saved requests are visible only to you. "
        "No other subscriber can see them, and nothing reaches a supplier until you "
        "choose to send a request &mdash; from your own email, so their reply comes "
        "straight back to you.</p>"
        "</div>",
        unsafe_allow_html=True,
    )


def privacy_line():
    """The quiet one-line version, for the bottom of working pages."""
    st.markdown(
        '<p class="sc-privacy-line">Your care home details, searches and requests are stored '
        "in your own account. No other subscriber can see them, and nothing is shared with a "
        "supplier until you choose to send a request.</p>",
        unsafe_allow_html=True,
    )


def score_bars(option, is_top=False):
    """
    The three scores drawn as thin bars: price, speed, quality.
    Showing them keeps the ranking honest - a manager can see exactly why one
    option came out ahead of another.
    """
    fill_class = "sc-score__fill sc-score__fill--top" if is_top else "sc-score__fill"
    rows = []
    for name, key in [("Price", "price_score_100"), ("Speed", "speed_score_100"),
                      ("Quality", "quality_score_100")]:
        value = option[key]
        rows.append(
            '<div class="sc-score">'
            f'<span class="sc-score__name">{name}</span>'
            f'<span class="sc-score__track"><span class="{fill_class}" '
            f'style="width:{value}%"></span></span>'
            f'<span class="sc-score__number">{value}</span>'
            "</div>"
        )
    return f'<div class="sc-scores">{"".join(rows)}</div>'
