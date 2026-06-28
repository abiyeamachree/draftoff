"""Scrape every team colour page from teamcolorcodes.com sitemap.

Deterministic: only scraped hex values, no hash/league/unknown fallbacks.
Unmatched DB clubs are reported as fallbacks (excluded from CLUB_PRIMARY).

Run: .venv/Scripts/python.exe scripts/scrape_teamcolorcodes_strict.py
"""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER / "src"))

from sqlalchemy import select  # noqa: E402

from draftoff.db.models import Player, TeamEntry  # noqa: E402
from draftoff.db.session import get_session  # noqa: E402
from draftoff.team_match import resolve_team_name  # noqa: E402

OUT_TS = ROOT / "apps" / "web" / "lib" / "clubColors.generated.ts"
CACHE_JSON = SERVER / "data" / "club_colors_cache.json"
REPORT_JSON = SERVER / "data" / "club_colors_report.json"

UA = "DraftOff/1.0"
SITEMAPS = [
    "https://teamcolorcodes.com/post-sitemap.xml",
    "https://teamcolorcodes.com/post-sitemap2.xml",
    "https://teamcolorcodes.com/post-sitemap3.xml",
]

NON_SOCCER_SLUG = re.compile(
    r"(nba|nfl|mlb|nhl|ncaa|esports|thieves|luminosity|"
    r"basketball|baseball|hockey|cricket|rugby|"
    r"color-codes-for-|team-color-codes$)",
    re.I,
)

TITLE_RE = re.compile(r"<title>([^<]+)</title>", re.I)
HEX_PATTERNS = [
    re.compile(r"Primary(?:\s+Logo)?\s+Color[^#]{0,500}?(#[0-9A-Fa-f]{6})", re.I | re.S),
    re.compile(r"Primary Colors[\s\S]{0,1500}?(#[0-9A-Fa-f]{6})", re.I),
    re.compile(r"Hex Color:\s*(#[0-9A-Fa-f]{6})", re.I),
]


def ascii_slug(text: str) -> str:
    norm = unicodedata.normalize("NFKD", text)
    ascii_text = norm.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise
    return ""


def sitemap_color_urls() -> list[str]:
    urls: set[str] = set()
    for sm in SITEMAPS:
        xml = fetch(sm)
        for loc in re.findall(r"<loc>([^<]+)</loc>", xml):
            if loc.rstrip("/") == "https://teamcolorcodes.com":
                continue
            if "color" not in loc.lower():
                continue
            slug = loc.rstrip("/").split("/")[-1]
            if NON_SOCCER_SLUG.search(slug):
                continue
            if not (slug.endswith("-color-codes") or slug.endswith("-colors")):
                continue
            urls.add(loc.rstrip("/") + "/")
    return sorted(urls)


def title_to_name(title: str) -> str:
    t = re.sub(r"\s*Color Codes.*$", "", title, flags=re.I)
    t = re.sub(r"\s*Colors.*$", "", t, flags=re.I)
    t = re.sub(r"\s*Hex.*$", "", t, flags=re.I)
    return t.strip()


def extract_hex(html: str) -> str | None:
    for pat in HEX_PATTERNS:
        m = pat.search(html)
        if m:
            return m.group(1).upper()
    hexes = re.findall(r"#[0-9A-Fa-f]{6}", html[:15000])
    return hexes[0].upper() if hexes else None


def slug_from_url(url: str) -> str:
    slug = url.rstrip("/").split("/")[-1]
    for suffix in ("-color-codes", "-colors"):
        if slug.endswith(suffix):
            return slug[: -len(suffix)]
    return slug


def scrape_one(url: str) -> tuple[str, dict | None]:
    try:
        html = fetch(url)
    except Exception:
        return url, None
    title_m = TITLE_RE.search(html)
    title = title_m.group(1) if title_m else ""
    name = title_to_name(title)
    hex_color = extract_hex(html)
    slug = slug_from_url(url)
    if hex_color and name:
        return url, {"url": url, "hex": hex_color, "title": title, "name": name, "slug": slug}
    return url, None


