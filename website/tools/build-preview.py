# Bundles every real Sennicare page into ONE self-contained HTML file.
# Each page is embedded live (not as a screenshot) inside an iframe, so all the
# hovers, menus, scrolling and the calculator's maths still work.
import base64, os, re, html

WEB = "/home/user/Sennicare/website"
OUT = "/home/user/Sennicare/website/preview.html"

PAGES = [
    ("home",       "Home",                 "home.html",              "A"),
    ("product",    "Product",              "product.html",           "A"),
    ("pricing",    "Pricing",              "pricing.html",           "A"),
    ("suppliers",  "For Suppliers",        "suppliers.html",         "A"),
    ("index",      "Homepage (alt)",       "index.html",             "B"),
    ("calculator", "Savings Calculator",   "savings-calculator.html","C"),
    ("privacy",    "Privacy",              "privacy.html",           "C"),
    ("terms",      "Terms",                "terms.html",             "C"),
]
FILE_TO_SLUG = {f: s for s, _, f, _ in PAGES}

SET_NOTE = {
    "A": "Set A &middot; Hanken Grotesk",
    "B": "Set B &middot; Figtree",
    "C": "Set C &middot; Original design",
}

def read(p):
    with open(os.path.join(WEB, p), encoding="utf-8") as f:
        return f.read()

def svg_uri(p):
    with open(os.path.join(WEB, p), "rb") as f:
        return "data:image/svg+xml;base64," + base64.b64encode(f.read()).decode()

# Assets shared by the older pages, inlined once each.
ASSETS = {p: svg_uri(p) for p in ("assets/logo.svg", "assets/logo-light.svg")}

# Injected into every page: makes links between pages switch the tab in the
# preview shell instead of failing inside the iframe.
BRIDGE = """
<script>
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href') || '';
  if (href.charAt(0) === '#' || /^(mailto:|tel:|https?:)/.test(href)) return;
  var m = href.match(/([A-Za-z0-9._-]+\\.html)(#.*)?$/);
  if (!m) return;
  e.preventDefault();
  parent.postMessage({ sennicareGoTo: m[1] }, '*');
});
</script>
"""

def inline(page_html):
    # 1. stylesheets -> <style>
    def css_sub(m):
        return "<style>\n" + read(m.group(1)) + "\n</style>"
    page_html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="(css/[^"]+)"[^>]*>', css_sub, page_html)

    # 2. scripts -> inline <script>
    def js_sub(m):
        return "<script>\n" + read(m.group(1)) + "\n</script>"
    page_html = re.sub(r'<script[^>]*src="(js/[^"]+)"[^>]*>\s*</script>', js_sub, page_html)

    # 3. logo files -> data URIs
    for path, uri in ASSETS.items():
        page_html = page_html.replace('"' + path + '"', '"' + uri + '"')

    # 4. link bridge
    if "</body>" in page_html:
        page_html = page_html.replace("</body>", BRIDGE + "</body>")
    else:
        page_html += BRIDGE
    return page_html

tabs, frames = [], []
for i, (slug, title, filename, dset) in enumerate(PAGES):
    doc = html.escape(inline(read(filename)), quote=True)
    active = " is-active" if i == 0 else ""
    tabs.append(
        f'<button type="button" class="tab{active}" data-slug="{slug}" '
        f'aria-selected="{"true" if i == 0 else "false"}">{html.escape(title)}'
        f'<span class="tab__set tab__set--{dset.lower()}">{dset}</span></button>'
    )
    frames.append(
        f'<div class="stage{active}" data-slug="{slug}" data-file="{filename}" data-set="{dset}">'
        f'<iframe title="{html.escape(title)} page" srcdoc="{doc}"></iframe></div>'
    )

SET_LEGEND = "".join(
    f'<span><i class="dot dot--{k.lower()}"></i>{v}</span>' for k, v in SET_NOTE.items()
)

