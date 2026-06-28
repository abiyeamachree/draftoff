/**
 * Competition team lists sourced from Wikipedia.
 * Regenerate UCL: cd apps/server && .venv/Scripts/python.exe scripts/scrape_wikipedia_teams.py
 *
 * WC 2026 — https://en.wikipedia.org/wiki/2026_FIFA_World_Cup (qualified teams)
 * UCL 25/26 — https://en.wikipedia.org/wiki/2025–26_UEFA_Champions_League (league phase)
 */

/** 48 nations that qualified for the 2026 FIFA World Cup (by confederation). */
export const WC_2026_NATIONS = [
  // AFC (9)
  "Australia",
  "Iran",
  "Iraq",
  "Japan",
  "Jordan",
  "Qatar",
  "Saudi Arabia",
  "South Korea",
  "Uzbekistan",
  // CAF (10)
  "Algeria",
  "Cape Verde",
  "DR Congo",
  "Egypt",
  "Ghana",
  "Ivory Coast",
  "Morocco",
  "Senegal",
  "South Africa",
  "Tunisia",
  // CONCACAF (6)
  "Canada",
  "Curaçao",
  "Haiti",
  "Mexico",
  "Panama",
  "United States",
  // CONMEBOL (6)
  "Argentina",
  "Brazil",
  "Colombia",
  "Ecuador",
  "Paraguay",
  "Uruguay",
  // OFC (1)
  "New Zealand",
  // UEFA (16)
  "Austria",
  "Belgium",
  "Bosnia and Herzegovina",
  "Croatia",
  "Czech Republic",
  "England",
  "France",
  "Germany",
  "Netherlands",
  "Norway",
  "Portugal",
  "Scotland",
  "Spain",
  "Sweden",
  "Switzerland",
  "Turkey",
] as const;

/** WC 2026 qualified nations grouped by confederation (for fill-team picker). */
export const WC_2026_BY_CONFED: Record<string, readonly string[]> = {
  AFC: [
    "Australia",
    "Iran",
    "Iraq",
    "Japan",
    "Jordan",
    "Qatar",
    "Saudi Arabia",
    "South Korea",
    "Uzbekistan",
  ],
  CAF: [
    "Algeria",
    "Cape Verde",
    "DR Congo",
    "Egypt",
    "Ghana",
    "Ivory Coast",
    "Morocco",
    "Senegal",
    "South Africa",
    "Tunisia",
  ],
  CONCACAF: [
    "Canada",
    "Curaçao",
    "Haiti",
    "Mexico",
    "Panama",
    "United States",
  ],
  CONMEBOL: [
    "Argentina",
    "Brazil",
    "Colombia",
    "Ecuador",
    "Paraguay",
    "Uruguay",
  ],
  OFC: ["New Zealand"],
  UEFA: [
    "Austria",
    "Belgium",
    "Bosnia and Herzegovina",
    "Croatia",
    "Czech Republic",
    "England",
    "France",
    "Germany",
    "Netherlands",
    "Norway",
    "Portugal",
    "Scotland",
    "Spain",
    "Sweden",
    "Switzerland",
    "Turkey",
  ],
};

export const WC_2026_SEASON = "25/26";

/** 36 clubs in the 2025–26 UEFA Champions League league phase. */
export const UCL_2526_CLUBS = [
  "Arsenal",
  "Bayern Munich",
  "Liverpool",
  "Tottenham Hotspur",
  "Barcelona",
  "Chelsea",
  "Sporting CP",
  "Manchester City",
  "Real Madrid",
  "Inter",
  "Paris Saint-Germain",
  "Newcastle United",
  "Juventus",
  "Atletico Madrid",
  "Atalanta",
  "Bayer Leverkusen",
  "Borussia Dortmund",
  "Olympiacos",
  "Club Brugge",
  "Galatasaray",
  "Monaco",
  "Qarabag",
  "Bodo/Glimt",
  "Benfica",
  "Marseille",
  "Pafos",
  "Union Saint-Gilloise",
  "PSV Eindhoven",
  "Athletic Bilbao",
  "Napoli",
  "Copenhagen",
  "Ajax",
  "Eintracht Frankfurt",
  "Slavia Prague",
  "Villarreal",
  "Kairat",
] as const;

export type Wc2026Nation = (typeof WC_2026_NATIONS)[number];
export type Ucl2526Club = (typeof UCL_2526_CLUBS)[number];
