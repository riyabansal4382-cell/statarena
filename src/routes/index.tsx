import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
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
  type AiAnalysis,
  type Comparison,
  type EntityStats,
} from "@/lib/ai.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

const SPORTS: { key: Sport; label: string; emoji: string }[] = [
  { key: "Cricket", label: "Cricket", emoji: "🏏" },
  { key: "Tennis", label: "Tennis", emoji: "🎾" },
  { key: "F1", label: "Formula 1", emoji: "🏎️" },
];

const SUGGESTIONS: Record<Sport, string[]> = {
  Cricket: ["India", "Mumbai Indians", "Virat Kohli", "Ben Stokes"],
  Tennis: ["Novak Djokovic", "Carlos Alcaraz", "Iga Swiatek", "Serena Williams"],
  F1: ["Lewis Hamilton", "Max Verstappen", "Ferrari", "McLaren"],
};

type Mode = "explore" | "compare";

function Index() {
  const [mode, setMode] = useState<Mode>("explore");
  const [sport, setSport] = useState<Sport>("Cricket");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [slotA, setSlotA] = useState<Hit | null>(null);
  const [slotB, setSlotB] = useState<Hit | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

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
        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            StatArena · AI sports intel
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
            Every <span className="text-primary">stat</span>. Every{" "}
            <span className="text-accent">story</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Explore Cricket, Tennis, and F1 — or compare two teams / players head to head with AI.
          </p>
        </header>

        <div className="mx-auto mb-6 flex w-fit rounded-full border border-border bg-card p-1">
          {(["explore", "compare"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setSelected(null);
              }}
              className={`rounded-full px-5 py-1.5 text-sm font-medium capitalize transition ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "compare" ? "⚔ Compare" : "🔎 Explore"}
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
          <span className="text-xs text-muted-foreground">Try:</span>
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

        <section className="mt-10">
          {error && (
            <p className="text-center text-destructive">
              Couldn't reach the sports database. Try again.
            </p>
          )}
          {isFetching && (
            <p className="text-center text-muted-foreground">Searching {sport}…</p>
          )}
          {!isFetching && query && data && data.length === 0 && (
            <p className="text-center text-muted-foreground">
              No {sport} results for "{query}".
            </p>
          )}

          {mode === "explore" ? (
            selected ? (
              <Detail hit={selected} onBack={() => setSelected(null)} />
            ) : (
              <ResultsGrid data={data} onPick={pickResult} />
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
          AI
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
              AI
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
