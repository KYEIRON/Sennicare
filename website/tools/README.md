# website/tools

## build-preview.py

Rebuilds `website/preview.html` — the one-file, open-in-Chrome preview of the
whole site. It reads every page in `website/`, pastes the CSS, JavaScript and
logo files straight into each one, and wraps the lot in a tabbed shell.

Run it whenever you change a page, so the preview does not go stale:

    python3 website/tools/build-preview.py

That is the only step. No installation, nothing to download.
