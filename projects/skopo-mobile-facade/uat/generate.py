#!/usr/bin/env python3
"""
AstroQuest UAT — static theme generator.

Reads /app/uat/themes.json and (re)builds /app/uat/themeN/index.html for every
non-legacy theme. Legacy themes (id, name, color, createdAt with legacy: true)
are NOT touched — those are hand-crafted designs (themes 1..5).

Usage
-----
    python3 uat/generate.py                # generate everything
    python3 uat/generate.py --check        # dry-run, show diff
    python3 uat/generate.py --clean        # delete generated themes that no
                                           # longer appear in themes.json

After running, commit and deploy:
    aq-uat-deploy
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent
MANIFEST = ROOT / "themes.json"


BODY_TEMPLATE = """<div class="topbar">
  <div class="logo"></div>
  <div class="brand">AstroQuest</div>
  <div class="badge">UAT · {NUMBER}</div>
</div>

<section class="hero">
  <div class="stamp">श्री</div>
  <span class="label">{NAME}</span>
  <h1>Ayushmaan Bhava 🙏</h1>
  <p>{MOOD}</p>
</section>

<div class="wrap">

  <div class="card login-card">
    <span class="label">Sign in</span>
    <h2 style="margin-top:6px">Begin your journey</h2>
    <p style="color:var(--c-ink-soft); font-size:14px;">7-day free trial · your chart stays private to your Google account.</p>
    <button class="btn-google"><span class="g">G</span> Continue with Google</button>
  </div>

  <div class="card chat">
    <div class="section-title"><span class="label">Vidhaata</span><h2>Ask anything about your chart</h2></div>
    <div class="bubble me">What does my Lagna say about me?</div>
    <div class="bubble vidhaata">
      <div class="who">🪷 Vidhaata</div>
      With <strong>Vrishabha (Taurus) Lagna</strong> and Lagna lord Shukra placed in Karkataka in the 3rd house, you carry an artistic, persistent temperament — driven by sustained effort rather than dramatic shifts. The Pushya nakshatra grouping in the 3rd amplifies your communication and capacity to nurture others.
    </div>
    <div class="chat-input">
      <input placeholder="Ask Vidhaata anything…">
      <button aria-label="Send">➤</button>
    </div>
  </div>

  <div class="card">
    <div class="section-title"><span class="label">Your chart</span><h2>Overview · Arjun Sharma</h2></div>
    <div class="grid-3">
      <div class="info-tile"><span class="label">Ascendant</span><div class="v">Vrishabha</div></div>
      <div class="info-tile"><span class="label">Moon sign</span><div class="v">Karkataka</div></div>
      <div class="info-tile"><span class="label">Nakshatra</span><div class="v">Pushya · P1</div></div>
    </div>
    <table class="planet">
      <thead><tr><th>Planet</th><th>Sign</th><th>House</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>Sun</td><td>Karkataka</td><td>3</td><td></td></tr>
        <tr><td>Moon</td><td>Karkataka</td><td>3</td><td></td></tr>
        <tr><td>Mercury ℞</td><td>Karkataka</td><td>3</td><td><span class="pill retro">Retrograde</span></td></tr>
        <tr><td>Jupiter</td><td>Karkataka</td><td>3</td><td><span class="pill exalted">Exalted</span></td></tr>
        <tr><td>Venus</td><td>Karkataka</td><td>3</td><td></td></tr>
        <tr><td>Mars</td><td>Vrishabha</td><td>1</td><td></td></tr>
        <tr><td>Saturn</td><td>Simha</td><td>4</td><td></td></tr>
        <tr><td>Rahu</td><td>Simha</td><td>4</td><td></td></tr>
        <tr><td>Ketu</td><td>Kumbha</td><td>10</td><td></td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <div class="section-title"><span class="label">Today</span><h2>Auspicious windows · Hyderabad</h2></div>
    <div class="muhurta-row"><div class="icon">🪙</div><div style="flex:1"><div class="what">Buy gold or silver</div><div class="when">Abhijit Muhurta · 11:51 AM – 12:42 PM</div></div></div>
    <div class="muhurta-row"><div class="icon">🚗</div><div style="flex:1"><div class="what">Begin a journey</div><div class="when">Amrita Kaala · 5:14 AM – 6:36 AM</div></div></div>
    <div class="muhurta-row"><div class="icon">🪔</div><div style="flex:1"><div class="what">Puja / havan</div><div class="when">Brahma Muhurta · 4:18 AM – 5:06 AM</div></div></div>
  </div>

  <div class="feedback">
    <span class="label">Your feedback shapes this theme</span>
    <h2>How does <em>{NAME}</em> feel?</h2>
    <p style="color:var(--c-ink-soft);">Rate it, vote with a thumb, and leave a comment if you'd like.</p>
    <div class="row" style="margin-top:14px;">
      <div id="aq-fb-stars" class="aq-stars"></div>
      <div class="thumbs">
        <button id="aq-fb-thumb-up" aria-label="Thumbs up">👍</button>
        <button id="aq-fb-thumb-dn" aria-label="Thumbs down">👎</button>
      </div>
    </div>
    <label for="aq-fb-name">Your name (optional)</label>
    <input id="aq-fb-name" type="text" placeholder="e.g. Arjun S.">
    <label for="aq-fb-comment">What did you like or not like?</label>
    <textarea id="aq-fb-comment" placeholder="Free-flowing thoughts welcome…"></textarea>
    <button id="aq-fb-submit">Submit feedback</button>
    <div id="aq-fb-status" class="aq-fb-status"></div>
  </div>
