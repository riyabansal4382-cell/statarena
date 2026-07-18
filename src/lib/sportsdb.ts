// TheSportsDB free API (test key "3" — public, no signup).
// Docs: https://www.thesportsdb.com/free_sports_api

const BASE = "https://www.thesportsdb.com/api/v1/json/3";

export type Sport = "Cricket" | "Tennis" | "F1";

export const SPORT_TO_DB: Record<Sport, string> = {
  Cricket: "Cricket",
  Tennis: "Tennis",
  F1: "Motorsport",
};

export type TeamHit = {
  kind: "team";
  id: string;
  name: string;
  sport: string;
  league?: string;
  country?: string;
  badge?: string;
  banner?: string;
  description?: string;
  formedYear?: string;
  stadium?: string;
  website?: string;
};

export type PlayerHit = {
  kind: "player";
  id: string;
  name: string;
  sport: string;
  team?: string;
  nationality?: string;
  position?: string;
  thumb?: string;
  cutout?: string;
  banner?: string;
  description?: string;
  birthDate?: string;
  birthLocation?: string;
  height?: string;
  weight?: string;
  status?: string;
};

export type Hit = TeamHit | PlayerHit;

export type EventItem = {
  id: string;
  name: string;
  date?: string;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: string;
  awayScore?: string;
  season?: string;
};

async function j(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Request failed: ${r.status}`);
  return r.json();
}

export async function searchAll(query: string, sport: Sport): Promise<Hit[]> {
  const q = query.trim();
  if (!q) return [];
  const dbSport = SPORT_TO_DB[sport];

  const [teamsRes, playersRes] = await Promise.all([
    j(`${BASE}/searchteams.php?t=${encodeURIComponent(q)}`).catch(() => ({ teams: null })),
    j(`${BASE}/searchplayers.php?p=${encodeURIComponent(q)}`).catch(() => ({ player: null })),
  ]);

  const teams: TeamHit[] = (teamsRes.teams ?? [])
    .filter((t: any) => t.strSport === dbSport)
    .map((t: any) => ({
      kind: "team" as const,
      id: t.idTeam,
      name: t.strTeam,
      sport: t.strSport,
      league: t.strLeague,
      country: t.strCountry,
      badge: t.strBadge || t.strTeamBadge,
      banner: t.strBanner || t.strTeamBanner,
      description: t.strDescriptionEN,
      formedYear: t.intFormedYear,
      stadium: t.strStadium,
      website: t.strWebsite,
    }));

  const players: PlayerHit[] = (playersRes.player ?? [])
    .filter((p: any) => p.strSport === dbSport)
    .map((p: any) => ({
      kind: "player" as const,
      id: p.idPlayer,
      name: p.strPlayer,
      sport: p.strSport,
      team: p.strTeam,
      nationality: p.strNationality,
      position: p.strPosition,
      thumb: p.strThumb || p.strCutout,
      cutout: p.strCutout,
      banner: p.strBanner,
      description: p.strDescriptionEN,
      birthDate: p.dateBorn,
      birthLocation: p.strBirthLocation,
      height: p.strHeight,
      weight: p.strWeight,
      status: p.strStatus,
    }));

  return [...players, ...teams];
}

export async function lastTeamEvents(teamId: string): Promise<EventItem[]> {
  const res = await j(`${BASE}/eventslast.php?id=${teamId}`).catch(() => ({ results: null }));
  return (res.results ?? []).map((e: any) => ({
    id: e.idEvent,
    name: e.strEvent,
    date: e.dateEvent,
    league: e.strLeague,
    homeTeam: e.strHomeTeam,
    awayTeam: e.strAwayTeam,
    homeScore: e.intHomeScore,
    awayScore: e.intAwayScore,
    season: e.strSeason,
  }));
}

export async function playerHonours(playerId: string): Promise<{ trophy?: string; season?: string; team?: string }[]> {
  const res = await j(`${BASE}/lookuphonours.php?id=${playerId}`).catch(() => ({ honours: null }));
  const items = (res.honours ?? []).map((h: any) => ({
    trophy: h.strHonour,
    season: h.strSeason,
    team: h.strTeam,
  }));
  // Sort present -> past by season (extract first 4-digit year for comparison)
  const yearOf = (s?: string) => {
    const m = s?.match(/\d{4}/);
    return m ? parseInt(m[0], 10) : -1;
  };
  items.sort((a: any, b: any) => yearOf(b.season) - yearOf(a.season));
  return items;
}
