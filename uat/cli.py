#!/usr/bin/env python3
"""
AstroQuest UAT — CLI helper for adding & managing UAT theme prototypes.

The big idea: give you ONE color and a name, and we derive the entire
palette + write the manifest entry + regenerate the static HTML.

Subcommands
-----------
    list                              # show every theme with createdAt
    add NAME COLOR [--mood "..."]    # add a new theme today
    add-random N                      # generate N fresh themes from a curated pool
    add-batch FILE                    # add multiple from a YAML/CSV file
    set-display MODE [--n N]          # change the display rule
    remove ID                         # remove from manifest (keeps html)
    next-id                           # print the next free themeN id

Examples
--------
    python3 uat/cli.py list
    python3 uat/cli.py add "Cosmic Wave" "#FF6B9D"
    python3 uat/cli.py add "Velvet Veda" "#5C2D91" --mood "Plum velvet curtains in a temple library."
    python3 uat/cli.py add-random 5                  # the daily drop, hands-off
    python3 uat/cli.py add-random 10 --date 2025-05-01
    python3 uat/cli.py set-display latest_n --n 25
    python3 uat/cli.py set-display exclude_oldest --n 5

After any change, run:
    python3 uat/generate.py
    git add -A && git commit -m "uat: add Cosmic Wave"
    aq-uat-deploy
"""

from __future__ import annotations

import argparse
import colorsys
import csv
import datetime
import json
import pathlib
import re
import subprocess
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent
MANIFEST = ROOT / "themes.json"


# ---------------------------------------------------------------------------
# Color helpers — derive a full palette from a single primary hex.
# ---------------------------------------------------------------------------
def _hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))  # type: ignore[return-value]


def _rgb_to_hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{int(round(max(0, min(1, c)) * 255)):02X}" for c in rgb)


def _adjust(h: str, dh: float = 0, ds: float = 0, dl: float = 0) -> str:
    r, g, b = _hex_to_rgb(h)
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    hh = (hh + dh) % 1.0
    ss = max(0.0, min(1.0, ss + ds))
    ll = max(0.0, min(1.0, ll + dl))
    return _rgb_to_hex(colorsys.hls_to_rgb(hh, ll, ss))


def _is_dark(h: str) -> bool:
    r, g, b = _hex_to_rgb(h)
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return luminance < 0.45


def derive_palette(primary: str) -> dict[str, str]:
    """Build a 12-key palette from one primary color."""
    is_dark_theme = _is_dark(primary)

    if is_dark_theme:
        # Dark theme — primary is the bright accent against dark bg/surface.
        bg = "#0E0E18"
        surface = "#181828"
        ink = "#F0F0F5"
        ink_soft = _adjust(primary, dl=0.1, ds=-0.5)
        accent = _adjust(primary, dh=0.15, dl=0.15)        # complementary-ish
        accent_2 = _adjust(primary, dl=-0.1)
        accent_soft = _adjust(primary, dl=-0.35, ds=-0.2)
        rule = "#2A2A38"
        on_primary = "#FFFFFF" if _is_dark(primary) else "#0E0E18"
        stamp_ink = "#FFFFFF"
        accent_ink = bg
    else:
        # Light theme — primary stays bold against soft cream/white bg.
        bg = _adjust(primary, dl=0.45, ds=-0.4)             # near-white tint
        surface = "#FFFFFF"
        ink = _adjust(primary, dl=-0.45, ds=-0.1)           # near-black tint
        ink_soft = _adjust(primary, dl=-0.2, ds=-0.3)
        accent = _adjust(primary, dh=0.06, dl=0.18, ds=-0.15)
        accent_2 = _adjust(primary, dl=-0.12)
        accent_soft = _adjust(primary, dl=0.32, ds=-0.2)
        rule = _adjust(primary, dl=0.32, ds=-0.5)
        on_primary = "#FFFFFF"
        stamp_ink = _adjust(primary, dl=-0.35)
        accent_ink = _adjust(primary, dl=-0.4)

    return {
        "c-bg": bg,
        "c-surface": surface,
        "c-ink": ink,
        "c-ink-soft": ink_soft,
        "c-primary": primary.upper(),
        "c-accent": accent,
        "c-accent-2": accent_2,
        "c-accent-soft": accent_soft,
        "c-rule": rule,
        "c-on-primary": on_primary,
        "c-stamp-ink": stamp_ink,
        "c-accent-ink": accent_ink,
    }


