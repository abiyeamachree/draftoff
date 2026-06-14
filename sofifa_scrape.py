from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path

import nodriver as uc
from bs4 import BeautifulSoup

BASE = Path(__file__).parent
OUT_DIR = BASE / "sofifa_data"
OUT_DIR.mkdir(exist_ok=True)
PROGRESS_FILE = OUT_DIR / "progress.json"
COMBINED_CSV = BASE / "sofifa_all_players.csv"

VERSIONS: list[tuple[str, str]] = [
    ("FC 26", "260037"),
    ("FC 25", "250044"),
    ("FC 24", "240050"),
    ("FIFA 23", "230054"),
    ("FIFA 22", "220069"),
    ("FIFA 21", "210064"),
    ("FIFA 20", "200061"),
    ("FIFA 19", "190075"),
    ("FIFA 18", "180084"),
    ("FIFA 17", "170099"),
    ("FIFA 16", "160058"),
    ("FIFA 15", "150059"),
    ("FIFA 14", "140052"),
    ("FIFA 13", "130034"),
    ("FIFA 12", "120002"),
    ("FIFA 11", "110002"),
    ("FIFA 10", "100002"),
    ("FIFA 09", "090002"),
    ("FIFA 08", "080002"),
    ("FIFA 07", "070002"),
]

COL_MAP: dict[str, str] = {
    "pi": "player_id_col",
    "ae": "age",
    "oa": "overall",
    "pt": "potential",
    "bp": "best_position",
    "bo": "best_overall",
    "gu": "growth",
    "vl": "value",
    "wg": "wage",
    "rc": "release_clause",
    "hi": "height",
    "wi": "weight",
    "pf": "preferred_foot",
    "by": "birth_year",
    "jt": "joined",
    "wk": "weak_foot",
    "sk": "skill_moves",
    "ir": "intl_reputation",
    "aw": "attack_work_rate",
    "dw": "defense_work_rate",
    "bt": "body_type",
    "cp": "club_position",
    "cj": "kit_number",
    "pac": "pace",
    "sho": "shooting",
    "pas": "passing",
    "dri": "dribbling",
    "def": "defending",
    "phy": "physical",
    "bs": "base_stats",
    "tt": "total_stats",
    "cr": "crossing",
    "fi": "finishing",
    "he": "heading_accuracy",
    "sh": "short_passing",
    "vo": "volleys",
    "dr": "dribbling_attr",
    "cu": "curve",
    "fr": "fk_accuracy",
    "lo": "long_passing",
    "bl": "ball_control",
    "ac": "acceleration",
    "sp": "sprint_speed",
    "ag": "agility",
    "re": "reactions",
    "ba": "balance",
    "so": "shot_power",
    "ju": "jumping",
    "st": "stamina",
    "sr": "strength",
    "ln": "long_shots",
    "ar": "aggression",
    "in": "interceptions",
    "po": "att_position",
    "vi": "vision",
    "pe": "penalties",
    "cm": "composure",
    "ma": "defensive_awareness",
    "sa": "standing_tackle",
    "sl": "sliding_tackle",
    "gd": "gk_diving",
    "gh": "gk_handling",
    "gc": "gk_kicking",
    "gp": "gk_positioning",
    "gr": "gk_reflexes",
}

COLS = list(COL_MAP.keys())

OUTPUT_FIELDS = [
    "edition",
    "version_id",
    "player_id",
    "name",
    "legal_name",
    "age",
    "overall",
    "potential",
    "best_position",
    "positions",
    "nation",
    "nation_id",
    "team",
    "team_id",
    "league",
    "league_id",
    "contract",
    "value",
    "wage",
    "release_clause",
    "height",
    "weight",
    "preferred_foot",
    "birth_year",
    "joined",
    "weak_foot",
    "skill_moves",
    "intl_reputation",
    "attack_work_rate",
    "defense_work_rate",
    "body_type",
    "club_position",
    "kit_number",
    "best_overall",
    "growth",
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defending",
    "physical",
    "base_stats",
    "total_stats",
    "crossing",
    "finishing",
    "heading_accuracy",
    "short_passing",
    "volleys",
    "dribbling_attr",
    "curve",
    "fk_accuracy",
    "long_passing",
    "ball_control",
    "acceleration",
    "sprint_speed",
    "agility",
    "reactions",
    "balance",
    "shot_power",
    "jumping",
    "stamina",
    "strength",
    "long_shots",
    "aggression",
    "interceptions",
    "att_position",
    "vision",
    "penalties",
    "composure",
    "defensive_awareness",
    "standing_tackle",
    "sliding_tackle",
    "gk_diving",
    "gk_handling",
    "gk_kicking",
    "gk_positioning",
    "gk_reflexes",
    "player_url",
]

PAGE_SIZE = 60
REQUEST_DELAY = 1.5


def log(msg: str) -> None:
    print(msg, flush=True)


def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    return {}


def save_progress(progress: dict) -> None:
    PROGRESS_FILE.write_text(json.dumps(progress, indent=2), encoding="utf-8")


