const API_BASE = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

export type TeamTag = "ucl" | "uel" | "uecl" | "promoted" | "relegated";

export interface CatalogTeam {
  team: string;
  league: string;
  edition: string;
  season: string;
  label: string;
  tags: TeamTag[];
}

export interface CatalogSeason {
  edition: string;
  season: string;
  playerCount: number;
}

export interface CatalogNation {
  nation: string;
  playerCount: number;
}

export const TAG_LABELS: Record<TeamTag, string> = {
  ucl: "UCL",
  uel: "Europa",
  uecl: "Conference",
  promoted: "↑",
  relegated: "↓",
};

export async function fetchSeasons(): Promise<CatalogSeason[]> {
  const res = await fetch(`${API_BASE}/api/catalog/seasons`);
  if (!res.ok) throw new Error("Failed to load seasons");
  return res.json();
}

export async function fetchNations(season: string): Promise<CatalogNation[]> {
  const res = await fetch(`${API_BASE}/api/catalog/nations?season=${encodeURIComponent(season)}`);
  if (!res.ok) throw new Error("Failed to load nations");
  const data = (await res.json()) as { nations: CatalogNation[] };
  return data.nations;
}

export async function fetchLeagues(season: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/catalog/leagues?season=${encodeURIComponent(season)}`);
  if (!res.ok) throw new Error("Failed to load leagues");
  const data = (await res.json()) as { leagues: string[] };
  return data.leagues;
}

export async function fetchTeams(
  season: string,
  opts?: { league?: string; tag?: TeamTag }
): Promise<CatalogTeam[]> {
  const params = new URLSearchParams({ season });
  if (opts?.league) params.set("league", opts.league);
  if (opts?.tag) params.set("tag", opts.tag);
  const res = await fetch(`${API_BASE}/api/catalog/teams?${params}`);
  if (!res.ok) throw new Error("Failed to load teams");
  const data = (await res.json()) as { teams: CatalogTeam[] };
  return data.teams;
}
