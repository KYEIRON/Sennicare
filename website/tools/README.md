# website/tools

## build-preview.py

Rebuilds `website/preview.html` — the one-file, open-in-Chrome preview of the
whole site. It reads every page in `website/`, pastes the CSS, JavaScript and
logo files straight into each one, and wraps the lot in a tabbed shell.

Run it whenever you change a page, so the preview does not go stale:

    python3 website/tools/build-preview.py

That is the only step. No installation, nothing to download.

## add-photo.py

Puts one of your photographs into one of the website's twelve picture slots.

See every slot, its shape, and whether it is filled yet:

    python3 website/tools/add-photo.py --list

Fill one:

    python3 website/tools/add-photo.py suppliers-clinical ~/Downloads/consumables.png

It crops the photo to that slot's shape, shrinks it to a sensible size for the
web, saves it in `website/images/`, and points the page at it. Run it again
with a different photo to replace one. If the crop cuts off the important part,
add `--focus top` or `--focus bottom`.

Afterwards, rebuild the preview so you can see the result:

    python3 website/tools/build-preview.py
