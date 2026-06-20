"use client";

import { emptyPoolFilter, emptyPoolRules } from "@draftoff/shared";
import type { LobbySettings, PoolFilter } from "@draftoff/shared";
import { UCL_2526_CLUBS, WC_2026_NATIONS } from "@/lib/competitionTeams";

export type PoolKey = keyof PoolFilter;

export type PresetEmblem = "england" | "star" | "globe" | "prem38" | "world";

export type PresetConfig = Partial<Omit<LobbySettings, "visibility">>;

export interface Preset {
  name: string;
  config: PresetConfig;
  emblem?: PresetEmblem;
  description?: string;
}

export const POOL_LABELS: Record<PoolKey, string> = {
  leagues: "Leagues",
  seasons: "Seasons",
  nations: "Nations",
  clubs: "Clubs",
};

/**
 * Season-keyed club data. The same league has different members each season
 * (promotion/relegation). Curated placeholder data until the player pool is
 * seeded from the CSV.
 */
const PL_2526 = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
  "Burnley",
  "Chelsea",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Leeds United",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle United",
  "Nottingham Forest",
  "Sunderland",
  "Tottenham Hotspur",
  "West Ham United",
  "Wolverhampton Wanderers",
];

const PL_2425 = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
  "Chelsea",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Ipswich Town",
  "Leicester City",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle United",
  "Nottingham Forest",
  "Southampton",
  "Tottenham Hotspur",
  "West Ham United",
  "Wolverhampton Wanderers",
];

const CLUBS_2526: Record<string, string[]> = {
  "Premier League": PL_2526,
  Championship: [
    "Leicester City",
    "Ipswich Town",
    "Southampton",
    "Sheffield United",
    "West Bromwich Albion",
    "Watford",
    "Middlesbrough",
    "Coventry City",
  ],
  "League One": [
    "Birmingham City",
    "Wrexham",
    "Bolton Wanderers",
    "Huddersfield Town",
    "Stockport County",
  ],
  "League Two": [
    "Notts County",
    "MK Dons",
    "Bradford City",
    "Port Vale",
    "Walsall",
  ],
  "La Liga": [
    "Real Madrid",
    "Barcelona",
    "Atletico Madrid",
    "Athletic Bilbao",
    "Real Sociedad",
    "Real Betis",
    "Villarreal",
    "Valencia",
    "Sevilla",
    "Girona",
    "Celta Vigo",
    "Osasuna",
    "Getafe",
    "Rayo Vallecano",
    "Mallorca",
    "Las Palmas",
    "Espanyol",
    "Leganes",
    "Alaves",
    "Valladolid",
  ],
  "Serie A": [
    "Inter",
    "AC Milan",
    "Juventus",
    "Napoli",
    "Atalanta",
    "Roma",
    "Lazio",
    "Fiorentina",
    "Bologna",
    "Torino",
    "Udinese",
    "Genoa",
    "Monza",
    "Cagliari",
    "Lecce",
    "Empoli",
    "Hellas Verona",
    "Parma",
    "Como",
    "Venezia",
  ],
  Bundesliga: [
    "Bayern Munich",
    "Bayer Leverkusen",
    "Borussia Dortmund",
    "RB Leipzig",
    "VfB Stuttgart",
    "Eintracht Frankfurt",
    "Borussia Monchengladbach",
    "VfL Wolfsburg",
    "SC Freiburg",
    "Werder Bremen",
    "Hoffenheim",
    "FC Augsburg",
    "Union Berlin",
    "Mainz 05",
    "FC Heidenheim",
    "VfL Bochum",
    "Holstein Kiel",
    "FC St. Pauli",
  ],
  "Ligue 1": [
    "Paris Saint-Germain",
    "Marseille",
    "Monaco",
    "Lille",
    "Lyon",
    "Nice",
    "Lens",
    "Rennes",
    "Strasbourg",
    "Brest",
    "Toulouse",
    "Nantes",
    "Montpellier",
    "Reims",
    "Auxerre",
    "Angers",
    "Le Havre",
    "Saint-Etienne",
  ],
  Eredivisie: ["Ajax", "PSV Eindhoven", "Feyenoord", "AZ Alkmaar", "Twente", "Utrecht"],
  "Primeira Liga": ["Benfica", "Porto", "Sporting CP", "Braga", "Vitoria SC"],
  "Saudi Pro League": ["Al Hilal", "Al Nassr", "Al Ittihad", "Al Ahli"],
  MLS: ["Inter Miami", "LA Galaxy", "LAFC", "Seattle Sounders", "Atlanta United"],
};

// 24/25 differs from 25/26 mainly by promotion/relegation in England.
const CLUBS_2425: Record<string, string[]> = {
  ...CLUBS_2526,
  "Premier League": PL_2425,
  Championship: [
    "Leeds United",
    "Burnley",
    "Sunderland",
    "Sheffield United",
    "West Bromwich Albion",
    "Watford",
    "Middlesbrough",
    "Coventry City",
  ],
};

/** Seasons available for league-team selection, newest first. */
export const TEAM_SEASONS = [
  "25/26",
  "24/25",
  "23/24",
  "22/23",
  "20/21",
  "17/18",
  "13/14",
] as const;
export type TeamSeason = (typeof TEAM_SEASONS)[number];

const SEASON_CLUB_OVERRIDES: Partial<Record<TeamSeason, Record<string, string[]>>> = {
  "25/26": CLUBS_2526,
  "24/25": CLUBS_2425,
};

