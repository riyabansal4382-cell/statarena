import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  searchAll,
  lastTeamEvents,
  playerHonours,
  type Sport,
  type Hit,
  type TeamHit,
  type PlayerHit,
} from "@/lib/sportsdb";
import {
  analyzeEntity,
  compareEntities,
  entityStats,
  analyzeEvent,
  majorWins,
  liveInsight,
  f1LiveGrid,
  deepStats,
  standings,
  type AiAnalysis,
  type Comparison,
  type EntityStats,
  type EventAnalysis,
  type MajorWins,
  type LiveInsight,
  type F1LiveGrid,
  type DeepStats,
  type Standings,
} from "@/lib/ai.functions";
import { getLiveScores, type LiveScore } from "@/lib/live.functions";

const LEAGUES: Record<Sport, string[]> = {
  Cricket: ["IPL 2025", "ICC Test Championship 2025-27", "ICC ODI Rankings 2026", "The Hundred 2025"],
  Tennis: ["ATP Rankings 2026", "WTA Rankings 2026", "ATP Race to Turin 2026", "WTA Race 2026"],
  F1: ["F1 Drivers' Championship 2026", "F1 Constructors' Championship 2026", "F1 Drivers' Championship 2025"],
  Football: ["Premier League 2025-26", "La Liga 2025-26", "Serie A 2025-26", "UEFA Champions League 2025-26", "Bundesliga 2025-26"],
};

export const Route = createFileRoute("/")({
  component: Index,
});

const SPORTS: { key: Sport; label: string; emoji: string }[] = [
  { key: "Cricket", label: "Cricket", emoji: "🏏" },
  { key: "Tennis", label: "Tennis", emoji: "🎾" },
  { key: "F1", label: "Formula 1", emoji: "🏎️" },
  { key: "Football", label: "Football", emoji: "⚽" },
];

const SUGGESTIONS: Record<Sport, string[]> = {
  Cricket: ["India", "Mumbai Indians", "Virat Kohli", "Ben Stokes"],
  Tennis: ["Novak Djokovic", "Carlos Alcaraz", "Iga Swiatek", "Serena Williams"],
  F1: ["Lewis Hamilton", "Max Verstappen", "Ferrari", "McLaren"],
  Football: ["Lionel Messi", "Kylian Mbappé", "Real Madrid", "Manchester City"],
};

const EVENT_SUGGESTIONS: Record<Sport, string[]> = {
  Cricket: ["IPL 2025", "ICC T20 World Cup 2024", "The Ashes 2023", "Cricket World Cup 2023"],
  Tennis: ["Wimbledon 2025", "US Open 2025", "Australian Open 2026", "Roland Garros 2025"],
  F1: ["Monaco GP 2025", "British GP 2025", "Abu Dhabi GP 2025", "Bahrain GP 2026"],
  Football: ["FIFA World Cup 2022", "UEFA Champions League 2024-25", "Euro 2024", "Copa America 2024"],
};

// Rough heuristic: does this query look like an event name?
const EVENT_HINTS = /\b(cup|open|championship|series|league|grand prix|gp|final|test|masters|ashes|olympi|world|trophy|ipl|bbl|psl|t20|odi|slam|wimbledon|roland|20\d\d)\b/i;

type Mode = "explore" | "compare" | "live" | "standings";

