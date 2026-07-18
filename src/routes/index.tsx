import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  searchAll,
  lastTeamEvents,
  playerHonours,
  type Sport,
  type Hit,
  type TeamHit,
  type PlayerHit,
} from "@/lib/sportsdb";

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

function Index() {
  const [sport, setSport] = useState<Sport>("Cricket");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Hit | null>(null);

  const { data, isFetching, error } = useQuery({
    queryKey: ["search", sport, query],
    queryFn: () => searchAll(query, sport),
    enabled: query.length > 0,
    staleTime: 60_000,
  });

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSelected(null);
    setQuery(input.trim());
  };

  const quick = (q: string) => {
    setInput(q);
    setSelected(null);
    setQuery(q);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            StatArena · live sports intel
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
            Every <span className="text-primary">stat</span>. Every{" "}
            <span className="text-accent">story</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Search a team or player across Cricket, Tennis, and Formula 1 — history,
            achievements, recent form, and where they stumble.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setSport(s.key);
                if (query) setQuery(query);
              }}
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

        <form onSubmit={submit} className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Search ${sport} — team or player...`}
            className="flex-1 rounded-xl border border-border bg-card px-5 py-4 text-base outline-none ring-primary/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Search
          </button>
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

          {selected ? (
            <Detail hit={selected} onBack={() => setSelected(null)} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(data ?? []).map((h) => (
                <ResultCard key={`${h.kind}-${h.id}`} hit={h} onOpen={() => setSelected(h)} />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          Data via TheSportsDB · Achievements and weaknesses derived from public bios.
        </footer>
      </div>
    </main>
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

function analyzeText(text?: string) {
  if (!text) return { achievements: [] as string[], weaknesses: [] as string[] };
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  const winKeys = /\b(won|winner|champion|title|record|award|gold|trophy|victory|debut|first|scored|century|centuries|hundred|hat-trick|grand slam|pole|podium|world cup)\b/i;
  const badKeys = /\b(lost|injur|struggle|slump|criticis|controvers|banned|suspend|weak|defeat|poor|failed|dropped|retire|out of form)\b/i;
  const achievements: string[] = [];
  const weaknesses: string[] = [];
  for (const s of sentences) {
    if (winKeys.test(s) && achievements.length < 6) achievements.push(s.trim());
    else if (badKeys.test(s) && weaknesses.length < 4) weaknesses.push(s.trim());
  }
  return { achievements, weaknesses };
}

function TeamDetail({ team }: { team: TeamHit }) {
  const { data: events } = useQuery({
    queryKey: ["team-events", team.id],
    queryFn: () => lastTeamEvents(team.id),
    staleTime: 60_000,
  });
  const insights = useMemo(() => analyzeText(team.description), [team.description]);

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

      <Sections
        history={team.description}
        achievements={insights.achievements}
        weaknesses={insights.weaknesses}
      />

      {events && events.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent form
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {events.map((e) => (
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
  const insights = useMemo(() => analyzeText(player.description), [player.description]);

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

      <Sections
        history={player.description}
        achievements={insights.achievements}
        weaknesses={insights.weaknesses}
      />

      {honours && honours.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Honours
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {honours.map((h, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">🏆 {h.trophy}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {[h.team, h.season].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Sections({
  history,
  achievements,
  weaknesses,
}: {
  history?: string;
  achievements: string[];
  weaknesses: string[];
}) {
  return (
    <div className="mt-6 grid gap-4">
      {history && (
        <Block title="History" tone="muted">
          <p className="text-sm leading-relaxed text-foreground/90">{history}</p>
        </Block>
      )}
      {achievements.length > 0 && (
        <Block title="Achievements" tone="primary">
          <ul className="space-y-1.5 text-sm">
            {achievements.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">▲</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {weaknesses.length > 0 && (
        <Block title="Weaknesses & setbacks" tone="accent">
          <ul className="space-y-1.5 text-sm">
            {weaknesses.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">▼</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Block({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "primary" | "accent" | "muted";
  children: React.ReactNode;
}) {
  const border =
    tone === "primary"
      ? "border-primary/40"
      : tone === "accent"
      ? "border-accent/50"
      : "border-border";
  return (
    <div className={`rounded-xl border ${border} bg-background/40 p-4`}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}
