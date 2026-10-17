// Ward briefing generator: the "report-card / briefing generator" format that
// School of Cities asked for. Neutral, plain-language, with sources + limits.

import { NextRequest, NextResponse } from "next/server";
import { PERSONAS } from "@/lib/data/personas";
import { NEIGHBOURHOOD_BY_ID } from "@/lib/data/neighbourhoods";
import { simulate } from "@/lib/engine/model";
import { templateBriefing } from "@/lib/engine/templates";
import { generateText } from "@/lib/ai/gemini";
import { formatMetric } from "@/lib/format";
import { personaCard, stateLine } from "@/lib/ai/context";
import { resolveScenario } from "@/lib/scenarios/validate";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const scenario = resolveScenario(body?.scenario);
  if (!scenario) return NextResponse.json({ error: "Bad scenario" }, { status: 400 });
  const ward: number | "all" = body?.ward === "all" || body?.ward === undefined ? "all" : Number(body.ward);
  const audience: string = ["residents", "journalists", "councillors"].includes(body?.audience) ? body.audience : "residents";

  const sim = simulate(scenario);
  const fallback = templateBriefing(scenario, sim, ward);
  const last = scenario.periodLabels.length - 1;

  const people = PERSONAS.map((p, i) => ({ p, i })).filter(({ p }) => ward === "all" || NEIGHBOURHOOD_BY_ID[p.neighbourhoodId]?.ward === ward);
  const metricsTable = scenario.metrics
    .map((m) => `${m.label}: status quo ${formatMetric(sim.baseline.metrics[last][m.id], m.format)} vs policy ${formatMetric(sim.policy.metrics[last][m.id], m.format)} (${m.description})`)
    .join("\n");

  const system = `You write neutral, plain-language civic briefings for Toronto ${audience}.
Rules:
- Use ONLY the facts provided. Do not invent numbers, programs, or quotes beyond what's given.
- Strictly non-partisan: never recommend a candidate or party, never tell people how to vote.
- Be honest about trade-offs and who is left out. Reading level: grade 8.
- Output GitHub-flavoured markdown with these sections:
  # title, an italic one-line subtitle noting it's a simulation with composite households,
  ## The question, ## What changes, ## The numbers (a markdown table: Measure | Status quo | With policy),
  ## Who comes out ahead, ## Who pays a cost, ## Who isn't reached,
  ## Questions to ask candidates in your ward (3 neutral questions), ## Limits of this simulation, then a **Sources:** line with markdown links.
- Keep it under 450 words.`;

  const prompt = `Area: ${ward === "all" ? "City-wide" : `Ward ${ward}`}
Scenario: ${scenario.title}
Question: ${scenario.civicQuestion}
Policy: ${scenario.policy.name} — ${scenario.policy.description}
Status quo: ${scenario.baseline.description}

NUMBERS AT ${scenario.periodLabels[last]}
${metricsTable}

RESIDENTS IN THIS AREA (composites) — final outcome with policy, and without
${people
  .map(({ p, i }) => `${personaCard(p)}\nWITH POLICY → ${stateLine(scenario, sim.policy.states[last][i])}\nWITHOUT → ${stateLine(scenario, sim.baseline.states[last][i])}`)
  .join("\n\n")}

LIMITATIONS
${scenario.limitations.join("\n")}

SOURCES
${scenario.sources.map((s) => `${s.label}: ${s.url}`).join("\n")}`;

  const md = people.length ? await generateText({ system, prompt, temperature: 0.4, timeoutMs: 30000 }) : null;
  return NextResponse.json({ markdown: md ?? fallback, source: md ? "gemini" : "template" });
}
