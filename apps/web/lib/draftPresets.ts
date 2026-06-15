"use client";

import { emptyPoolFilter, emptyPoolRules } from "@draftoff/shared";
import type { LobbySettings, PoolFilter } from "@draftoff/shared";

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
 * Clubs grouped under their league. Including a league cascades to every club
 * here; excluding does the same. Curated placeholder data until the real player
 * pool is seeded from the CSV.
 */
export const LEAGUE_CLUBS: Record<string, string[]> = {
  "Premier League": [
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
  ],
  Championship: [
    "Leeds United",
    "Burnley",
    "Sheffield United",
    "Sunderland",
    "West Bromwich Albion",
    "Watford",
    "Middlesbrough",
    "Coventry City",
  ],
  "League One": ["Birmingham City", "Wrexham", "Bolton Wanderers", "Huddersfield Town"],
  "League Two": ["Notts County", "MK Dons", "Bradford City", "Port Vale"],
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

export const POOL_OPTIONS: Record<PoolKey, string[]> = {
  leagues: Object.keys(LEAGUE_CLUBS),
  seasons: ["FC 26", "FC 25", "FC 24", "FIFA 23", "FIFA 21", "FIFA 18", "FIFA 14"],
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
    description: "Draft only from the 20 Premier League clubs.",
    config: {
      teamSize: 11,
      draftTimerSeconds: 30,
      tournamentType: "knockout",
      peakCardsEnabled: true,
      pool: {
        ...emptyPoolRules(),
        include: {
          ...emptyPoolFilter(),
          leagues: ["Premier League"],
        },
      },
    },
  },
  {
    name: "English football pyramid",
    emblem: "england",
    description:
      "Draft players from across all four leagues of the English league pyramid.",
    config: {
      teamSize: 11,
      draftTimerSeconds: 30,
      tournamentType: "knockout",
      peakCardsEnabled: true,
      pool: {
        ...emptyPoolRules(),
        include: {
          ...emptyPoolFilter(),
          leagues: ["Premier League", "Championship", "League One", "League Two"],
        },
      },
    },
  },
  {
    name: "UCL teams",
    emblem: "star",
    description:
      "Make a draft with players from all the teams that have qualified for the Champions League.",
    config: {
      teamSize: 11,
      draftTimerSeconds: 30,
      tournamentType: "knockout",
      peakCardsEnabled: true,
      pool: {
        ...emptyPoolRules(),
        include: {
          ...emptyPoolFilter(),
          clubs: [
            "Real Madrid",
            "Barcelona",
            "Manchester City",
            "Liverpool",
            "Bayern Munich",
            "Paris Saint-Germain",
            "Inter",
            "Borussia Dortmund",
          ],
        },
      },
    },
  },
  {
    name: "World Cup 26",
    emblem: "globe",
    description: "Draft from the nations heading to the 2026 World Cup",
    config: {
      teamSize: 11,
      draftTimerSeconds: 30,
      tournamentType: "knockout",
      peakCardsEnabled: true,
      pool: {
        ...emptyPoolRules(),
        include: {
          ...emptyPoolFilter(),
          nations: [
            "England",
            "France",
            "Brazil",
            "Argentina",
            "Spain",
            "Germany",
            "Portugal",
            "USA",
            "Mexico",
            "Canada",
          ],
        },
      },
    },
  },
  {
    name: "Rest of the world",
    emblem: "world",
    description: "Draft from clubs and nations outside Europe.",
    config: {
      teamSize: 11,
      draftTimerSeconds: 30,
      tournamentType: "knockout",
      peakCardsEnabled: true,
      pool: {
        ...emptyPoolRules(),
        include: {
          ...emptyPoolFilter(),
          leagues: ["Saudi Pro League", "MLS"],
          nations: ["Brazil", "Argentina", "USA", "Mexico", "Canada"],
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