doc = f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sennicare &mdash; live website preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;800&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root {{
    --navy: #0a1172;
    --raspberry: #e30b5c;
    --cyan: #00b2d9;
    --shell: #17142e;         /* dark shell so the pages themselves stand out */
    --shell-2: #221d40;
    --shell-line: #332c5c;
    --shell-ink: #f2effc;
    --shell-muted: #a49dc4;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ height: 100%; }}
  body {{
    margin: 0;
    background: var(--shell);
    color: var(--shell-ink);
    font-family: "Hanken Grotesk", "Segoe UI", system-ui, sans-serif;
    display: flex;
    flex-direction: column;
  }}

  /* ---------- shell header ---------- */
  header {{
    background: var(--shell);
    border-bottom: 1px solid var(--shell-line);
    padding: 12px 20px 0;
    flex: none;
  }}
  .brandline {{
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px; margin-bottom: 12px;
  }}
  .brandline strong {{ font-size: 16px; font-weight: 800; letter-spacing: -.01em; }}
  .brandline .hint {{ font-size: 13.5px; color: var(--shell-muted); margin-right: auto; }}

  .sizes {{ display: flex; gap: 6px; }}
  .size {{
    font: 500 13px/1 "Hanken Grotesk", sans-serif;
    background: transparent; color: var(--shell-muted);
    border: 1px solid var(--shell-line); border-radius: 6px;
    padding: 9px 12px; min-height: 34px; cursor: pointer;
  }}
  .size:hover {{ color: var(--shell-ink); border-color: var(--shell-muted); }}
  .size.is-active {{ background: var(--shell-ink); color: var(--shell); border-color: var(--shell-ink); }}

  .tabs {{ display: flex; gap: 2px; overflow-x: auto; }}
  .tab {{
    font: 600 14px/1 "Hanken Grotesk", sans-serif;
    background: transparent; color: var(--shell-muted);
    border: 0; border-bottom: 2px solid transparent;
    padding: 12px 14px 11px; cursor: pointer; white-space: nowrap;
    display: flex; align-items: center; gap: 7px;
  }}
  .tab:hover {{ color: var(--shell-ink); }}
  .tab.is-active {{ color: #fff; border-bottom-color: var(--raspberry); }}
  .tab__set {{
    font: 500 10px/1 "IBM Plex Mono", monospace;
    padding: 3px 5px; border-radius: 3px; color: #fff;
  }}
  .tab__set--a {{ background: var(--raspberry); }}
  .tab__set--b {{ background: #4a55ff; }}
  .tab__set--c {{ background: #5c5680; }}

  /* ---------- stage ---------- */
  main {{
    flex: 1 1 auto; min-height: 0;
    padding: 18px; display: flex; justify-content: center;
    background:
      radial-gradient(1200px 400px at 50% 0%, rgba(227,11,92,.10), transparent 70%),
      var(--shell-2);
  }}
  .stage {{ display: none; width: 100%; max-width: var(--stage-w, 100%); }}
  .stage.is-active {{ display: block; }}
  iframe {{
    width: 100%; height: 100%; border: 0; border-radius: 8px;
    background: #fff; box-shadow: 0 24px 60px -20px rgba(0,0,0,.6);
    display: block;
  }}

  /* ---------- footer strip ---------- */
  footer {{
    flex: none; border-top: 1px solid var(--shell-line);
    padding: 10px 20px; font-size: 12.5px; color: var(--shell-muted);
    display: flex; flex-wrap: wrap; gap: 8px 22px; align-items: center;
  }}
  footer code {{ font-family: "IBM Plex Mono", monospace; color: var(--shell-ink); }}
  .legend {{ display: flex; flex-wrap: wrap; gap: 14px; margin-left: auto; }}
  .legend span {{ display: flex; align-items: center; gap: 6px; }}
  .dot {{ width: 8px; height: 8px; border-radius: 50%; display: inline-block; }}
  .dot--a {{ background: var(--raspberry); }}
  .dot--b {{ background: #4a55ff; }}
  .dot--c {{ background: #5c5680; }}

  button:focus-visible {{ outline: 2px solid var(--cyan); outline-offset: 2px; }}
</style>
</head>
<body>

<header>
  <div class="brandline">
    <strong>Sennicare &mdash; live website preview</strong>
    <span class="hint">Real pages, not pictures. Click things, hover, scroll &mdash; it all works.</span>
    <div class="sizes" role="group" aria-label="Screen width">
      <button type="button" class="size is-active" data-w="100%">Desktop</button>
      <button type="button" class="size" data-w="820px">Tablet</button>
      <button type="button" class="size" data-w="390px">Phone</button>
    </div>
  </div>
  <div class="tabs" role="tablist">{''.join(tabs)}</div>
</header>

<main id="stages">{''.join(frames)}</main>

<footer>
  <span>Now showing <code id="nowfile">home.html</code></span>
  <span>Photo slots read &ldquo;Photo goes here&rdquo; on purpose &mdash; real photography still to be chosen.</span>
  <div class="legend">{SET_LEGEND}</div>
</footer>

<script>
  var stages = document.getElementById('stages');
  var nowfile = document.getElementById('nowfile');

  // Switch which page is on the stage.
  function show(slug) {{
    document.querySelectorAll('.tab').forEach(function (t) {{
      var on = t.dataset.slug === slug;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    }});
    document.querySelectorAll('.stage').forEach(function (s) {{
      var on = s.dataset.slug === slug;
      s.classList.toggle('is-active', on);
      if (on) nowfile.textContent = s.dataset.file;
    }});
  }}

  document.querySelectorAll('.tab').forEach(function (t) {{
    t.addEventListener('click', function () {{ show(t.dataset.slug); }});
  }});

  // Screen-width buttons resize the stage so you can feel the mobile layout.
  document.querySelectorAll('.size').forEach(function (b) {{
    b.addEventListener('click', function () {{
      document.querySelectorAll('.size').forEach(function (o) {{ o.classList.remove('is-active'); }});
      b.classList.add('is-active');
      stages.style.setProperty('--stage-w', b.dataset.w);
    }});
  }});

  // Links between pages inside an iframe switch the tab instead.
  var fileToSlug = {{{', '.join(f'"{f}": "{s}"' for f, s in FILE_TO_SLUG.items())}}};
  window.addEventListener('message', function (e) {{
    var f = e.data && e.data.sennicareGoTo;
    if (f && fileToSlug[f]) show(fileToSlug[f]);
  }});
</script>
</body>
</html>
"""

with open(OUT, "w", encoding="utf-8") as f:
    f.write(doc)
print(OUT, round(os.path.getsize(OUT) / 1024), "KB")
