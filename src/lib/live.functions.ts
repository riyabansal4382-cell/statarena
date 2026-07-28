import { createServerFn } from "@tanstack/react-start";
import type { Sport } from "./sportsdb";

export type LiveScore = {
  id: string;
  league: string;
  status: string; // e.g. "In Progress", "Final", "Scheduled", "45'"
  state: "pre" | "in" | "post" | string;
  date: string;
  detail?: string;
  shortDetail?: string;
  home: { name: string; short?: string; score?: string; logo?: string };
  away: { name: string; short?: string; score?: string; logo?: string };
  note?: string;
  link?: string;
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string; logo?: string };
  athlete?: {
    displayName?: string;
    shortName?: string;
    fullName?: string;
    flag?: { href?: string };
  };
  linescores?: { value?: number }[];
};

type EspnCompetition = {
  status?: {
    type?: { description?: string; state?: string; shortDetail?: string; detail?: string };
  };
  competitors?: EspnCompetitor[];
  notes?: { headline?: string; text?: string }[];
};

type EspnEvent = {
  id: string;
  name: string;
  shortName?: string;
  date: string;
  status?: {
    type?: { description?: string; state?: string; shortDetail?: string; detail?: string };
  };
  competitions?: EspnCompetition[];
  groupings?: { competitions?: EspnCompetition[] }[];
  links?: { href?: string }[];
};

const ESPN_PATHS: Record<Sport, string[]> = {
  Football: ["soccer/all"],
  Cricket: ["cricket/all"],
  Tennis: ["tennis/atp", "tennis/wta"],
  F1: ["racing/f1"],
};

async function fetchEspn(path: string): Promise<EspnEvent[]> {
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { events?: EspnEvent[] };
    return j.events ?? [];
  } catch {
    return [];
  }
}

function competitorName(c: EspnCompetitor | undefined): string {
  return (
    c?.team?.displayName ??
    c?.athlete?.displayName ??
    c?.athlete?.fullName ??
    c?.athlete?.shortName ??
    "TBD"
  );
}

function competitorShort(c: EspnCompetitor | undefined): string | undefined {
  return (
    c?.team?.shortDisplayName ??
    c?.team?.abbreviation ??
    c?.athlete?.shortName
  );
}

function competitorScore(c: EspnCompetitor | undefined): string | undefined {
  if (c?.score) return c.score;
  const ls = c?.linescores;
  if (ls && ls.length) return ls.map((s) => s.value ?? 0).join(" ");
  return undefined;
}

function competitorLogo(c: EspnCompetitor | undefined): string | undefined {
  return c?.team?.logo ?? c?.athlete?.flag?.href;
}

function normalizeCompetition(
  ev: EspnEvent,
  comp: EspnCompetition,
  league: string,
  idSuffix = "",
): LiveScore {
  const competitors = comp.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  const type = comp.status?.type ?? ev.status?.type;
  const noteRaw = comp.notes?.[0];
  return {
    id: ev.id + idSuffix,
    league,
    status: type?.description ?? "",
    state: type?.state ?? "",
    date: ev.date,
    detail: type?.detail,
    shortDetail: type?.shortDetail,
    home: {
      name: competitorName(home),
      short: competitorShort(home),
      score: competitorScore(home),
      logo: competitorLogo(home),
    },
    away: {
      name: competitorName(away),
      short: competitorShort(away),
      score: competitorScore(away),
      logo: competitorLogo(away),
    },
    note: noteRaw?.headline ?? noteRaw?.text,
    link: ev.links?.[0]?.href,
  };
}

function normalizeEvent(ev: EspnEvent, league: string): LiveScore[] {
  const grouped = ev.groupings?.flatMap((g) => g.competitions ?? []) ?? [];
  if (grouped.length) {
    return grouped.map((c, i) => normalizeCompetition(ev, c, league, `-${i}`));
  }
  const comp = ev.competitions?.[0];
  if (!comp) return [];
  return [normalizeCompetition(ev, comp, league)];
}

export const getLiveScores = createServerFn({ method: "GET" })
  .inputValidator((input: { sport: Sport }) => {
    if (!input?.sport) throw new Error("sport required");
    return input;
  })
  .handler(async ({ data }) => {
    const paths = ESPN_PATHS[data.sport] ?? [];
    const results = await Promise.all(
      paths.map(async (p) => {
        const evs = await fetchEspn(p);
        return evs.flatMap((e) => normalizeEvent(e, p.split("/")[1]?.toUpperCase() || data.sport));
      }),
    );
    const all = results.flat();
    // Order: live first, then scheduled (soonest), then finished (most recent)
    const rank = (s: LiveScore) => (s.state === "in" ? 0 : s.state === "pre" ? 1 : 2);
    all.sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return a.date.localeCompare(b.date);
    });
    return { fetchedAt: new Date().toISOString(), events: all.slice(0, 40) };
  });