# ---------------------------------------------------------------------------
# Manifest IO
# ---------------------------------------------------------------------------
def load() -> dict[str, Any]:
    return json.loads(MANIFEST.read_text())


def save(data: dict[str, Any]) -> None:
    MANIFEST.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def next_id(themes: list[dict[str, Any]]) -> str:
    used = {int(re.match(r"theme(\d+)$", t["id"]).group(1))
            for t in themes
            if re.match(r"theme(\d+)$", t["id"])}
    n = 1
    while n in used:
        n += 1
    return f"theme{n}"


# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------
def cmd_list(args):
    data = load()
    print(f"display: {json.dumps(data.get('display', {}), separators=(',', ':'))}")
    print(f"{'id':<10} {'created':<11} {'color':<9}  name")
    print("-" * 60)
    for t in sorted(data["themes"], key=lambda x: (x.get("createdAt", ""), x["id"])):
        flag = " [legacy]" if t.get("legacy") else ""
        print(f"{t['id']:<10} {t.get('createdAt', '?'):<11} {t.get('color', '?'):<9}  {t['name']}{flag}")
    print(f"\ntotal: {len(data['themes'])}")


def cmd_add(args):
    name = args.name.strip()
    color = args.color.strip().upper()
    if not re.match(r"^#[0-9A-F]{6}$", color):
        sys.exit(f"invalid color '{color}'; expected like #FF6B9D")

    data = load()
    tid = args.id or next_id(data["themes"])

    if any(t["id"] == tid for t in data["themes"]):
        sys.exit(f"theme '{tid}' already exists; use --id to override or remove first")

    today = args.date or datetime.date.today().isoformat()

    palette = derive_palette(color)
    is_dark = _is_dark(color)
    font = args.font or (
        "'Inter', -apple-system, sans-serif" if is_dark
        else "'Cormorant Garamond', Georgia, serif"
    )

    entry = {
        "id": tid,
        "name": name,
        "color": color,
        "createdAt": today,
        "mood": args.mood or f"{name} — a fresh palette evaluation candidate.",
        "fontDisplay": font,
        "palette": palette,
    }
    data["themes"].append(entry)
    save(data)
    print(f"✓ added {tid} '{name}' ({color}) created {today}")
    print(f"  derived palette:")
    for k, v in palette.items():
        print(f"    --{k:<14} {v}")
    print(f"\nNext: python3 uat/generate.py && git add -A && git commit -m \"uat: add {name}\" && aq-uat-deploy")
    if not args.no_generate:
        _run_generate()


def cmd_add_batch(args):
    """Bulk-add themes from a CSV file with columns: name,color[,mood][,date]."""
    path = pathlib.Path(args.file)
    if not path.exists():
        sys.exit(f"not found: {path}")
    data = load()
    today = args.date or datetime.date.today().isoformat()

    rows = []
    if path.suffix.lower() == ".csv":
        with path.open() as f:
            for row in csv.DictReader(f):
                rows.append(row)
    else:
        sys.exit("only .csv batch files supported (columns: name,color[,mood][,date])")

    added = 0
    for row in rows:
        name = (row.get("name") or "").strip()
        color = (row.get("color") or "").strip().upper()
        if not name or not re.match(r"^#[0-9A-F]{6}$", color):
            print(f"  skip malformed row: {row}")
            continue
        tid = next_id(data["themes"])
        is_dark = _is_dark(color)
        entry = {
            "id": tid,
            "name": name,
            "color": color,
            "createdAt": (row.get("date") or today).strip(),
            "mood": (row.get("mood") or f"{name} — a fresh palette evaluation candidate.").strip(),
            "fontDisplay": "'Inter', -apple-system, sans-serif" if is_dark
                           else "'Cormorant Garamond', Georgia, serif",
            "palette": derive_palette(color),
        }
        data["themes"].append(entry)
        added += 1
        print(f"  + {tid} '{name}' ({color})")
    save(data)
    print(f"\n✓ added {added} themes")
    if not args.no_generate:
        _run_generate()


def cmd_remove(args):
    data = load()
    before = len(data["themes"])
    data["themes"] = [t for t in data["themes"] if t["id"] != args.id]
    if len(data["themes"]) == before:
        sys.exit(f"no theme with id '{args.id}' in manifest")
    save(data)
    print(f"✓ removed {args.id} from manifest. Static HTML at uat/{args.id}/ is left in place.")
    print(f"  Run `python3 uat/generate.py --clean` to also delete its directory.")


