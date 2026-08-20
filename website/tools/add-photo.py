#!/usr/bin/env python3
"""
Drop a photograph into one of the website's picture slots.

    python3 website/tools/add-photo.py --list
    python3 website/tools/add-photo.py home-paperwork ~/Downloads/manager.png

Each slot is a different shape on the page — some are square-ish, two are wide
banners. The tool crops your photo to the right shape (from the middle by
default), saves it into website/images/ as a web-sized JPEG, and points the
right page at it. Run it again with a different photo to replace one you have
already placed.

Use --focus top or --focus bottom if the middle crop cuts off the part that
matters — worth trying on the wide banner slots, where a lot of a normal
photo gets trimmed off the top and bottom.
"""
import argparse, os, re, sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is not installed. Run:  pip3 install Pillow")

WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
IMAGES = os.path.join(WEB, "images")

JPEG_QUALITY = 82                        # sharp on screen, sensible file size

# Every slot is a different shape on the page, so each gets its own size.
# These are twice the size the picture is actually displayed at, which keeps
# it sharp on high-resolution laptop and phone screens.
#
# slot id -> (page file, unique fragment of that image's alt text, width, height, what it shows)
SLOTS = {
    "home-hero":            ("home.html",      "nurse sitting with an elderly lady",             1600, 1200, "Home hero — nurse with a resident"),
    "home-paperwork":       ("home.html",      "buried under stacks of paper invoices",          1600,  720, "Home — manager buried in invoices (wide banner)"),
    "home-garden":          ("home.html",      "smiling care staff outdoors in a garden",        1600,  720, "Home — staff outdoors with a resident (wide banner)"),
    "home-dashboard":       ("home.html",      "tablet displaying the Sennicare procurement",    1600, 1200, "Home — the dashboard on a tablet"),
    "home-team":            ("home.html",      "diverse team of care home staff around a table", 1600, 1200, "Home — team around a laptop"),
    "product-laptop":       ("product.html",   "care home professionals reviewing the Sennicare",1600, 1200, "Product — two people at a laptop"),
    "product-nurses":       ("product.html",   "care home nurses in uniform standing together",  2240,  680, "Product — nurses in uniform (very wide banner)"),
    "product-bench":        ("product.html",   "carer sitting outdoors with an elderly resident",1600, 1200, "Product — carer on a garden bench"),
    "suppliers-warehouse":  ("suppliers.html", "warehouse staff in safety vests",                1600, 1200, "Suppliers — warehouse staff"),
    "suppliers-clinical":   ("suppliers.html", "Clinical consumables",                           1400,  940, "Suppliers — clinical consumables"),
    "suppliers-nutrition":  ("suppliers.html", "Nutritional supplement bottles",                 1400,  940, "Suppliers — nutrition products"),
    "suppliers-monitoring": ("suppliers.html", "smart monitoring device",                        1400,  940, "Suppliers — monitoring device"),
}


def prepare(src_path, slot, size, focus):
    """Crop to this slot's shape, resize, and save as a JPEG in website/images/."""
    im = Image.open(src_path)
    im = ImageOps.exif_transpose(im)          # honour phone rotation
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")

    # centering: (x, y) where y of 0 keeps the top, 1 keeps the bottom
    y = {"top": 0.0, "centre": 0.5, "center": 0.5, "bottom": 1.0}[focus]
    im = ImageOps.fit(im, size, Image.LANCZOS, centering=(0.5, y))

    os.makedirs(IMAGES, exist_ok=True)
    out_name = slot + ".jpg"
    im.save(os.path.join(IMAGES, out_name), "JPEG", quality=JPEG_QUALITY,
            optimize=True, progressive=True)
    return out_name


def point_page_at(page, alt_fragment, out_name):
    """Swap the src of the <img> whose alt contains alt_fragment."""
    path = os.path.join(WEB, page)
    with open(path, encoding="utf-8") as f:
        html = f.read()

    # find the one <img> tag carrying this alt text, whatever its current src
    pattern = re.compile(r'<img\b[^>]*alt="[^"]*' + re.escape(alt_fragment) + r'[^"]*"[^>]*>')
    tags = pattern.findall(html)
    if len(tags) != 1:
        sys.exit(f"Expected exactly one image matching {alt_fragment!r} in {page}, found {len(tags)}.")

    new_tag = re.sub(r'src="[^"]*"', 'src="images/' + out_name + '"', tags[0], count=1)
    if new_tag == tags[0]:
        sys.exit(f"Could not find a src to replace in {page}.")

    with open(path, "w", encoding="utf-8") as f:
        f.write(html.replace(tags[0], new_tag, 1))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("slot", nargs="?", help="which picture slot to fill (see --list)")
    p.add_argument("photo", nargs="?", help="path to your photo")
    p.add_argument("--focus", default="centre", choices=["top", "centre", "center", "bottom"],
                   help="which part of the photo to keep when cropping to 4:3")
    p.add_argument("--list", action="store_true", help="show every slot and whether it is filled")
    args = p.parse_args()

    if args.list or not args.slot:
        print(f"{'SLOT':<22} {'STATUS':<12} {'SIZE':<11} SHOWS")
        for slot, (page, frag, w, h, desc) in SLOTS.items():
            filled = os.path.exists(os.path.join(IMAGES, slot + ".jpg"))
            size = f"{w}x{h}"
            print(f"{slot:<22} {'filled' if filled else 'placeholder':<12} {size:<11} {desc}")
        return

    if args.slot not in SLOTS:
        sys.exit(f"Unknown slot {args.slot!r}. Run with --list to see the options.")
    if not args.photo or not os.path.exists(args.photo):
        sys.exit("Give me the path to a photo file.")

    page, frag, w, h, desc = SLOTS[args.slot]
    out_name = prepare(args.photo, args.slot, (w, h), args.focus)
    point_page_at(page, frag, out_name)
    kb = round(os.path.getsize(os.path.join(IMAGES, out_name)) / 1024)
    print(f"Placed {args.photo}\n  -> website/images/{out_name} ({w}x{h}, {kb} KB)\n  -> {page}: {desc}")
    print("\nNow rebuild the preview:  python3 website/tools/build-preview.py")


if __name__ == "__main__":
    main()
