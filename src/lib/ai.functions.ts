import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const CURRENT_DATE = "July 2026";
const DATE_CONTEXT = `IMPORTANT: Today is ${CURRENT_DATE}. All stats, titles, rankings, records, transfers and achievements MUST reflect the state of the sport as of ${CURRENT_DATE}. Do not use outdated figures from 2023 or 2024. Include events and titles through the 2025 season and the first half of the 2026 season (e.g., 2026 Australian Open, 2026 Roland Garros, 2026 Wimbledon, 2025 & 2026 F1 seasons, 2025/26 cricket calendar). If a specific recent figure is uncertain, state it generally rather than inventing a number.`;

type EntityInput = {
  kind: "team" | "player";
  name: string;
  sport: string;
  team?: string;
  nationality?: string;
  description?: string;
};

async function callGateway(system: string, user: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI is rate-limited. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI request failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "{}";
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    // Strip code fences if any
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export type AiAnalysis = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
};

export const analyzeEntity = createServerFn({ method: "POST" })
  .inputValidator((input: EntityInput) => {
    if (!input || typeof input.name !== "string" || !input.name.trim()) {
      throw new Error("name is required");
    }
    return {
      kind: input.kind === "team" ? "team" : "player",
      name: input.name.slice(0, 120),
      sport: (input.sport ?? "").slice(0, 40),
      team: input.team?.slice(0, 120),
      nationality: input.nationality?.slice(0, 80),
      description: input.description?.slice(0, 4000),
    } as EntityInput;
  })
  .handler(async ({ data }) => {
    const system = `You are a sports analyst. Return concise, factual analysis as JSON only.
${DATE_CONTEXT}
Schema: { "summary": string (2-3 sentences), "strengths": string[] (3-5 short bullets), "weaknesses": string[] (2-4 short bullets) }.
Base analysis on well-known public information current as of ${CURRENT_DATE}. If unsure about a specific claim, keep it general. No preamble, JSON only.`;

    const user = `Analyze this ${data.kind} in ${data.sport}:
Name: ${data.name}
${data.team ? `Team: ${data.team}\n` : ""}${data.nationality ? `Nationality: ${data.nationality}\n` : ""}${data.description ? `Bio: ${data.description}\n` : ""}
Give: summary, strengths, weaknesses.`;

    const raw = await callGateway(system, user);
    const parsed = safeJson<AiAnalysis>(raw, {
      summary: "",
      strengths: [],
      weaknesses: [],
    });
    return {
      summary: String(parsed.summary ?? ""),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6).map(String) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 6).map(String) : [],
    };
  });

export type Comparison = {
  verdict: string;
  categories: { label: string; a: string; b: string; edge: "a" | "b" | "even" }[];
  aEdge: string[];
  bEdge: string[];
};

type ComparePair = {
  sport: string;
  a: EntityInput;
  b: EntityInput;
};

export const compareEntities = createServerFn({ method: "POST" })
  .inputValidator((input: ComparePair) => {
    if (!input?.a?.name || !input?.b?.name) throw new Error("Two entities required");
    return input;
  })
  .handler(async ({ data }) => {
    const system = `You are a sports analyst. Compare two ${data.sport} entities objectively.
${DATE_CONTEXT}
Return JSON only, no preamble.
Schema: {
  "verdict": string (2-3 sentence overall summary as of ${CURRENT_DATE}),
  "categories": [{ "label": string, "a": string, "b": string, "edge": "a"|"b"|"even" }] (4-6 rows across relevant axes like Peak performance, Consistency, Big-match record, Longevity, Style; cell values should reference up-to-date stats through ${CURRENT_DATE}),
  "aEdge": string[] (2-4 areas where A is stronger),
  "bEdge": string[] (2-4 areas where B is stronger)
}`;

    const fmt = (e: EntityInput) =>
      `${e.name} (${e.kind}${e.team ? `, ${e.team}` : ""}${e.nationality ? `, ${e.nationality}` : ""})${e.description ? `\nBio: ${e.description.slice(0, 1500)}` : ""}`;

    const user = `Compare in ${data.sport}:

A: ${fmt(data.a)}

B: ${fmt(data.b)}`;

    const raw = await callGateway(system, user);
    const parsed = safeJson<Comparison>(raw, {
      verdict: "",
      categories: [],
      aEdge: [],
      bEdge: [],
    });
    return {
      verdict: String(parsed.verdict ?? ""),
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.slice(0, 8).map((c) => ({
            label: String(c.label ?? ""),
            a: String(c.a ?? ""),
            b: String(c.b ?? ""),
            edge: c.edge === "a" || c.edge === "b" ? c.edge : "even",
          }))
        : [],
      aEdge: Array.isArray(parsed.aEdge) ? parsed.aEdge.slice(0, 6).map(String) : [],
      bEdge: Array.isArray(parsed.bEdge) ? parsed.bEdge.slice(0, 6).map(String) : [],
    };
  });