def cmd_set_display(args):
    data = load()
    d = data.setdefault("display", {})
    if args.mode not in ("exclude_oldest", "latest_n", "all"):
        sys.exit("mode must be one of: exclude_oldest, latest_n, all")
    d["mode"] = args.mode
    if args.mode == "exclude_oldest":
        d["exclude_oldest"] = args.n if args.n is not None else d.get("exclude_oldest", 10)
    elif args.mode == "latest_n":
        d["max_show"] = args.n if args.n is not None else d.get("max_show", 25)
    save(data)
    print(f"✓ display rule updated → {json.dumps(d, separators=(',', ':'))}")


def cmd_next_id(args):
    print(next_id(load()["themes"]))


# ---------------------------------------------------------------------------
# Curated pool of name+color+mood for `add-random`.
# Indian/cultural-leaning aesthetic. ~80 entries — enough for ~16 weeks of
# daily 5-drops without repeats. The CLI skips any name already in the
# manifest so you can rerun this safely.
# ---------------------------------------------------------------------------
RANDOM_POOL: list[dict[str, str]] = [
    {"name": "Cosmic Wave",       "color": "#FF6B9D", "mood": "Hot pink wave breaking on cool ink — youthful, electric."},
    {"name": "Velvet Veda",       "color": "#5C2D91", "mood": "Plum velvet curtains in a temple library — rich, hushed."},
    {"name": "Marigold Hour",     "color": "#FFB627", "mood": "Festival marigold petals on wet stone — celebratory."},
    {"name": "Indigo Tantra",     "color": "#3F51B5", "mood": "Deep indigo dye on cotton — meditative, ancestral."},
    {"name": "Saffron Stupa",     "color": "#E66B0E", "mood": "Saffron robes circling a stupa at dawn — devout, warm."},
    {"name": "Peacock Court",     "color": "#0E7A6E", "mood": "Peacock plumage on Mughal silk — regal teal-green."},
    {"name": "Ashoka Crimson",    "color": "#A02530", "mood": "Ashoka chakra red on ivory parchment — sovereign."},
    {"name": "Vetiver Mist",      "color": "#6E8B5A", "mood": "Cool vetiver root in monsoon air — green, herbaceous."},
    {"name": "Champa Petal",      "color": "#E8B45A", "mood": "Yellow champa flower on warm sand — fragrant, tender."},
    {"name": "Amrut Gold",        "color": "#C99845", "mood": "Honeyed amrut nectar in a brass vessel — slow, golden."},
    {"name": "Soma Silver",       "color": "#9AA0A8", "mood": "Moon-pressed soma on cool slate — contemplative, lunar."},
    {"name": "Krishna Twilight",  "color": "#1F2A6E", "mood": "Krishna-blue at twilight, gold flute glints — divine, dusk."},
    {"name": "Tulsi Garden",      "color": "#4F8C5A", "mood": "Holy basil in a courtyard at sunrise — cleansing, fresh."},
    {"name": "Banyan Shade",      "color": "#3E5C44", "mood": "Banyan canopy filtering noon light — old, rooted."},
    {"name": "Ghee Glow",         "color": "#E0B257", "mood": "Pure ghee melting on a copper diya — soft, sacred."},
    {"name": "Conch Pearl",       "color": "#E5DCCB", "mood": "Conch shell pearl on linen — quiet, beginning."},
    {"name": "Vermilion Tilak",   "color": "#D7263D", "mood": "Bold vermilion mark on a silk sari — auspicious, sharp."},
    {"name": "Lapis Mandala",     "color": "#1B5FA9", "mood": "Lapis lazuli mandala painted in gold dust — celestial."},
    {"name": "Coral Conch",       "color": "#E07A5F", "mood": "Coral and conch by a temple pond — playful, salt-warm."},
    {"name": "Patola Weave",      "color": "#7A1F3D", "mood": "Patola silk threads on ivory loom — heritage, woven."},
    {"name": "Sandstone Sun",     "color": "#C57E48", "mood": "Rajasthani sandstone in afternoon sun — dry, glowing."},
    {"name": "Gulmohar Bloom",    "color": "#E84545", "mood": "Gulmohar canopy in May heat — riotous red, fleeting."},
    {"name": "Mor Pankh",         "color": "#0F8B8D", "mood": "Peacock-feather teal on cream — playful, divine."},
    {"name": "Shankha White",     "color": "#F4F1E8", "mood": "Conch white with brass lining — pure, ceremonial."},
    {"name": "Kumkum Dawn",       "color": "#B22234", "mood": "Kumkum pinch at sunrise on a doorstep — domestic ritual."},
    {"name": "Indigo Khadi",      "color": "#33486B", "mood": "Hand-woven indigo khadi cloth — humble, earthy."},
    {"name": "Bel Patra",         "color": "#5A7D3A", "mood": "Bel patra leaves on a Shiva linga — green, votive."},
    {"name": "Dhoop Smoke",       "color": "#766B5C", "mood": "Sandalwood incense smoke curling in a shrine — gray-warm."},
    {"name": "Mehendi Bloom",     "color": "#6B7A2C", "mood": "Wedding mehendi on a pale palm — bridal, herbal."},
    {"name": "Surya Bronze",      "color": "#B86A2A", "mood": "Bronze sun temple at noon — fired, monumental."},
    {"name": "Yamuna Mist",       "color": "#5E8AA1", "mood": "Yamuna river mist before sunrise — soft, mythic."},
    {"name": "Rudraksha",         "color": "#5C3317", "mood": "Aged rudraksha bead on saffron thread — ascetic, deep."},
    {"name": "Diwali Diya",       "color": "#F2A93B", "mood": "Rangoli of diyas at festival night — joyous, lit."},
    {"name": "Kohl Night",        "color": "#1B1B23", "mood": "Kohl-rimmed eyes against a starlit sky — graphic, mystic."},
    {"name": "Silver Anklet",     "color": "#C0C5CC", "mood": "Silver anklets at a temple step — light, percussive."},
    {"name": "Pomegranate Vine",  "color": "#9C2C3E", "mood": "Pomegranate vines on a Persian rug — luxurious, layered."},
    {"name": "Cardamom Crush",    "color": "#6E7C4B", "mood": "Crushed green cardamom in mortar — aromatic, lively."},
    {"name": "Turmeric Stain",    "color": "#D4A017", "mood": "Fresh turmeric stain on linen — golden, healing."},
    {"name": "Neem Leaf",         "color": "#3F6B3A", "mood": "Bitter neem leaf in morning light — protective, clean."},
    {"name": "Jasmine Veil",      "color": "#F2EAD3", "mood": "Jasmine garland on a bride's veil — fragrant, soft."},
    {"name": "Ruby Rakhi",        "color": "#A6173A", "mood": "Ruby thread of a sister's rakhi — bonded, jeweled."},
    {"name": "Saffron Silk",      "color": "#E07F1F", "mood": "Saffron silk on temple steps — flame-warm, devout."},
    {"name": "Sage Saraswati",    "color": "#8FA37E", "mood": "Sage green and ivory script — wisdom, calm."},
    {"name": "Ochre Aranya",      "color": "#B8632B", "mood": "Forest ochre on bark — sylvan, rooted."},
    {"name": "Maroon Mandap",     "color": "#6E1A2A", "mood": "Wedding mandap drape in deep maroon — ceremonial."},
    {"name": "Tamarind Dusk",     "color": "#7A4F2B", "mood": "Tamarind paste at dusk over a clay pot — tangy, earthy."},
    {"name": "Sapphire Stupa",    "color": "#1F4D8A", "mood": "Sapphire night above a Sarnath stupa — vast, still."},
    {"name": "Rose Quartz",       "color": "#E8A6B0", "mood": "Rose quartz cradled in silver — gentle, healing."},
    {"name": "Brass Bell",        "color": "#A37A2C", "mood": "Polished brass temple bell at noon — resonant, warm."},
    {"name": "Mango Pulp",        "color": "#F5B544", "mood": "Ripe Alphonso mango in a silver bowl — sweet, summer."},
    {"name": "Slate Monsoon",     "color": "#3F4B5C", "mood": "Slate sky before the first monsoon drop — heavy, cool."},
    {"name": "Kaveri Stone",      "color": "#7A746A", "mood": "River-smoothed Kaveri stone — even, grounded."},
    {"name": "Hibiscus Devi",     "color": "#C1183A", "mood": "Hibiscus offering at a Devi shrine — bold, devotional."},
    {"name": "Banarasi Gold",     "color": "#C29C46", "mood": "Banarasi zari on red silk — opulent, woven."},
    {"name": "Lotus Pond",        "color": "#3D7C7A", "mood": "Lotus pond at dawn — teal water, pink bloom."},
    {"name": "Vermilion Sky",     "color": "#D44022", "mood": "Vermilion sky over a stepwell — dramatic, ancient."},
    {"name": "Khejri Sand",       "color": "#D7C089", "mood": "Khejri tree on Thar sand — desert tan, hardy."},
    {"name": "Indo Persian",      "color": "#264D6E", "mood": "Indo-Persian miniature blue — historical, refined."},
    {"name": "Rangoli Pink",      "color": "#E94B82", "mood": "Festival rangoli powder pink — playful, festive."},
    {"name": "Charcoal Tantra",   "color": "#23252B", "mood": "Charcoal yantra on bone-white paper — graphic, severe."},
    {"name": "Kanchi Silk",       "color": "#7C2A3A", "mood": "Kanchipuram silk in temple light — heavy, regal."},
    {"name": "Yagna Ember",       "color": "#C0392B", "mood": "Glowing ember in a yagna pit — primal, hot."},
    {"name": "Moonstone Pale",    "color": "#D5DAE0", "mood": "Moonstone on cool linen — luminous, quiet."},
    {"name": "Henna Hour",        "color": "#7A4A22", "mood": "Henna paste drying at dusk — slow, intimate."},
    {"name": "Banyan Bark",       "color": "#5C4126", "mood": "Banyan bark grain in afternoon — old, weathered."},
    {"name": "Turquoise Tibet",   "color": "#3FA9B5", "mood": "Tibetan turquoise on silver clasp — high-altitude bright."},
    {"name": "Garnet Gita",       "color": "#7B1E2A", "mood": "Garnet drop on a Gita page — deep, scholarly."},
    {"name": "Peepul Leaf",       "color": "#6FA45A", "mood": "Heart-shaped peepul leaf in light — sacred, fluttering."},
    {"name": "Saraswati Veena",   "color": "#C9A66B", "mood": "Polished veena wood — golden, learned."},
    {"name": "Onyx Asana",        "color": "#0D0F1C", "mood": "Onyx tile under a meditator's seat — black, anchored."},
    {"name": "Coral Reef",        "color": "#FF7F50", "mood": "Coral on a south coast — playful, salt-bright."},
    {"name": "Forest Bilva",      "color": "#3D5A3A", "mood": "Bilva tree grove at noon — green, votive."},
    {"name": "Powder Holi",       "color": "#FF66C4", "mood": "Holi gulal cloud against blue sky — riotous, joyous."},
    {"name": "Granite Ghat",      "color": "#4A4A52", "mood": "Granite ghat steps at sunrise — solid, eternal."},
    {"name": "Saffron Sutra",     "color": "#D88330", "mood": "Saffron-thread sutra on cream paper — disciplined, warm."},
    {"name": "Mehrangarh Blue",   "color": "#3B6FB5", "mood": "Jodhpur blue against fort sandstone — iconic, cool."},
    {"name": "Black Pepper",      "color": "#3A2E25", "mood": "Black peppercorn on burlap — pungent, earthy."},
    {"name": "Kumud Dawn",        "color": "#F4C5C5", "mood": "Pink water-lily at first light — delicate, opening."},
    {"name": "Amber Asthma",      "color": "#C97A2B", "mood": "Amber resin in a glass vial — warm, preserved."},
    {"name": "Kashmiri Saffron",  "color": "#E64C30", "mood": "Three saffron threads in milk — precious, slow."},
    {"name": "Ivory Sutra",       "color": "#F5EFDC", "mood": "Ivory page with saffron thread — quiet, learned."},
    {"name": "Indigo Stargaze",   "color": "#1A2A6C", "mood": "Indigo sky pricked with silver — vast, tranquil."},
    {"name": "Pista Kulfi",       "color": "#C7DBA0", "mood": "Pistachio kulfi in steel mould — playful, nostalgic."},
    {"name": "Maroon Brick",      "color": "#7B3E1F", "mood": "Sun-baked maroon brick — solid, ancestral."},
    {"name": "Lavender Aarti",    "color": "#A48BC9", "mood": "Lavender smoke from temple incense — gentle, fragrant."},
    {"name": "Olive Mauni",       "color": "#7A8050", "mood": "Olive cloth on a silent monk — contemplative, dim."},
    {"name": "Ruby Rangoli",      "color": "#B5163B", "mood": "Ruby red rangoli in a courtyard — auspicious, geometric."},
    {"name": "Sky Gopuram",       "color": "#4FA3D1", "mood": "Pale sky behind a tall gopuram — open, soaring."},
    {"name": "Sindoor Stripe",    "color": "#C81616", "mood": "Sindoor along a parted line of hair — bridal, vivid."},
]