/** League -> clubs for each season (promotion/relegation differs by year). */
export const SEASON_LEAGUE_CLUBS: Record<string, Record<string, string[]>> =
  Object.fromEntries(
    TEAM_SEASONS.map((s) => [s, SEASON_CLUB_OVERRIDES[s] ?? CLUBS_2425])
  );

/** Latest-season league -> clubs map (used by the pool picker's nested clubs). */
export const LEAGUE_CLUBS = CLUBS_2526;

/** A league team is a club in a specific season, e.g. "Arsenal (25/26)". */
export function teamLabel(club: string, season: string): string {
  return `${club} (${season})`;
}

export function parseTeamLabel(label: string): { club: string; season: string } {
  const m = label.match(/^(.+) \(([^)]+)\)$/);
  return m ? { club: m[1], season: m[2] } : { club: label, season: "" };
}

/** Group selected league teams by season for display. */
export function teamsBySeason(teams: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const t of teams) {
    const { club, season } = parseTeamLabel(t);
    if (!season) continue;
    (out[season] ??= []).push(club);
  }
  return out;
}

/** @deprecated use competitionTeams.ts */
export { WC_2026_NATIONS, UCL_2526_CLUBS } from "@/lib/competitionTeams";

function leagueTeams2526(league: string, count: number): string[] {
  return (CLUBS_2526[league] ?? []).slice(0, count).map((c) => teamLabel(c, "25/26"));
}

export const POOL_OPTIONS: Record<PoolKey, string[]> = {
  leagues: Object.keys(LEAGUE_CLUBS),
  seasons: ["25/26", "24/25", "23/24", "22/23", "20/21", "17/18", "13/14"],
  nations: [
    "England",
    "France",
    "Brazil",
    "Argentina",
    "Spain",
    "Germany",
    "Italy",
    "Portugal",
    "Netherlands",
    "Belgium",
    "Croatia",
    "USA",
    "Mexico",
    "Canada",
  ],
  clubs: Array.from(new Set(Object.values(LEAGUE_CLUBS).flat())),
};

export { emptyPoolFilter, emptyPoolRules };

export const BUILT_IN_PRESETS: Preset[] = [
  {
    name: "Premier League only",
    emblem: "prem38",
    description: "20-team league of the 25/26 Premier League clubs.",
    config: {
      name: "Premier League Only",
      numTeams: 20,
      tournamentType: "round_robin",
      teamSize: 11,
      pickCycleMode: "team",
      teams: leagueTeams2526("Premier League", 20),
      pool: {
        ...emptyPoolRules(),
        include: {
          ...emptyPoolFilter(),
          leagues: ["Premier League"],
          seasons: ["25/26"],
        },
      },
    },
  },
  {
    name: "English football pyramid",
    emblem: "england",
    description: "Five clubs from each tier of the English pyramid.",
    config: {
      name: "English Football Pyramid",
      numTeams: 20,
      tournamentType: "round_robin",
      teamSize: 11,
      pickCycleMode: "team",
      teams: [
        ...leagueTeams2526("Premier League", 5),
        ...leagueTeams2526("Championship", 5),
        ...leagueTeams2526("League One", 5),
        ...leagueTeams2526("League Two", 5),
      ],
      pool: {
        ...emptyPoolRules(),
        include: {
          ...emptyPoolFilter(),
          leagues: ["Premier League", "Championship", "League One", "League Two"],
          seasons: ["25/26"],
        },
      },
    },
  },
  {
    name: "UCL teams",
    emblem: "star",
    description: "Every 25/26 Champions League club in a knockout.",
    config: {
      name: "Champions League",
      numTeams: UCL_2526_CLUBS.length,
      tournamentType: "knockout",
      teamSize: 11,
      pickCycleMode: "team",
      teams: UCL_2526_CLUBS.map((c) => teamLabel(c, "25/26")),
      pool: {
        ...emptyPoolRules(),
        include: { ...emptyPoolFilter(), clubs: [...UCL_2526_CLUBS], seasons: ["25/26"] },
      },
    },
  },
  {
    name: "World Cup 26",
    emblem: "globe",
    description: "48 nations — roll a country each pick, then draft from its squad.",
    config: {
      name: "World Cup 26",
      numTeams: 48,
      tournamentType: "groups_knockout",
      teamSize: 11,
      pickCycleMode: "nation",
      teams: [],
      pool: {
        ...emptyPoolRules(),
        include: {
          ...emptyPoolFilter(),
          nations: [...WC_2026_NATIONS],
          seasons: ["25/26"],
        },
      },
    },
  },
  {
    name: "Rest of the world",
    emblem: "world",
    description: "Knockout draft from MLS, Saudi Pro League, and the Americas.",
    config: {
      name: "Rest of the World",
      numTeams: 16,
      tournamentType: "knockout",
      teamSize: 11,
      pickCycleMode: "team",
      teams: [],
      pool: {
        ...emptyPoolRules(),
        include: {
          ...emptyPoolFilter(),
          leagues: ["Saudi Pro League", "MLS"],
          nations: ["Brazil", "Argentina", "USA", "Mexico", "Canada"],
          seasons: ["25/26"],
        },
      },
    },
  },
];

const STORE_KEY = "draftoff:presets";

export function loadPresets(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Preset[]) : [];
  } catch {
    return [];
  }
}

export function savePreset(preset: Preset): Preset[] {
  const next = [
    ...loadPresets().filter((p) => p.name !== preset.name),
    preset,
  ];
  window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  return next;
}

export function deletePreset(name: string): Preset[] {
  const next = loadPresets().filter((p) => p.name !== name);
  window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  return next;
}
