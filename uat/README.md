# AstroQuest UAT — Theme Prototypes & Feedback Layer

Static HTML/CSS theme mockups served at `https://fe-uat.astroquest.info`.
The 5 hand-crafted themes (`theme1`..`theme5`) are evaluated alongside any
number of generated themes (`theme6`+) via a marquee picker at the top of
every page.

## Files

```
uat/
├── themes.json              # ⭐ single source of truth — edit this
├── generate.py              # rebuilds static themeN/index.html from manifest
├── cli.py                   # add / list / remove themes ergonomically
├── shared/
│   ├── base.css             # layout for generated themes
│   ├── theme-switcher.js    # frozen marquee pill bar (fetches /themes.json)
│   └── feedback.js          # POSTs to /api/theme-feedback
├── theme1/index.html        # legacy hand-crafted (don't touch)
├── theme2/index.html        # legacy
├── theme3/index.html        # legacy
├── theme4/index.html        # legacy
├── theme5/index.html        # legacy
└── themeN/index.html        # generated from manifest
```

## How the display rule works

`themes.json` → `display`:

```json
"display": {
  "mode": "latest_n",
  "max_show": 25,
  "exclude_oldest": 5,
  "fallback_when_few": true
}
```

| mode             | Behaviour                                                        |
| ---------------- | ---------------------------------------------------------------- |
| `latest_n`       | Marquee shows the newest `max_show` themes (default **25**)      |
| `exclude_oldest` | Drop the first N themes (sorted by `createdAt`) from the marquee |
| `all`            | Show everything in the marquee, no archive                       |

Themes that fall out of the marquee window are **not deleted** — they're
rendered in an **archive strip above the marquee**. The whole bar is
internally scrollable, and after mount we set `scrollTop` past the archive,
so users see only the 25 newest by default. **Scrolling the bar upward
reveals the archive of older themes.** A subtle `▲ scroll up for N older`
cue at the top of the marquee hints at this affordance.

`fallback_when_few` (default `true`): if total themes ≤ `exclude_oldest`,
show all of them — so the bar is never empty during early days.

## Adding new themes

### Daily drop — zero typing

```bash
python3 uat/cli.py add-random 5         # add 5 fresh themes from the curated pool
python3 uat/cli.py add-random 10        # add 10 (size of pool: ~85 entries)
python3 uat/cli.py add-random 5 --date 2025-05-01
python3 uat/cli.py add-random 5 --seed 42        # reproducible (same 5 every run)
```

The CLI:
- Picks unused name+color pairs from a built-in pool of Indian-aesthetic
  candidates (Marigold Hour, Indigo Tantra, Peacock Court, …)
- Skips any name/color already in the manifest, so reruns are safe
- Writes to `themes.json` and regenerates static HTML

To grow the pool, edit `RANDOM_POOL` at the top of `uat/cli.py`.

### Single theme — by hand

```bash
python3 uat/cli.py add "Cosmic Wave" "#FF6B9D"
python3 uat/cli.py add "Velvet Veda" "#5C2D91" --mood "Plum velvet curtains in a temple library."
```

The CLI:
- Auto-picks the next free `themeN` id
- Stamps `createdAt` with today's date
- **Derives the entire palette from the one primary color** (light/dark detection, accent shifts via HSL)
- Writes to `themes.json`
- Runs `generate.py` for you (skip with `--no-generate`)

### Bulk add — 10 at a time via CSV

```csv
name,color,mood
Cosmic Wave,#FF6B9D,Hot pink wave on cool ink
Velvet Veda,#5C2D91,Plum velvet curtains in a library
Marigold Hour,#FFB627,Festival marigold petals on wet stone
…
```

```bash
python3 uat/cli.py add-batch new-themes.csv
```

### Other commands

```bash
python3 uat/cli.py list                              # show every theme + createdAt
python3 uat/cli.py remove theme7                     # drop from manifest (HTML kept)
python3 uat/cli.py set-display latest_n --n 25       # default: newest 25 in marquee
python3 uat/cli.py set-display exclude_oldest --n 5  # drop oldest 5 to archive
python3 uat/cli.py set-display all                   # show every theme, no archive
python3 uat/cli.py next-id                           # print next free id
```

## Deploy after changes

```bash
python3 uat/generate.py        # rebuild static html
git add -A
git commit -m "uat: add Cosmic Wave and 9 more"
# Click "Save to GitHub" in Emergent (if working in dev container)
aq-uat-deploy                  # pull + sync + recreate caddy/backend
```

## How the manifest reaches the browser

1. `themes.json` lives at `/var/www/astroquest/uat/themes.json` after deploy.
2. Caddy serves it as `https://fe-uat.astroquest.info/themes.json`.
3. `theme-switcher.js` fetches it on page load and applies the display rule.
4. If the fetch fails, an embedded fallback list (last known good) is used,
   so the bar still works on cached pages.

## Hand-crafted vs generated

`legacy: true` in a theme entry tells `generate.py` not to overwrite the
`themeN/index.html`. Keep that flag on the 5 originals so their unique
designs (chat-bubble fonts, hero graphics, etc.) are preserved.

For new themes, leave `legacy` off (or `false`) and provide:
- `name`         display name in the pill
- `color`        primary hex, used for the dot in the pill bar
- `createdAt`    YYYY-MM-DD; drives the display ordering
- `mood`         one-liner shown under the hero
- `palette`      object of CSS variable overrides (auto-generated by `cli.py add`)
- `fontDisplay`  CSS font-family for headings (optional)