</div>

<footer>AstroQuest UAT · {NUMBER} · {NAME} · for evaluation only</footer>

<script>window.AQ_THEME = '{ID}';</script>
<script src="/shared/theme-switcher.js"></script>
<script src="/shared/feedback.js"></script>
"""


def render_theme(theme: dict[str, Any]) -> str:
    tid = theme["id"]
    name = theme["name"]
    palette = theme.get("palette", {})
    font_display = theme.get("fontDisplay", "'Cormorant Garamond', Georgia, serif")
    mood = theme.get("mood", "")
    number = tid.replace("theme", "Theme ")

    if not palette:
        raise ValueError(
            f"theme '{tid}' is non-legacy but has no `palette` block — cannot generate"
        )

    primary = palette.get("c-primary", theme.get("color", "#000"))

    vars_block = "\n".join(f"    --{k}: {v};" for k, v in palette.items())

    return (
        '<!doctype html>\n'
        '<html lang="en">\n'
        '<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        f'<title>AstroQuest — {number} · {name}</title>\n'
        f'<meta name="theme-color" content="{primary}">\n'
        '<link rel="stylesheet" href="/shared/base.css">\n'
        '<style>\n'
        '  :root {\n'
        f'{vars_block}\n'
        f'    --font-display: {font_display};\n'
        "    --font-body: 'Inter', -apple-system, system-ui, sans-serif;\n"
        '  }\n'
        "  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');\n"
        '</style>\n'
        '</head>\n'
        '<body>\n'
        + BODY_TEMPLATE.format(ID=tid, NAME=name, NUMBER=number, MOOD=mood)
        + '</body>\n'
        '</html>\n'
    )


def load_manifest() -> dict[str, Any]:
    if not MANIFEST.exists():
        sys.exit(f"manifest not found: {MANIFEST}")
    return json.loads(MANIFEST.read_text())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="dry-run; show what would change")
    parser.add_argument("--clean", action="store_true",
                        help="delete themeN/ directories that are no longer in the manifest")
    args = parser.parse_args()

    data = load_manifest()
    themes = data.get("themes", [])
    known_ids = {t["id"] for t in themes}

    written = skipped = unchanged = 0
    for theme in themes:
        if theme.get("legacy"):
            skipped += 1
            continue

        out_dir = ROOT / theme["id"]
        out_file = out_dir / "index.html"
        new_html = render_theme(theme)

        if out_file.exists() and out_file.read_text() == new_html:
            unchanged += 1
            continue

        if args.check:
            print(f"  would write {out_file.relative_to(ROOT)}  ({len(new_html)} bytes)")
            continue

        out_dir.mkdir(exist_ok=True)
        out_file.write_text(new_html)
        print(f"  wrote {out_file.relative_to(ROOT)}  ({len(new_html)} bytes)")
        written += 1

    # Remove orphaned generated theme dirs
    if args.clean:
        for d in sorted(ROOT.glob("theme*")):
            if d.is_dir() and d.name not in known_ids:
                if args.check:
                    print(f"  would remove orphan {d.relative_to(ROOT)}/")
                else:
                    shutil.rmtree(d)
                    print(f"  removed orphan {d.relative_to(ROOT)}/")

    print(
        f"\n{'(dry-run) ' if args.check else ''}"
        f"summary: written={written} unchanged={unchanged} legacy_skipped={skipped} "
        f"total_in_manifest={len(themes)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