def cmd_add_random(args):
    """Generate N fresh themes from the curated pool — zero typing required."""
    n = int(args.count)
    if n <= 0:
        sys.exit("count must be a positive integer")

    data = load()
    existing_names = {t["name"].strip().lower() for t in data["themes"]}
    existing_colors = {t.get("color", "").upper() for t in data["themes"]}

    # Filter to fresh, unused entries
    pool = [
        e for e in RANDOM_POOL
        if e["name"].strip().lower() not in existing_names
        and e["color"].upper() not in existing_colors
    ]
    if not pool:
        sys.exit("Curated pool exhausted — every name+color is already in the manifest. "
                 "Edit RANDOM_POOL in uat/cli.py to add more, or use `add` / `add-batch`.")

    # Deterministic shuffle if --seed provided, otherwise random.
    import random
    rng = random.Random(args.seed) if args.seed is not None else random.Random()
    rng.shuffle(pool)

    today = args.date or datetime.date.today().isoformat()
    take = pool[:n]
    if len(take) < n:
        print(f"⚠ pool only had {len(take)} fresh entries; adding those.")

    added = []
    for entry in take:
        color = entry["color"].upper()
        name = entry["name"]
        tid = next_id(data["themes"])
        is_dark = _is_dark(color)
        record = {
            "id": tid,
            "name": name,
            "color": color,
            "createdAt": today,
            "mood": entry.get("mood", f"{name} — a fresh palette evaluation candidate."),
            "fontDisplay": "'Inter', -apple-system, sans-serif" if is_dark
                           else "'Cormorant Garamond', Georgia, serif",
            "palette": derive_palette(color),
        }
        data["themes"].append(record)
        added.append(record)
        print(f"  + {tid:<8} {color}  {name}")

    save(data)
    print(f"\n✓ added {len(added)} themes (createdAt={today}). Total now: {len(data['themes'])}.")
    print("  Marquee shows newest 25; older themes drop into the scroll-up archive.")
    if not args.no_generate:
        _run_generate()
    print("\nNext: git add -A && git commit -m \"uat: daily theme drop\" && aq-uat-deploy")


