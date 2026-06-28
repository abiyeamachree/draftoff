import { WC_2026_NATIONS } from "@/lib/competitionTeams";

/** Home-kit primary colour for WC 2026 nations (fixture gradients). */
export const NATION_KIT_PRIMARY: Record<(typeof WC_2026_NATIONS)[number], string> = {
  // AFC
  Australia: "#FFD100",
  Iran: "#239F40",
  Iraq: "#007A33",
  Japan: "#00209F",
  Jordan: "#007A3D",
  Qatar: "#8A1538",
  "Saudi Arabia": "#006C35",
  "South Korea": "#CD2E3A",
  Uzbekistan: "#1EB3E8",
  // CAF
  Algeria: "#007847",
  "Cape Verde": "#003893",
  "DR Congo": "#007FFF",
  Egypt: "#CE1126",
  Ghana: "#006B3F",
  "Ivory Coast": "#FF8200",
  Morocco: "#C1272D",
  Senegal: "#00853F",
  "South Africa": "#FFB612",
  Tunisia: "#E70013",
  // CONCACAF
  Canada: "#FF0000",
  Curaçao: "#002395",
  Haiti: "#00209F",
  Mexico: "#006847",
  Panama: "#DA121A",
  "United States": "#002868",
  // CONMEBOL
  Argentina: "#75AADB",
  Brazil: "#FFDF00",
  Colombia: "#FCD116",
  Ecuador: "#FFD100",
  Paraguay: "#D52B1E",
  Uruguay: "#55AAEE",
  // OFC
  "New Zealand": "#000000",
  // UEFA
  Austria: "#ED1C24",
  Belgium: "#ED1C24",
  "Bosnia and Herzegovina": "#002395",
  Croatia: "#FF0000",
  "Czech Republic": "#11457E",
  England: "#CF142B",
  France: "#002395",
  Germany: "#000000",
  Netherlands: "#FF6600",
  Norway: "#EF2B2D",
  Portugal: "#FF0000",
  Scotland: "#003876",
  Spain: "#AA151B",
  Sweden: "#FFCD00",
  Switzerland: "#FF0000",
  Turkey: "#E30A17",
};

const ALIASES: Record<string, (typeof WC_2026_NATIONS)[number]> = {
  "Congo DR": "DR Congo",
  Czechia: "Czech Republic",
  Türkiye: "Turkey",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
};

const FALLBACK = "#1E3A5F";

export function nationPrimaryColor(nation: string): string {
  const trimmed = nation.trim();
  const key = (ALIASES[trimmed] ?? trimmed) as (typeof WC_2026_NATIONS)[number];
  return NATION_KIT_PRIMARY[key] ?? FALLBACK;
}
