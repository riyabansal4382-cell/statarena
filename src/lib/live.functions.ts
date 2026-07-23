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
  team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string; logo?: string };
};

type EspnEvent = {
  id: string;
  name: string;
  shortName?: string;
  date: string;
  status?: {
    type?: { description?: string; state?: string; shortDetail?: string; detail?: string };
  };
  competitions?: {
    competitors?: EspnCompetitor[];
    notes?: { headline?: string }[];
  }[];
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

function normalize(ev: EspnEvent, league: string): LiveScore {
  const comp = ev.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  const type = ev.status?.type;
  return {
    id: ev.id,
    league,
    status: type?.description ?? "",
    state: type?.state ?? "",
    date: ev.date,
    detail: type?.detail,
    shortDetail: type?.shortDetail,
    home: {
      name: home?.team?.displayName ?? "TBD",
      short: home?.team?.shortDisplayName ?? home?.team?.abbreviation,
      score: home?.score,
      logo: home?.team?.logo,
    },
    away: {
      name: away?.team?.displayName ?? "TBD",
      short: away?.team?.shortDisplayName ?? away?.team?.abbreviation,
      score: away?.score,
      logo: away?.team?.logo,
    },
    note: comp?.notes?.[0]?.headline,
    link: ev.links?.[0]?.href,
  };
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
        return evs.map((e) => normalize(e, p.split("/")[1]?.toUpperCase() || data.sport));
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