function Index() {
  const [mode, setMode] = useState<Mode>("explore");
  const [sport, setSport] = useState<Sport>("Cricket");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [slotA, setSlotA] = useState<Hit | null>(null);
  const [slotB, setSlotB] = useState<Hit | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("theme")) as
      | "dark"
      | "light"
      | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);


  // Debounce input -> query for autocomplete
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 220);
    return () => clearTimeout(t);
  }, [input]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const { data, isFetching, error } = useQuery({
    queryKey: ["search", sport, query],
    queryFn: () => searchAll(query, sport),
    enabled: query.length > 1,
    staleTime: 60_000,
  });

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setQuery(input.trim());
    setShowSuggest(false);
  };

  const quick = (q: string) => {
    setInput(q);
    setQuery(q);
    setShowSuggest(false);
  };

  const pickResult = (h: Hit) => {
    if (mode === "explore") {
      setSelected(h);
      return;
    }
    if (!slotA) setSlotA(h);
    else if (!slotB && h.id !== slotA.id) setSlotB(h);
    else setSlotA(h);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <header className="mb-8 text-center relative">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="absolute right-0 top-0 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary transition"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            StatArena · AI sports intel
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
            Every <span className="text-primary">stat</span>. Every{" "}
            <span className="text-accent">story</span>.
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Explore Cricket, Tennis, F1, and Football — or compare two teams / players head to head with AI.
          </p>
        </header>

        <div className="mx-auto mb-6 flex w-fit flex-wrap justify-center rounded-full border border-border bg-card p-1">
          {(["explore", "compare", "live", "standings"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setSelected(null);
                setSelectedEvent(null);
              }}
              className={`rounded-full px-5 py-1.5 text-sm font-medium capitalize transition ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "compare" ? "⚔ Compare" : m === "live" ? "🔴 Live" : m === "standings" ? "📊 Standings" : "🔎 Explore"}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSport(s.key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                sport === s.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              }`}
            >
              <span className="mr-1">{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>

        {mode === "compare" && (
          <CompareSlots
            slotA={slotA}
            slotB={slotB}
            onClearA={() => setSlotA(null)}
            onClearB={() => setSlotB(null)}
            onSwap={() => {
              setSlotA(slotB);
              setSlotB(slotA);
            }}
          />
        )}

        {mode !== "live" && mode !== "standings" && (
        <>
        <form onSubmit={submit} className="mx-auto max-w-2xl">
          <div ref={boxRef} className="relative flex gap-2">
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              placeholder={
                mode === "compare"
                  ? `Search ${sport} — add to ${slotA ? "slot B" : "slot A"}...`
                  : `Search ${sport} — team or player...`
              }
              className="flex-1 rounded-xl border border-border bg-card px-5 py-4 text-base outline-none ring-primary/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2"
              autoComplete="off"
            />
            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Search
            </button>

            {showSuggest && input.trim().length > 1 && (
              <div className="absolute left-0 right-24 top-full z-20 mt-2 max-h-80 overflow-auto rounded-xl border border-border bg-card shadow-xl">
                {isFetching && (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>
                )}
                {!isFetching && data && data.length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No {sport} matches for "{input}".
                  </div>
                )}
                {data?.slice(0, 8).map((h) => {
                  const img = h.kind === "team" ? h.badge : h.thumb;
                  const sub =
                    h.kind === "team"
                      ? [h.league, h.country].filter(Boolean).join(" · ")
                      : [h.team, h.nationality].filter(Boolean).join(" · ");
                  return (
                    <button
                      key={`${h.kind}-${h.id}`}
                      type="button"
                      onClick={() => {
                        setInput(h.name);
                        setShowSuggest(false);
                        pickResult(h);
                      }}
                      className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2 text-left last:border-b-0 hover:bg-secondary/50"
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-secondary">
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm">
                            {h.kind === "team" ? "🛡️" : "👤"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{h.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{sub}</p>
                      </div>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {h.kind}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        <div className="mx-auto mt-3 flex max-w-2xl flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Players/teams:</span>
          {SUGGESTIONS[sport].map((s) => (
            <button
              key={s}
              onClick={() => quick(s)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mx-auto mt-2 flex max-w-2xl flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Events:</span>
          {EVENT_SUGGESTIONS[sport].map((s) => (
            <button
              key={s}
              onClick={() => {
                setInput(s);
                setQuery(s);
                setShowSuggest(false);
                if (mode === "explore") {
                  setSelected(null);
                  setSelectedEvent(s);
                }
              }}
              className="rounded-full border border-accent/40 px-3 py-1 text-xs text-accent/90 hover:border-accent hover:text-accent"
            >
              🏆 {s}
            </button>
          ))}
        </div>
        </>
        )}

        <section className="mt-10">
          {error && (
            <p className="text-center text-destructive">
              Couldn't reach the sports database. Try again.
            </p>
          )}
          {isFetching && (
            <p className="text-center text-muted-foreground">Searching {sport}…</p>
          )}

          {mode === "live" ? (
            <LiveScoresView sport={sport} />
          ) : mode === "standings" ? (
            <StandingsView sport={sport} />
          ) : mode === "explore" ? (
            selectedEvent ? (
              <EventDetail
                sport={sport}
                name={selectedEvent}
                onBack={() => setSelectedEvent(null)}
              />
            ) : selected ? (
              <Detail hit={selected} onBack={() => setSelected(null)} />
            ) : (
              <>
                {query.length > 1 && EVENT_HINTS.test(query) && (
                  <button
                    onClick={() => setSelectedEvent(query)}
                    className="mb-3 flex w-full items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4 text-left transition hover:border-accent"
                  >
                    <span className="text-2xl">🏆</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-widest text-accent">
                        Event · AI dossier
                      </p>
                      <p className="truncate font-semibold">
                        Analyze "{query}" as a {sport} event
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">→</span>
                  </button>
                )}
                {!isFetching && query && data && data.length === 0 && (
                  <p className="mb-3 text-center text-muted-foreground">
                    No player/team results for "{query}". Try an event above.
                  </p>
                )}
                <ResultsGrid data={data} onPick={pickResult} />
              </>
            )
          ) : (
            <>
              {slotA && slotB ? (
                <CompareView a={slotA} b={slotB} sport={sport} />
              ) : (
                <ResultsGrid data={data} onPick={pickResult} pickerHint />
              )}
            </>
          )}
        </section>


        <footer className="mt-16 text-center text-xs text-muted-foreground">
          Data: TheSportsDB · Analysis: Lovable AI · For informational use.
        </footer>
      </div>
    </main>
  );
}

function ResultsGrid({
  data,
  onPick,
  pickerHint,
}: {
  data: Hit[] | undefined;
  onPick: (h: Hit) => void;
  pickerHint?: boolean;
}) {
  if (!data || data.length === 0) return null;
  return (
    <>
      {pickerHint && (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          Tap a result to add it to a compare slot.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((h) => (
          <ResultCard key={`${h.kind}-${h.id}`} hit={h} onOpen={() => onPick(h)} />
        ))}
      </div>
    </>
  );
}

function CompareSlots({
  slotA,
  slotB,
  onClearA,
  onClearB,
  onSwap,
}: {
  slotA: Hit | null;
  slotB: Hit | null;
  onClearA: () => void;
  onClearB: () => void;
  onSwap: () => void;
}) {
  return (
    <div className="mx-auto mb-6 grid max-w-3xl gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <Slot label="A" hit={slotA} onClear={onClearA} tone="primary" />
      <button
        onClick={onSwap}
        disabled={!slotA || !slotB}
        className="mx-auto rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground disabled:opacity-40 hover:border-primary/40 hover:text-foreground"
      >
        ⇄ swap
      </button>
      <Slot label="B" hit={slotB} onClear={onClearB} tone="accent" />
    </div>
  );
}

function Slot({
  label,
  hit,
  onClear,
  tone,
}: {
  label: string;
  hit: Hit | null;
  onClear: () => void;
  tone: "primary" | "accent";
}) {
  const ring = tone === "primary" ? "border-primary/50" : "border-accent/50";
  if (!hit) {
    return (
      <div className={`flex items-center justify-center rounded-xl border-2 border-dashed ${ring} bg-card/40 px-4 py-3 text-sm text-muted-foreground`}>
        Slot {label} — pick from results
      </div>
    );
  }
  const img = hit.kind === "team" ? hit.badge : hit.thumb;
  return (
    <div className={`flex items-center gap-3 rounded-xl border ${ring} bg-card px-3 py-2`}>
      <span className={`text-xs font-bold ${tone === "primary" ? "text-primary" : "text-accent"}`}>{label}</span>
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-secondary">
        {img && <img src={img} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{hit.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {hit.kind === "team" ? hit.league : hit.team ?? hit.nationality}
        </p>
      </div>
      <button
        onClick={onClear}
        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
      >
        ✕
      </button>
    </div>
  );
}

function ResultCard({ hit, onOpen }: { hit: Hit; onOpen: () => void }) {
  const img = hit.kind === "team" ? hit.badge : hit.thumb;
  const sub =
    hit.kind === "team"
      ? [hit.league, hit.country].filter(Boolean).join(" · ")
      : [hit.team, hit.nationality].filter(Boolean).join(" · ");
  return (
    <button
      onClick={onOpen}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50"
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
        {img ? (
          <img src={img} alt={hit.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl">{hit.kind === "team" ? "🛡️" : "👤"}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {hit.kind}
          </span>
          <span className="truncate font-semibold group-hover:text-primary">{hit.name}</span>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{sub || hit.sport}</p>
      </div>
    </button>
  );
}

function Detail({ hit, onBack }: { hit: Hit; onBack: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <button
        onClick={onBack}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to results
      </button>
      {hit.kind === "team" ? <TeamDetail team={hit} /> : <PlayerDetail player={hit} />}
    </div>
  );
}

function useAiAnalysis(hit: Hit) {
  const analyze = useServerFn(analyzeEntity);
  return useQuery({
    queryKey: ["ai-analysis", hit.kind, hit.id],
    queryFn: () =>
      analyze({
        data: {
          kind: hit.kind,
          name: hit.name,
          sport: hit.sport,
          team: hit.kind === "player" ? hit.team : undefined,
          nationality: hit.kind === "player" ? hit.nationality : hit.country,
          description: hit.description,
        },
      }),
    staleTime: 10 * 60_000,
    retry: 0,
  });
}

function AiPanel({ hit }: { hit: Hit }) {
  const { data, isLoading, error } = useAiAnalysis(hit);
  return (
    <div className="mt-6 rounded-xl border border-primary/40 bg-background/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
          AI estimate
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Strengths & Weaknesses
        </h3>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Analyzing with AI…</p>}
      {error && (
        <p className="text-sm text-destructive">
          {(error as Error).message || "AI analysis failed."}
        </p>
      )}
      {data && (
        <div className="space-y-4">
          {data.summary && (
            <p className="text-sm leading-relaxed text-foreground/90">{data.summary}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                What's good
              </p>
              <ul className="space-y-1 text-sm">
                {data.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">▲</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">
                Where they struggle
              </p>
              <ul className="space-y-1 text-sm">
                {data.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">▼</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamDetail({ team }: { team: TeamHit }) {
  const { data: events } = useQuery({
    queryKey: ["team-events", team.id],
    queryFn: () => lastTeamEvents(team.id),
    staleTime: 60_000,
  });

  // Sort recent events present -> past
  const sortedEvents = (events ?? [])
    .slice()
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <div>
      {team.banner && (
        <div className="mb-4 h-40 w-full overflow-hidden rounded-xl">
          <img src={team.banner} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-start gap-4">
        {team.badge && (
          <img src={team.badge} alt="" className="h-20 w-20 rounded-lg bg-secondary object-contain p-2" />
        )}
        <div>
          <h2 className="text-2xl font-bold">{team.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[team.league, team.country, team.formedYear && `est. ${team.formedYear}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {team.stadium && (
            <p className="mt-1 text-sm text-muted-foreground">🏟 {team.stadium}</p>
          )}
        </div>
      </div>

      {team.description && (
        <div className="mt-6 rounded-xl border border-border bg-background/40 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            History
          </h3>
          <p className="text-sm leading-relaxed text-foreground/90">{team.description}</p>
        </div>
      )}

      <AiPanel hit={team} />
      <DeepStatsPanel hit={team} />
      <StatsCharts hit={team} />

      {sortedEvents.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent form (present → past)
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {sortedEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[e.league, e.date].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {(e.homeScore || e.awayScore) && (
                  <span className="rounded bg-secondary px-2 py-1 font-mono text-xs">
                    {e.homeScore ?? "-"} : {e.awayScore ?? "-"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TIER_STYLE: Record<string, string> = {
  legendary: "border-tier-legendary-border bg-tier-legendary-bg text-tier-legendary-text",
  major: "border-tier-major-border bg-tier-major-bg text-tier-major-text",
  notable: "border-tier-notable-border bg-tier-notable-bg text-tier-notable-text",
};

function MajorWinsPanel({ player }: { player: PlayerHit }) {
  const fetchWins = useServerFn(majorWins);
  const { data, isLoading, isError, refetch, isFetching } = useQuery<MajorWins>({
    queryKey: ["major-wins", player.id, player.sport],
    queryFn: () =>
      fetchWins({
        data: {
          kind: "player",
          name: player.name,
          sport: player.sport,
          team: player.team,
          nationality: player.nationality,
          description: player.description,
        },
      }),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="mt-6 rounded-xl border border-border bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          🏆 Career-defining wins {data?.category ? `· ${data.category}` : ""} <AiEstimate />
        </h3>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/60"
          disabled={isFetching}
        >
          {isFetching ? "…" : "Regenerate"}
        </button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Compiling their biggest wins…</p>}
      {isError && <p className="text-sm text-destructive">Couldn't load wins.</p>}
      {data && data.wins.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No major titles on record for this player as of July 2026.
        </p>
      )}
      {data && data.wins.length > 0 && (
        <ol className="grid gap-2 sm:grid-cols-2">
          {data.wins.map((w, i) => (
            <li
              key={i}
              className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${TIER_STYLE[w.tier ?? "major"]}`}
            >
              <div className="min-w-0">
                <div className="font-semibold">
                  {w.tier === "legendary" ? "👑" : "🏆"} {w.title}
                </div>
                {w.detail && (
                  <div className="mt-0.5 text-xs opacity-80 truncate">{w.detail}</div>
                )}
              </div>
              <span className="shrink-0 rounded-md bg-background/50 px-2 py-0.5 text-xs font-mono">
                {w.year}
              </span>
            </li>
          ))}
        </ol>
      )}
      {data?.notes && (
        <p className="mt-3 text-[11px] italic text-muted-foreground">{data.notes}</p>
      )}
    </div>
  );
}

function PlayerDetail({ player }: { player: PlayerHit }) {
  const { data: honours } = useQuery({
    queryKey: ["honours", player.id],
    queryFn: () => playerHonours(player.id),
    staleTime: 60_000,
  });

  return (
    <div>
      {player.banner && (
        <div className="mb-4 h-40 w-full overflow-hidden rounded-xl">
          <img src={player.banner} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-start gap-4">
        {player.thumb && (
          <img src={player.thumb} alt="" className="h-24 w-24 rounded-lg bg-secondary object-cover" />
        )}
        <div>
          <h2 className="text-2xl font-bold">{player.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[player.team, player.position, player.nationality].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[
              player.birthDate && `Born ${player.birthDate}`,
              player.birthLocation,
              player.height,
              player.status,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {player.description && (
        <div className="mt-6 rounded-xl border border-border bg-background/40 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            History
          </h3>
          <p className="text-sm leading-relaxed text-foreground/90">{player.description}</p>
        </div>
      )}

      <AiPanel hit={player} />
      <MajorWinsPanel player={player} />
      <DeepStatsPanel hit={player} />

      <StatsCharts hit={player} />

      {honours && honours.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Achievements (present → past)
          </h3>
          <ol className="grid gap-2 sm:grid-cols-2">
            {honours.map((h, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">🏆 {h.trophy}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {[h.season, h.team].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function CompareView({ a, b, sport }: { a: Hit; b: Hit; sport: Sport }) {
  const compareFn = useServerFn(compareEntities);
  const mutation = useMutation({
    mutationFn: () =>
      compareFn({
        data: {
          sport,
          a: {
            kind: a.kind,
            name: a.name,
            sport: a.sport,
            team: a.kind === "player" ? a.team : undefined,
            nationality: a.kind === "player" ? a.nationality : a.country,
            description: a.description,
          },
          b: {
            kind: b.kind,
            name: b.name,
            sport: b.sport,
            team: b.kind === "player" ? b.team : undefined,
            nationality: b.kind === "player" ? b.nationality : b.country,
            description: b.description,
          },
        },
      }),
  });

  // auto run on entry
  useEffect(() => {
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, b.id]);

  const c = mutation.data as Comparison | undefined;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <SideCard hit={a} tone="primary" />
        <SideCard hit={b} tone="accent" />
      </div>

      <div className="mt-6 rounded-xl border border-primary/40 bg-background/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              AI estimate
            </span>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Head-to-head analysis
            </h3>
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-40"
          >
            {mutation.isPending ? "Analyzing…" : "Re-run"}
          </button>
        </div>

        {mutation.isPending && (
          <p className="text-sm text-muted-foreground">Comparing with AI…</p>
        )}
        {mutation.error && (
          <p className="text-sm text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}

        {c && (
          <div className="space-y-5">
            {c.verdict && (
              <p className="text-sm leading-relaxed text-foreground/90">{c.verdict}</p>
            )}

            {c.categories.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[1fr_2fr_2fr] bg-secondary/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Category</span>
                  <span className="text-primary">{a.name}</span>
                  <span className="text-accent">{b.name}</span>
                </div>
                {c.categories.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_2fr_2fr] border-t border-border px-3 py-2 text-sm"
                  >
                    <span className="pr-2 text-xs font-medium text-muted-foreground">
                      {row.label}
                    </span>
                    <span
                      className={
                        row.edge === "a"
                          ? "font-semibold text-primary"
                          : "text-foreground/80"
                      }
                    >
                      {row.a}
                    </span>
                    <span
                      className={
                        row.edge === "b"
                          ? "font-semibold text-accent"
                          : "text-foreground/80"
                      }
                    >
                      {row.b}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <EdgeList title={`${a.name} edges`} items={c.aEdge} tone="primary" />
              <EdgeList title={`${b.name} edges`} items={c.bEdge} tone="accent" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SideCard({ hit, tone }: { hit: Hit; tone: "primary" | "accent" }) {
  const img = hit.kind === "team" ? hit.badge : hit.thumb;
  const border = tone === "primary" ? "border-primary/50" : "border-accent/50";
  const badgeCls =
    tone === "primary" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent";
  return (
    <div className={`rounded-xl border ${border} bg-background/40 p-4`}>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
          {img && <img src={img} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeCls}`}>
            {hit.kind}
          </span>
          <p className="mt-1 truncate font-semibold">{hit.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {hit.kind === "team"
              ? [hit.league, hit.country].filter(Boolean).join(" · ")
              : [hit.team, hit.nationality].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}

function EdgeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "primary" | "accent";
}) {
  const c = tone === "primary" ? "text-primary" : "text-accent";
  return (
    <div>
      <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${c}`}>{title}</p>
      <ul className="space-y-1 text-sm">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={c}>▲</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Unified bright palette used across all charts (line and bar) so colors pop on dark backgrounds.
const CHART_COLORS = [
  "#FF3366", // bright pink
  "#00CCFF", // bright cyan
  "#FFCC00", // bright yellow
  "#00FF99", // bright green
  "#CC66FF", // bright purple
  "#FF6633", // bright orange
];

const EVENT_CHART_COLORS = CHART_COLORS;

function StatsCharts({ hit }: { hit: Hit }) {
  const statsFn = useServerFn(entityStats);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["entity-stats", hit.kind, hit.id],
    queryFn: () =>
      statsFn({
        data: {
          kind: hit.kind,
          name: hit.name,
          sport: hit.sport,
          team: hit.kind === "player" ? hit.team : undefined,
          nationality: hit.kind === "player" ? hit.nationality : hit.country,
          description: hit.description,
        },
      }) as Promise<EntityStats>,
    staleTime: 15 * 60_000,
    retry: 0,
  });

  return (
    <div className="mt-6 rounded-xl border border-accent/40 bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
            AI estimate
          </span>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Career stats over time
          </h3>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:border-accent/40 hover:text-foreground disabled:opacity-40"
        >
          {isFetching ? "…" : "Regenerate"}
        </button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Generating career trajectory charts…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">
          {(error as Error).message || "Couldn't generate stats."}
        </p>
      )}

      {data && data.metrics.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.metrics.map((m, idx) => (
              <div
                key={m.key}
                className="rounded-lg border border-border bg-card/60 p-3"
              >
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{m.label}</p>
                  {m.unit && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {m.unit}
                    </span>
                  )}
                </div>
                {m.description && (
                  <p className="mb-2 text-xs text-muted-foreground">{m.description}</p>
                )}
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={m.series} margin={{ top: 10, right: 14, bottom: 4, left: -18 }}>
                      <defs>
                        <filter id={`line-glow-${idx}`} x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.25} />
                      <XAxis
                        dataKey="year"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickMargin={4}
                        axisLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.7 }}
                        tickLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.7 }}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        width={40}
                        axisLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.7 }}
                        tickLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.7 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                        itemStyle={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        connectNulls
                        dot={{ r: 4, strokeWidth: 2, stroke: "#0a0a0a", fill: CHART_COLORS[idx % CHART_COLORS.length] }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: "#0a0a0a" }}
                        filter={`url(#line-glow-${idx})`}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
          {data.notes && (
            <p className="mt-3 text-[11px] italic text-muted-foreground">{data.notes}</p>
          )}
        </>
      )}
    </div>
  );
}

function EventDetail({
  sport,
  name,
  onBack,
}: {
  sport: Sport;
  name: string;
  onBack: () => void;
}) {
  const eventFn = useServerFn(analyzeEvent);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["event", sport, name],
    queryFn: () => eventFn({ data: { sport, name } }) as Promise<EventAnalysis>,
    staleTime: 15 * 60_000,
    retry: 0,
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to results
        </button>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:border-accent/40 hover:text-foreground disabled:opacity-40"
        >
          {isFetching ? "…" : "Regenerate"}
        </button>
      </div>

      <div className="flex items-start gap-3">
        <span className="text-3xl">🏆</span>
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">{sport} · Event</p>
          <h2 className="text-2xl font-bold">{data?.title ?? name} <AiEstimate /></h2>
          <p className="text-sm text-muted-foreground">
            {[data?.dateRange, data?.venue].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="mt-6 text-sm text-muted-foreground">Building event dossier with AI…</p>
      )}
      {error && (
        <p className="mt-6 text-sm text-destructive">
          {(error as Error).message || "Couldn't load event."}
        </p>
      )}

      {data && (
        <div className="mt-6 space-y-6">
          {data.overview && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Overview
              </h3>
              <p className="text-sm leading-relaxed text-foreground/90">{data.overview}</p>
            </div>
          )}

          {(data.winner || (data.runnersUp && data.runnersUp.length > 0)) && (
            <div className="grid gap-3 sm:grid-cols-3">
              {data.winner && (
                <div className="rounded-xl border border-primary/50 bg-primary/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    Winner
                  </p>
                  <p className="mt-1 font-semibold">🥇 {data.winner}</p>
                </div>
              )}
              {data.runnersUp?.map((r, i) => (
                <div key={i} className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {i === 0 ? "Runner-up" : `#${i + 2}`}
                  </p>
                  <p className="mt-1 font-medium">{i === 0 ? "🥈" : "🥉"} {r}</p>
                </div>
              ))}
            </div>
          )}

          {data.keyStats.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Key stats
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.keyStats.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-semibold">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.topPerformers.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Top performers
              </h3>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {data.topPerformers.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      {p.role && (
                        <p className="text-xs text-muted-foreground">{p.role}</p>
                      )}
                    </div>
                    <span className="rounded bg-secondary px-2 py-1 font-mono text-xs">
                      {p.stat}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.charts.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Event stats
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {data.charts.map((c, idx) => (
                  <div key={c.key} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{c.label}</p>
                      {c.unit && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {c.unit}
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="mb-2 text-xs text-muted-foreground">{c.description}</p>
                    )}
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={c.series} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.25} vertical={false} />
                          <XAxis
                            dataKey="label"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={10}
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={50}
                            axisLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.7 }}
                            tickLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.7 }}
                          />
                          <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            width={40}
                            axisLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.7 }}
                            tickLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.7 }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                          />
                          <Bar
                            dataKey="value"
                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            fillOpacity={0.85}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.highlights.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Highlights
              </h3>
              <ul className="space-y-1 text-sm">
                {data.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">✦</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.notes && (
            <p className="text-[11px] italic text-muted-foreground">{data.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

function LiveScoresView({ sport }: { sport: Sport }) {
  const fetchLive = useServerFn(getLiveScores);
  const { data, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["live", sport],
    queryFn: () => fetchLive({ data: { sport } }),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const events = data?.events ?? [];
  const live = events.filter((e) => e.state === "in");
  const upcoming = events.filter((e) => e.state === "pre").slice(0, 8);
  const finished = events.filter((e) => e.state === "post").slice(0, 8);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
          </span>
          <h2 className="text-xl font-semibold">Live {sport} scores</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {live.length} live · auto-refresh 30s
          </span>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn't load live scores. Try again.
        </p>
      )}

      {!error && events.length === 0 && !isFetching && (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No {sport} matches on the wire right now. Check back soon.
        </p>
      )}

      {sport === "F1" && (
        <F1GridPanel liveEvent={live[0] ?? upcoming[0] ?? finished[0]} />
      )}

      <LiveSection title="🔴 Live now" items={live} emptyHint="No matches in progress." />
      <LiveSection title="⏭ Upcoming" items={upcoming} />
      <LiveSection title="✅ Recently finished" items={finished} />

      {dataUpdatedAt > 0 && (
        <p className="mt-4 text-right text-xs text-muted-foreground">
          Updated {new Date(dataUpdatedAt).toLocaleTimeString()} · Source: ESPN
        </p>
      )}
    </div>
  );
}

function LiveSection({
  title,
  items,
  emptyHint,
}: {
  title: string;
  items: LiveScore[];
  emptyHint?: string;
}) {
  if (items.length === 0 && !emptyHint) return null;
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((m) => (
            <LiveCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function LiveCard({ m }: { m: LiveScore }) {
  const isLive = m.state === "in";
  const isPre = m.state === "pre";
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        isLive
          ? "border-red-500/50 bg-red-500/5"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{m.league}</span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${
            isLive
              ? "bg-red-500/20 text-red-400"
              : isPre
                ? "bg-secondary text-muted-foreground"
                : "bg-secondary text-muted-foreground"
          }`}
        >
          {isLive ? `● ${m.shortDetail ?? "LIVE"}` : (m.shortDetail ?? m.status)}
        </span>
      </div>
      <TeamRow name={m.home.name} logo={m.home.logo} score={m.home.score} live={isLive} />
      <div className="my-1 h-px bg-border/60" />
      <TeamRow name={m.away.name} logo={m.away.logo} score={m.away.score} live={isLive} />
      {m.note && (
        <p className="mt-2 truncate text-[11px] text-muted-foreground">{m.note}</p>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-2 w-full rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-secondary"
      >
        {open ? "Hide AI insight" : "✨ AI insight — recap, hype & prediction"}
      </button>
      {open && <LiveInsightPanel m={m} />}
    </div>
  );
}

function LiveInsightPanel({ m }: { m: LiveScore }) {
  const fn = useServerFn(liveInsight);
  const { data, isPending, isError, error, refetch, isFetching } = useQuery<LiveInsight>({
    queryKey: ["liveInsight", m.id, m.home.score, m.away.score, m.state],
    queryFn: () =>
      fn({
        data: {
          sport: m.league,
          league: m.league,
          state: m.state,
          status: m.status,
          detail: m.detail,
          home: { name: m.home.name, score: m.home.score },
          away: { name: m.away.name, score: m.away.score },
          note: m.note,
        },
      }),
    staleTime: 60_000,
  });

  if (isPending) return <p className="mt-2 text-xs text-muted-foreground">Analyzing match…</p>;
  if (isError)
    return (
      <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
        <p className="text-destructive">{(error as Error)?.message ?? "Failed to load insight."}</p>
        <button onClick={() => refetch()} className="mt-1 text-primary hover:underline">
          Retry
        </button>
      </div>
    );

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border bg-background/40 p-2 text-xs">
      {data.recap && (
        <div>
          <p className="mb-0.5 font-semibold text-primary">📝 So far</p>
          <p className="text-foreground/90 leading-snug">{data.recap}</p>
        </div>
      )}
      {data.excitement && (
        <div>
          <p className="mb-0.5 font-semibold text-yellow-400">🔥 Why it's exciting</p>
          <p className="text-foreground/90 leading-snug">{data.excitement}</p>
        </div>
      )}
      {data.prediction && (
        <div>
          <p className="mb-0.5 font-semibold text-emerald-400">
            {m.state === "post" ? "🎯 Decisive moment" : "🔮 Prediction"}
          </p>
          <p className="text-foreground/90 leading-snug">{data.prediction}</p>
        </div>
      )}
      {data.keyMoments.length > 0 && (
        <div>
          <p className="mb-0.5 font-semibold text-cyan-400">📌 Key moments</p>
          <ul className="list-disc space-y-0.5 pl-4 text-foreground/90">
            {data.keyMoments.map((k, i) => (
              <li key={i} className="leading-snug">{k}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        className="text-[11px] text-primary hover:underline disabled:opacity-50"
      >
        {isFetching ? "Refreshing…" : "↻ Regenerate"}
      </button>
    </div>
  );
}

function TeamRow({
  name,
  logo,
  score,
  live,
}: {
  name: string;
  logo?: string;
  score?: string;
  live: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 shrink-0 overflow-hidden rounded bg-secondary">
        {logo ? (
          <img src={logo} alt="" className="h-full w-full object-contain" />
        ) : null}
      </div>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
      <span
        className={`shrink-0 tabular-nums text-base font-semibold ${
          live ? "text-red-400" : "text-foreground"
        }`}
      >
        {score ?? "-"}
      </span>
    </div>
  );
}

const TIRE_COLOR: Record<string, string> = {
  Soft: "bg-red-500/20 text-red-400 border-red-500/40",
  Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  Hard: "bg-white/10 text-foreground border-white/30",
  Inter: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  Wet: "bg-blue-500/20 text-blue-400 border-blue-500/40",
};

function F1GridPanel({ liveEvent }: { liveEvent?: LiveScore }) {
  const fn = useServerFn(f1LiveGrid);
  const isLive = liveEvent?.state === "in";
  const { data, isPending, isError, error, refetch, isFetching } = useQuery<F1LiveGrid>({
    queryKey: ["f1grid", liveEvent?.id ?? "latest", isLive],
    queryFn: () =>
      fn({
        data: {
          event: liveEvent?.home?.name || liveEvent?.league || "current F1 Grand Prix",
          status: liveEvent?.status,
          detail: liveEvent?.detail,
        },
      }),
    staleTime: 60_000,
    refetchInterval: isLive ? 90_000 : false,
  });

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            🏁 Live timing <AiEstimate />
            {isLive && (
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs font-medium text-red-400">
                ● LIVE
              </span>
            )}
          </h3>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.race}{data.session ? ` · ${data.session}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          {isFetching ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {isPending && (
        <p className="py-6 text-center text-sm text-muted-foreground">Building live grid…</p>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error)?.message ?? "Failed to load grid."}
        </div>
      )}

      {data && !isPending && (
        <>
          {data.narrative && (
            <p className="mb-3 rounded-lg border border-border bg-background/40 p-2.5 text-sm text-foreground/90">
              {data.narrative}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Pos</th>
                  <th className="px-2 py-1.5 text-left font-medium">Driver</th>
                  <th className="px-2 py-1.5 text-left font-medium">Team</th>
                  <th className="px-2 py-1.5 text-right font-medium">Gap</th>
                  <th className="px-2 py-1.5 text-right font-medium">Last lap</th>
                  <th className="px-2 py-1.5 text-center font-medium">Tire</th>
                  <th className="px-2 py-1.5 text-center font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((d) => {
                  const dnf = d.status === "DNF" || d.status === "Retired";
                  return (
                    <tr
                      key={`${d.position}-${d.driver}`}
                      className={`border-t border-border/60 ${dnf ? "opacity-50" : ""}`}
                    >
                      <td className="px-2 py-1.5 font-semibold tabular-nums">
                        {d.position}
                      </td>
                      <td className="px-2 py-1.5 font-medium">{d.driver}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{d.team}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{d.gap}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {d.lastLap ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {d.tire ? (
                          <span
                            className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${TIRE_COLOR[d.tire] ?? "border-border text-muted-foreground"}`}
                          >
                            {d.tire[0]}{d.tireAge != null ? ` ${d.tireAge}` : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-center tabular-nums ${
                          (d.change ?? 0) > 0
                            ? "text-emerald-400"
                            : (d.change ?? 0) < 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {(d.change ?? 0) > 0 ? `▲${d.change}` : (d.change ?? 0) < 0 ? `▼${-(d.change ?? 0)}` : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.battles.length > 0 && (
              <div className="rounded-lg border border-border bg-background/40 p-2.5 text-xs">
                <p className="mb-1 font-semibold text-yellow-400">⚔ On-track battles</p>
                <ul className="list-disc space-y-0.5 pl-4 text-foreground/90">
                  {data.battles.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}
            {data.strategy && (
              <div className="rounded-lg border border-border bg-background/40 p-2.5 text-xs">
                <p className="mb-1 font-semibold text-cyan-400">🛞 Strategy</p>
                <p className="text-foreground/90 leading-snug">{data.strategy}</p>
              </div>
            )}
          </div>

          {data.disclaimer && (
            <p className="mt-2 text-[10px] italic text-muted-foreground">{data.disclaimer}</p>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Deep sport-specific stats panel ----------

const DEEP_CHART_COLORS = ["#FF3366", "#00CCFF", "#33FF99", "#FFCC00", "#CC99FF"];

function DeepStatsPanel({ hit }: { hit: Hit }) {
  const fetchDeep = useServerFn(deepStats);
  const { data, isLoading, isError, refetch, isFetching } = useQuery<DeepStats>({
    queryKey: ["deep-stats", hit.kind, hit.id, hit.sport],
    queryFn: () =>
      fetchDeep({
        data: {
          kind: hit.kind,
          name: hit.name,
          sport: hit.sport,
          team: hit.kind === "player" ? hit.team : undefined,
          nationality: hit.kind === "player" ? hit.nationality : hit.country,
          description: hit.description,
        },
      }),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="mt-6 rounded-xl border border-border bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          📊 Deep stats <AiEstimate />
        </h3>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/60"
          disabled={isFetching}
        >
          {isFetching ? "…" : "Regenerate"}
        </button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Compiling sport-specific stats…</p>}
      {isError && <p className="text-sm text-destructive">Couldn't load deep stats.</p>}
      {data?.headline && <p className="mb-3 text-sm text-foreground/90">{data.headline}</p>}
      {data?.sections.map((s, i) => (
        <div key={i} className="mb-5 last:mb-0">
          <h4 className="mb-1 text-sm font-semibold">{s.title}</h4>
          {s.description && (
            <p className="mb-2 text-xs text-muted-foreground">{s.description}</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  {s.columns.map((c, j) => (
                    <th key={j} className="px-3 py-2 text-left font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, j) => (
                  <tr key={j} className="border-t border-border/60">
                    {r.map((cell, k) => (
                      <td key={k} className="px-3 py-1.5 tabular-nums">
                        {typeof cell === "number" ? cell.toLocaleString() : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.chart && s.chart.series.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {s.chart.label} {s.chart.unit ? `(${s.chart.unit})` : ""}
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.chart.series} margin={{ top: 8, right: 8, left: -12, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      axisLine={{ stroke: "hsl(var(--muted-foreground))", opacity: 0.7 }}
                      tickLine={{ stroke: "hsl(var(--muted-foreground))", opacity: 0.7 }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                      axisLine={{ stroke: "hsl(var(--muted-foreground))", opacity: 0.7 }}
                      tickLine={{ stroke: "hsl(var(--muted-foreground))", opacity: 0.7 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill={DEEP_CHART_COLORS[i % DEEP_CHART_COLORS.length]}
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth={1}
                      radius={[4, 4, 0, 0]}
                      fillOpacity={0.85}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      ))}
      {data?.notes && (
        <p className="mt-2 text-[11px] italic text-muted-foreground">{data.notes}</p>
      )}
    </div>
  );
}

function AiEstimate() {
  return (
    <span
      title="Generated by AI — may be inaccurate"
      className="ml-1 inline-block rounded bg-primary/20 px-1.5 py-0.5 align-middle text-[10px] font-bold normal-case tracking-wide text-primary"
    >
      AI estimate
    </span>
  );
}

// ---------- Standings view ----------

function StandingsView({ sport }: { sport: Sport }) {
  const presets = LEAGUES[sport];
  const [league, setLeague] = useState<string>(presets[0]);
  const [input, setInput] = useState<string>("");
  const fetchStandings = useServerFn(standings);
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Standings>({
    queryKey: ["standings", sport, league],
    queryFn: () => fetchStandings({ data: { sport, league } }),
    staleTime: 5 * 60_000,
  });

  const applyInput = () => {
    const v = input.trim();
    if (v) setLeague(v);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => {
              setLeague(p);
              setInput("");
            }}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              league === p
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="mx-auto mb-6 flex max-w-xl gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyInput()}
          placeholder={`Or type any ${sport} league / competition…`}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={applyInput}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Load
        </button>
      </div>

      {isLoading && (
        <p className="text-center text-muted-foreground">Loading {league}…</p>
      )}
      {isError && <p className="text-center text-destructive">Couldn't load standings.</p>}

      {data && (
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold">
                {data.title}{" "}
                {data.source === "espn" ? (
                  <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-widest text-foreground">
                    Live data · ESPN
                  </span>
                ) : (
                  <AiEstimate />
                )}
              </h3>
              {data.subtitle && (
                <p className="text-xs text-muted-foreground">{data.subtitle}</p>
              )}
            </div>
            <button
              onClick={() => refetch()}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/60"
              disabled={isFetching}
            >
              {isFetching ? "…" : "Refresh"}
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold">#</th>
                  <th className="px-2 py-2 text-left font-semibold">Name</th>
                  {data.columns.map((c, i) => (
                    <th key={i} className="px-2 py-2 text-center font-semibold">{c}</th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold">Δ</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const ch = r.change ?? 0;
                  return (
                    <tr key={r.rank} className="border-t border-border/60 hover:bg-secondary/30">
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{r.rank}</td>
                      <td className="px-2 py-1.5 font-medium">{r.name}</td>
                      {r.cells.map((c, i) => (
                        <td key={i} className="px-2 py-1.5 text-center tabular-nums">
                          {typeof c === "number" ? c.toLocaleString() : c}
                        </td>
                      ))}
                      <td
                        className={`px-2 py-1.5 text-center tabular-nums ${
                          ch > 0 ? "text-emerald-400" : ch < 0 ? "text-red-400" : "text-muted-foreground"
                        }`}
                      >
                        {ch > 0 ? `▲${ch}` : ch < 0 ? `▼${-ch}` : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.notes && (
            <p className="mt-3 text-[11px] italic text-muted-foreground">{data.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