def build_players_url(version_id: str, offset: int = 0) -> str:
    params: list[tuple[str, str]] = [("r", version_id), ("set", "true")]
    params += [("showCol[]", c) for c in COLS]
    if offset:
        params.append(("offset", str(offset)))
    return "https://sofifa.com/?" + urllib.parse.urlencode(params)


def build_teams_url(version_id: str, offset: int = 0) -> str:
    params: list[tuple[str, str]] = [("r", version_id), ("set", "true")]
    if offset:
        params.append(("offset", str(offset)))
    return f"https://sofifa.com/teams?{urllib.parse.urlencode(params)}"


async def wait_for_content(page, expect_table: bool = True, max_wait: int = 60) -> None:
    for _ in range(max_wait // 2):
        title = await page.evaluate("document.title")
        html = await page.get_content()
        if "Just a moment" in title:
            await page.sleep(2)
            continue
        if expect_table and "<table" in html and "tbody" in html:
            return
        if not expect_table:
            return
        await page.sleep(2)
    raise RuntimeError("Timed out waiting for page content")


async def fetch_html(browser, url: str) -> str:
    page = await browser.get(url)
    await wait_for_content(page)
    await page.sleep(1)
    return await page.get_content()


def parse_id_from_href(href: str, segment: str) -> str:
    m = re.search(rf"/{segment}/(\d+)/", href)
    return m.group(1) if m else ""


def cell_text(td) -> str:
    em = td.find("em")
    if em and em.get("title"):
        return em.get("title").strip()
    return td.get_text(" ", strip=True)


def pick_player_name(player_link) -> tuple[str, str]:
    """
    Return (regular_name, legal_name) from list-view player link.
    """
    display = player_link.get_text(" ", strip=True)
    tooltip = (player_link.get("data-tippy-content") or "").strip()
    if not display and tooltip:
        return tooltip, tooltip
    if tooltip and re.match(r"^[A-Z]\.\s", display):
        return tooltip, tooltip
    regular = display or tooltip
    legal = tooltip if tooltip and tooltip != regular else ""
    return regular, legal


def parse_team_map(html: str) -> dict[str, dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return {}
    mapping: dict[str, dict[str, str]] = {}
    for row in table.select("tbody tr"):
        team_link = row.select_one("a[href*='/team/']")
        if not team_link:
            continue
        team_id = parse_id_from_href(team_link["href"], "team")
        if not team_id:
            continue
        league_link = row.select_one("a[href*='/league/']")
        league_id = parse_id_from_href(league_link["href"], "league") if league_link else ""
        league_name = league_link.get_text(" ", strip=True) if league_link else ""
        if not league_name:
            parts = row.get_text("|", strip=True).split("|")
            if len(parts) >= 2:
                league_name = parts[1].strip()
        mapping[team_id] = {
            "team_name": team_link.get_text(" ", strip=True),
            "league_name": league_name,
            "league_id": league_id,
        }
    return mapping


async def scrape_team_map(browser, version_id: str) -> dict[str, dict[str, str]]:
    cache_path = OUT_DIR / f"teams_{version_id}.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    log(f"  Scraping team/league map for r={version_id}...")
    combined: dict[str, dict[str, str]] = {}
    offset = 0
    while True:
        html = await fetch_html(browser, build_teams_url(version_id, offset))
        chunk = parse_team_map(html)
        if not chunk:
            break
        combined.update(chunk)
        if f"offset={offset + PAGE_SIZE}" not in html and offset > 0:
            break
        if len(chunk) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(REQUEST_DELAY)

    cache_path.write_text(json.dumps(combined, indent=2), encoding="utf-8")
    log(f"  Teams mapped: {len(combined)}")
    return combined


def parse_player_rows(
    html: str,
    edition: str,
    version_id: str,
    team_map: dict[str, dict[str, str]],
) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return []
    rows_out: list[dict[str, str]] = []
    for row in table.select("tbody tr"):
        player_link = row.select_one("a[href*='/player/']")
        if not player_link:
            continue

        player_id = ""
        img = row.select_one("img[id]")
        if img and img.get("id"):
            player_id = img["id"]
        if not player_id:
            player_id = parse_id_from_href(player_link["href"], "player")

        name, legal_name = pick_player_name(player_link)
        flag = row.select_one("img.flag")
        nation = flag.get("title", "") if flag else ""
        nation_link = row.select_one("a[href*='na=']")
        nation_id = ""
        if nation_link:
            m = re.search(r"na=(\d+)", nation_link["href"])
            if m:
                nation_id = m.group(1)

        positions = [s.get_text(strip=True) for s in row.select("span.pos")]
        positions_str = ",".join(positions)

        team_link = row.select_one("a[href*='/team/']")
        team_id = parse_id_from_href(team_link["href"], "team") if team_link else ""
        team_name = team_link.get_text(" ", strip=True) if team_link else ""
        league_name = ""
        league_id = ""
        if team_id and team_id in team_map:
            team_name = team_map[team_id].get("team_name", team_name)
            league_name = team_map[team_id].get("league_name", "")
            league_id = team_map[team_id].get("league_id", "")

        contract = ""
        sub = row.select_one("td .sub")
        if sub:
            contract = sub.get_text(" ", strip=True)

        record: dict[str, str] = {f: "" for f in OUTPUT_FIELDS}
        record["edition"] = edition
        record["version_id"] = version_id
        record["player_id"] = player_id
        record["name"] = name
        record["legal_name"] = legal_name
        record["positions"] = positions_str
        record["nation"] = nation
        record["nation_id"] = nation_id
        record["team"] = team_name
        record["team_id"] = team_id
        record["league"] = league_name
        record["league_id"] = league_id
        record["contract"] = contract
        record["player_url"] = f"https://sofifa.com{player_link['href']}"

        for td in row.find_all("td"):
            col = td.get("data-col")
            if not col or col not in COL_MAP:
                continue
            field = COL_MAP[col]
            value = cell_text(td)
            if field == "player_id_col" and value:
                record["player_id"] = value
            elif field in OUTPUT_FIELDS:
                record[field] = value

        rows_out.append(record)
    return rows_out


def edition_csv_path(version_id: str) -> Path:
    return OUT_DIR / f"players_{version_id}.csv"


def append_rows(path: Path, rows: list[dict[str, str]]) -> None:
    write_header = not path.exists() or path.stat().st_size == 0
    with path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_FIELDS, extrasaction="ignore")
        if write_header:
            writer.writeheader()
        writer.writerows(rows)


async def scrape_edition(
    browser,
    edition: str,
    version_id: str,
    progress: dict,
    probe: bool = False,
) -> int:
    csv_path = edition_csv_path(version_id)
    team_map = await scrape_team_map(browser, version_id)

    start_offset = progress.get(version_id, {}).get("offset", 0)
    if probe:
        start_offset = 0
        if csv_path.exists():
            csv_path.unlink()
    elif start_offset == 0 and csv_path.exists():
        with csv_path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            row_count = sum(1 for _ in reader)
        if row_count > 0:
            start_offset = row_count
            log(f"  Resuming from {row_count} existing rows in {csv_path.name}")
        else:
            csv_path.unlink()

    offset = start_offset
    total = 0
    log(f"=== {edition} (r={version_id}) offset={offset} ===")

    while True:
        url = build_players_url(version_id, offset)
        html = await fetch_html(browser, url)
        rows = parse_player_rows(html, edition, version_id, team_map)
        if not rows:
            log(f"  No rows at offset {offset}, done.")
            break

        append_rows(csv_path, rows)
        total += len(rows)
        log(f"  offset {offset}: +{len(rows)} (edition total {total})")

        progress[version_id] = {"offset": offset + PAGE_SIZE, "edition": edition}
        save_progress(progress)

        if probe:
            break
        if len(rows) < PAGE_SIZE:
            break
        if f"offset={offset + PAGE_SIZE}" not in html:
            break

        offset += PAGE_SIZE
        time.sleep(REQUEST_DELAY)

    if not probe:
        progress[version_id] = {"offset": 0, "edition": edition, "done": True}
        save_progress(progress)
    return total


def merge_all() -> int:
    all_rows: list[dict[str, str]] = []
    for edition, version_id in VERSIONS:
        path = edition_csv_path(version_id)
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                all_rows.append(row)

    with COMBINED_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    log(f"Merged {len(all_rows)} rows -> {COMBINED_CSV}")
    return len(all_rows)


async def run(only: str | None, probe: bool, merge_only: bool) -> None:
    if merge_only:
        merge_all()
        return

    versions = VERSIONS
    if only:
        versions = [(e, v) for e, v in VERSIONS if v == only]
        if not versions:
            log(f"Unknown version id: {only}")
            sys.exit(1)

    progress = load_progress()
    browser = await uc.start(headless=False)

    try:
        if probe:
            edition, vid = versions[0]
            n = await scrape_edition(browser, edition, vid, progress, probe=True)
            log(f"Probe OK: {n} rows from {edition}")
            path = edition_csv_path(vid)
            if path.exists():
                with path.open(encoding="utf-8") as f:
                    sample = next(csv.DictReader(f))
                log("Sample player:")
                for k in ["name", "overall", "team", "league", "pace", "shooting", "passing"]:
                    log(f"  {k}: {sample.get(k)}")
        else:
            grand = 0
            for edition, version_id in versions:
                key = version_id
                if progress.get(key, {}).get("done"):
                    log(f"Skipping {edition} (already done)")
                    continue
                grand += await scrape_edition(browser, edition, version_id, progress)
            merge_all()
            log(f"All done. Grand total this run: {grand}")
    finally:
        browser.stop()


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape SoFIFA player data")
    parser.add_argument("--probe", action="store_true", help="Scrape one page of FC 26")
    parser.add_argument("--only", type=str, help="Scrape single version id (e.g. 260037)")
    parser.add_argument("--merge-only", action="store_true", help="Merge per-edition CSVs only")
    args = parser.parse_args()
    uc.loop().run_until_complete(run(args.only, args.probe, args.merge_only))


if __name__ == "__main__":
    main()