def scrape_all(urls: list[str], cache: dict) -> dict:
    """cache key = url, value = {hex, title, name, slug}"""
    out = dict(cache)
    done = set(out.keys())
    pending = [u for u in urls if u not in done]
    print(f"  {len(done)} cached, {len(pending)} remaining")

    workers = 8
    batch = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(scrape_one, url): url for url in pending}
        for fut in as_completed(futures):
            url, entry = fut.result()
            if entry:
                out[url] = entry
            batch += 1
            if batch % 100 == 0:
                print(f"  progress {batch}/{len(pending)}, {len(out)} cached")
                CACHE_JSON.write_text(json.dumps(out, indent=2), encoding="utf-8")
            time.sleep(0.05)

    CACHE_JSON.write_text(json.dumps(out, indent=2), encoding="utf-8")
    return out


def norm_key(name: str) -> str:
    """Lowercase alphanumeric key for fuzzy club-name matching."""
    s = unicodedata.normalize("NFKD", name)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"^\d{2}\s+", "", s)  # SoFIFA roster year prefix
    s = re.sub(r"\b(f\.?c\.?|c\.?f\.?|s\.?k\.?|a\.?c\.?|s\.?c\.?|fk|sv|tsv|vfb|vfl)\b", " ", s, flags=re.I)
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    s = re.sub(r"\s+", " ", s).strip()
    for a, b in (("munich", "munchen"), ("cologne", "koln"), ("nurnberg", "nuremberg")):
        s = s.replace(a, b)
    tokens = [t for t in s.split() if len(t) > 2 or (t.isdigit() and len(t) >= 1)]
    return " ".join(tokens)


def core_name(team: str) -> str:
    """Strip SoFIFA year prefix and trailing youth/reserve markers."""
    s = re.sub(r"^\d{2}\s+", "", team)
    s = re.sub(r"\s+(II|III|B|U\d{2}|U-\d{2})$", "", s, flags=re.I)
    return s.strip()


def build_indexes(cache: dict) -> tuple[dict[str, str], dict[str, str], dict[str, str], dict[str, str]]:
    by_name: dict[str, str] = {}
    by_slug: dict[str, str] = {}
    by_norm: dict[str, str] = {}
    by_url_slug_name: dict[str, str] = {}
    for entry in cache.values():
        if not isinstance(entry, dict) or "hex" not in entry:
            continue
        hex_color = entry["hex"]
        name = entry.get("name", "")
        slug = entry.get("slug", "")
        if name:
            by_name[name] = hex_color
            by_norm[norm_key(name)] = hex_color
            stripped = re.sub(r"\s+(FC|F\.C\.|CF|C\.F\.|SC)$", "", name, flags=re.I).strip()
            if stripped:
                by_name.setdefault(stripped, hex_color)
                by_norm.setdefault(norm_key(stripped), hex_color)
        if slug:
            by_slug[slug] = hex_color
            by_url_slug_name[slug.replace("-", " ")] = hex_color
    return by_name, by_slug, by_norm, by_url_slug_name


def slug_candidates(team: str) -> list[str]:
    core = core_name(team)
    cands = [ascii_slug(team), ascii_slug(core)]
    stripped = re.sub(r"^\d+\s+", "", core)
    stripped = re.sub(r"\s+(FC|F\.C\.|CF|C\.F\.|SC|SK|FK|AC|AS)$", "", stripped, flags=re.I)
    if stripped != core:
        cands.append(ascii_slug(stripped))
    for src in (team, core):
        cands.append(ascii_slug(re.sub(r"\.\s*", "-", src)))
    return list(dict.fromkeys(c for c in cands if c))