def _run_generate():
    print("\n→ regenerating static HTML…")
    subprocess.run([sys.executable, str(ROOT / "generate.py")], check=False)


# ---------------------------------------------------------------------------
def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest="cmd", required=True)

    sp.add_parser("list").set_defaults(func=cmd_list)

    a = sp.add_parser("add", help="add a single theme")
    a.add_argument("name")
    a.add_argument("color", help="primary hex like #FF6B9D")
    a.add_argument("--mood", help="short tagline shown under the hero")
    a.add_argument("--date", help="createdAt (YYYY-MM-DD); defaults to today")
    a.add_argument("--id", help="override id (default: next themeN)")
    a.add_argument("--font", help="display font; default depends on light/dark")
    a.add_argument("--no-generate", action="store_true", help="don't regenerate HTML")
    a.set_defaults(func=cmd_add)

    b = sp.add_parser("add-batch", help="bulk-add from a CSV (columns: name,color[,mood][,date])")
    b.add_argument("file")
    b.add_argument("--date", help="default createdAt for rows missing it")
    b.add_argument("--no-generate", action="store_true")
    b.set_defaults(func=cmd_add_batch)

    rnd = sp.add_parser("add-random",
                        help="generate N fresh themes from the curated pool — zero typing")
    rnd.add_argument("count", type=int, help="how many themes to add (e.g. 5)")
    rnd.add_argument("--date", help="createdAt (YYYY-MM-DD); defaults to today")
    rnd.add_argument("--seed", type=int, help="deterministic shuffle seed (for reproducible drops)")
    rnd.add_argument("--no-generate", action="store_true", help="don't regenerate HTML")
    rnd.set_defaults(func=cmd_add_random)

    r = sp.add_parser("remove")
    r.add_argument("id")
    r.set_defaults(func=cmd_remove)

    d = sp.add_parser("set-display")
    d.add_argument("mode", choices=["exclude_oldest", "latest_n", "all"])
    d.add_argument("--n", type=int)
    d.set_defaults(func=cmd_set_display)

    sp.add_parser("next-id").set_defaults(func=cmd_next_id)

    args = p.parse_args()
    return args.func(args) or 0


if __name__ == "__main__":
    sys.exit(main())