export type StatSeries = {
  key: string;
  label: string;
  unit?: string;
  description?: string;
  series: { year: number; value: number }[];
};
export type EntityStats = {
  notes: string;
  metrics: StatSeries[];
};

export const entityStats = createServerFn({ method: "POST" })
  .inputValidator((input: EntityInput) => {
    if (!input?.name) throw new Error("name required");
    return input;
  })
  .handler(async ({ data }) => {
    const sport = data.sport;
    const metricHint =
      sport === "Tennis"
        ? "forehand quality, backhand quality, serve rating, return rating, movement, mental strength"
        : sport === "Cricket"
          ? "batting average, strike rate, bowling economy, fielding rating, form index"
          : sport === "Motorsport" || sport === "F1"
            ? "qualifying pace, race pace, tyre management, wet-weather skill, consistency"
            : "overall rating, form, consistency";

    const system = `You are a sports analyst producing year-by-year performance ratings.
${DATE_CONTEXT}
Return JSON only. Ratings are estimates on a 0-100 scale unless a natural unit exists (e.g. cricket batting average).
For a ${data.kind}, produce 4-6 metrics covering: ${metricHint}.
Each metric MUST include a "series" with one point per year covering the entity's meaningful career window and ending at 2026.
For active athletes with short careers, start at their debut year. For teams, span the last ~10-15 years.
Schema: {
  "notes": string (1 sentence caveat that these are AI-estimated indices),
  "metrics": [{
    "key": string (short id),
    "label": string (human label, e.g. "Forehand quality"),
    "unit": string (e.g. "/100" or "avg"),
    "description": string (1 short sentence),
    "series": [{ "year": number, "value": number }]
  }]
}
Values should reflect realistic trajectories (peaks, dips, injuries) as of ${CURRENT_DATE}. No preamble.`;

    const user = `Entity: ${data.name}
Kind: ${data.kind}
Sport: ${sport}
${data.team ? `Team: ${data.team}\n` : ""}${data.nationality ? `Nationality: ${data.nationality}\n` : ""}${data.description ? `Bio: ${data.description.slice(0, 1200)}\n` : ""}
Produce year-by-year metric series through 2026.`;

    const raw = await callGateway(system, user);
    const parsed = safeJson<EntityStats>(raw, { notes: "", metrics: [] });
    return {
      notes: String(parsed.notes ?? ""),
      metrics: Array.isArray(parsed.metrics)
        ? parsed.metrics.slice(0, 8).map((m) => ({
            key: String(m.key ?? m.label ?? "metric"),
            label: String(m.label ?? m.key ?? "Metric"),
            unit: m.unit ? String(m.unit) : undefined,
            description: m.description ? String(m.description) : undefined,
            series: Array.isArray(m.series)
              ? m.series
                  .map((p) => ({
                    year: Number(p.year),
                    value: Number(p.value),
                  }))
                  .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value))
                  .sort((a, b) => a.year - b.year)
              : [],
          }))
        : [],
    };
  });