def match_team(
    team: str,
    by_name: dict[str, str],
    by_slug: dict[str, str],
    by_norm: dict[str, str],
) -> tuple[str | None, str]:
    if team in by_name:
        return by_name[team], "exact-name"

    core = core_name(team)
    if core != team and core in by_name:
        return by_name[core], "core-name"

    nk = norm_key(team)
    if nk in by_norm:
        return by_norm[nk], "norm-key"

    for slug in slug_candidates(team):
        if slug in by_slug:
            return by_slug[slug], f"slug:{slug}"

    pool = set(by_name.keys())
    for candidate in (team, core):
        resolved = resolve_team_name(candidate, pool)
        if resolved and resolved in by_name:
            return by_name[resolved], "resolved-name"

    # Unique normalized substring: all significant words appear in one scraped name
    words = [w for w in nk.split() if len(w) > 2]
    if words:
        hits = [h for h in by_norm if all(w in h.split() or w in h for w in words)]
        if len(hits) == 1:
            return by_norm[hits[0]], "word-hit"

    # Single significant token unique in pool (e.g. DB "AC Milan" -> "milan")
    if len(words) == 1:
        w = words[0]
        hits = [h for h in by_norm if w == h or f" {w}" in f" {h}" or h.endswith(f" {w}")]
        if len(hits) == 1:
            return by_norm[hits[0]], "single-word"

    return None, "fallback"


def load_db_teams() -> list[str]:
    with get_session() as session:
        names = set(
            session.execute(select(Player.team).where(Player.team != "").distinct()).scalars()
        )
        names |= set(
            session.execute(select(TeamEntry.team).where(TeamEntry.team != "").distinct()).scalars()
        )
    return sorted(names)


def write_ts(colors: dict[str, str]) -> None:
    lines = [
        "/** Scraped from teamcolorcodes.com sitemap — do not edit. */",
        "",
        "export const CLUB_PRIMARY: Readonly<Record<string, string>> = {",
    ]
    for team in sorted(colors.keys()):
        esc = team.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  "{esc}": "{colors[team]}",')
    lines.append("} as const;")
    lines.append("")
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    match_only = "--match-only" in sys.argv

    cache: dict = {}
    if CACHE_JSON.exists():
        cache = json.loads(CACHE_JSON.read_text(encoding="utf-8"))

    if match_only:
        print("Match-only mode (skipping scrape)")
        urls = []
    else:
        print("Loading sitemap URLs…")
        urls = sitemap_color_urls()
        print(f"  {len(urls)} soccer-ish colour pages")
        print("Scraping team pages…")
        cache = scrape_all(urls, cache)

    by_name, by_slug, by_norm, _ = build_indexes(cache)
    print(f"  indexed names: {len(by_name)}, slugs: {len(by_slug)}, norm: {len(by_norm)}")

    db_teams = load_db_teams()
    final: dict[str, str] = {}
    stats: dict[str, int] = {}
    missing: list[str] = []

    for team in db_teams:
        hex_color, how = match_team(team, by_name, by_slug, by_norm)
        if hex_color:
            final[team] = hex_color
            stats[how.split(":")[0]] = stats.get(how.split(":")[0], 0) + 1
        else:
            missing.append(team)
            stats["fallback"] = stats.get("fallback", 0) + 1

    # Propagate scraped colours across SoFIFA year/roster variants of the same club.
    from collections import defaultdict

    groups: dict[str, list[str]] = defaultdict(list)
    for team in db_teams:
        groups[norm_key(core_name(team))].append(team)
    for ck, teams in groups.items():
        if not ck:
            continue
        colored = [t for t in teams if t in final]
        if not colored:
            continue
        color = final[colored[0]]
        for t in teams:
            if t not in final:
                final[t] = color
                missing.remove(t)
                stats["fallback"] -= 1
                stats["sibling"] = stats.get("sibling", 0) + 1

    write_ts(final)
    REPORT_JSON.write_text(
        json.dumps({"stats": stats, "missing": missing, "matched": len(final)}, indent=2),
        encoding="utf-8",
    )

    print("\n=== RESULTS ===")
    print(f"DB teams:     {len(db_teams)}")
    print(f"Pages scraped:{len(cache)}")
    print(f"Matched:      {len(final)}")
    print(f"FALLBACKS:    {len(missing)}")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
