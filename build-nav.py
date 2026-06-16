#!/usr/bin/env python3
"""
build-nav.py — Stamps each community's _nav.html into its pages.

USAGE:
    python3 build-nav.py                    # update all communities
    python3 build-nav.py --check            # dry run
    python3 build-nav.py --only=scw         # just SCW (now in /sun-city-west/)
    python3 build-nav.py --only=sun-city-grand   # just SG folder

ARCHITECTURE:
    The site is multi-community. Each community has its own subfolder + nav:

      /sun-city-west/_nav.html      -> stamps into /sun-city-west/*.html
      /sun-city-grand/_nav.html     -> stamps into /sun-city-grand/*.html
      /corte-bella/_nav.html        -> stamps into /corte-bella/*.html
      /pebblecreek/_nav.html        -> stamps into /pebblecreek/*.html (if present)

    Each page has the markers <!-- NAV:START --> ... <!-- NAV:END -->
    The script replaces everything between them with the community's nav,
    auto-highlighting the current page's link.

DAILY WORKFLOW:
    1. Edit the appropriate _nav.html in the community's subfolder
    2. Run python3 build-nav.py
    3. Every page in that community now has the updated nav
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent

START = "<!-- NAV:START -->"
END = "<!-- NAV:END -->"

COMMUNITIES = [
    {
        "name": "scw",
        "label": "Sun City West",
        "scope": ROOT / "sun-city-west",
        "nav_file": ROOT / "sun-city-west" / "_nav.html",
        "exclude": {"index.html"},
    },
    {
        "name": "sun-city-grand",
        "label": "The Grand",
        "scope": ROOT / "sun-city-grand",
        "nav_file": ROOT / "sun-city-grand" / "_nav.html",
        "exclude": set(),
    },
    {
        "name": "corte-bella",
        "label": "Corte Bella",
        "scope": ROOT / "corte-bella",
        "nav_file": ROOT / "corte-bella" / "_nav.html",
        "exclude": set(),
    },
]


def load_nav(nav_file: Path) -> str:
    raw = nav_file.read_text(encoding="utf-8")
    m = re.search(r"<nav\b", raw)
    if not m:
        raise SystemExit(f"ERROR: couldn't find <nav> in {nav_file}")
    return raw[m.start():].rstrip()


def mark_current_page(nav_html: str, page_filename: str) -> str:
    out_lines = []
    for line in nav_html.splitlines():
        m = re.search(r'<a\s+href="([^"]+)"\s+class="(scw-nav-btn[^"]*)"', line)
        if m:
            href = m.group(1).split("?")[0]
            href_basename = href.rsplit("/", 1)[-1]
            if href_basename == page_filename:
                existing_classes = m.group(2)
                if "scw-nav-btn-current" not in existing_classes:
                    new_classes = existing_classes + " scw-nav-btn-current"
                    line = line.replace(
                        f'class="{existing_classes}"',
                        f'class="{new_classes}"',
                    )
        out_lines.append(line)
    return "\n".join(out_lines)


def update_page(path: Path, nav_html: str, check_only: bool) -> str:
    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ERROR reading {path.name}: {e}")
        return "error"

    if START not in content or END not in content:
        return "no-markers"

    page_nav = mark_current_page(nav_html, path.name)
    new_content = re.sub(
        re.escape(START) + r".*?" + re.escape(END),
        START + "\n" + page_nav + "\n" + END,
        content,
        count=1,
        flags=re.DOTALL,
    )

    if new_content == content:
        return "unchanged"
    if not check_only:
        path.write_text(new_content, encoding="utf-8")
    return "updated"


def process_community(cfg: dict, check_only: bool) -> dict:
    rel = cfg["scope"].relative_to(ROOT) if cfg["scope"] != ROOT else "."
    print(f"\n━━━ {cfg['label']} ({rel}) ━━━")
    if not cfg["nav_file"].exists():
        print(f"  (no _nav.html at {cfg['nav_file'].relative_to(ROOT)}, skipping)")
        return {}

    nav_html = load_nav(cfg["nav_file"])
    stats = {"updated": [], "unchanged": [], "no-markers": [], "error": []}

    if not cfg["scope"].exists():
        print(f"  (scope folder doesn't exist yet, skipping)")
        return stats

    for path in sorted(cfg["scope"].glob("*.html")):
        if path.name == "_nav.html":
            continue
        if path.name.startswith("_"):  # _template.html etc are internal
            continue
        if path.name in cfg["exclude"]:
            continue
        result = update_page(path, nav_html, check_only)
        stats[result].append(path.name)

    action = "Would update" if check_only else "Updated"
    print(f"  {action}: {len(stats['updated'])} page(s)")
    for f in stats["updated"]:
        print(f"    ✓ {f}")
    if stats["unchanged"]:
        print(f"  Unchanged: {len(stats['unchanged'])}")
    if stats["no-markers"]:
        print(f"  Skipped (no markers): {len(stats['no-markers'])}")
        for f in stats["no-markers"]:
            print(f"    - {f}")
    return stats


def main():
    args = sys.argv[1:]
    check_only = "--check" in args
    only = None
    for a in args:
        if a.startswith("--only="):
            only = a.split("=", 1)[1]

    targets = [c for c in COMMUNITIES if (only is None or c["name"] == only)]
    if not targets:
        print(f"No community named '{only}' configured.")
        print("Configured:", ", ".join(c["name"] for c in COMMUNITIES))
        return

    for cfg in targets:
        process_community(cfg, check_only)

    if check_only:
        print("\n(dry run — no files modified)")


if __name__ == "__main__":
    main()
