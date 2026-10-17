// One AI agent = one persona. The client calls this route once per persona in
// parallel (like Emergent's parallel ADK agents), so cards fill in as each
// agent "finishes thinking".

import { NextRequest, NextResponse } from "next/server";
import type { AgentNarrative, Sentiment } from "@/lib/types";
import { PERSONAS, PERSONA_BY_ID } from "@/lib/data/personas";
import { simulate } from "@/lib/engine/model";
import { templateNarrative } from "@/lib/engine/templates";
import { generateJSON } from "@/lib/ai/gemini";
import { GROUNDING_RULES, personaCard, scenarioBrief, stateLine } from "@/lib/ai/context";
import { resolveScenario } from "@/lib/scenarios/validate";

const SENTIMENTS: Sentiment[] = ["hopeful", "relieved", "calm", "concerned", "frustrated", "anxious", "distressed"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const scenario = resolveScenario(body?.scenario);
  const persona = PERSONA_BY_ID[body?.personaId];
  if (!scenario || !persona) return NextResponse.json({ error: "Bad scenario or personaId" }, { status: 400 });

  const sim = simulate(scenario);
  const k = PERSONAS.findIndex((p) => p.id === persona.id);
  const policyStates = sim.policy.states.map((row) => row[k]);
  const baselineStates = sim.baseline.states.map((row) => row[k]);
  const fallback = templateNarrative(scenario, persona, policyStates, baselineStates);

  const system = `You are the inner voice of a resident in a Toronto civic simulation.
${GROUNDING_RULES}
Return JSON: {"periods":[{"period":number,"thought":string,"sentiment":one of ${JSON.stringify(SENTIMENTS)}}],"baselineReflection":string}
- One entry per period listed, in order. Each "thought" is 1–2 short first-person sentences (max 35 words) reacting to what happened to them that period, grounded in the "Why" facts.
- Make thoughts feel lived-in and specific to their life (kids, shifts, health, money), not generic.
- "baselineReflection": one first-person sentence about how things would have gone without the policy.`;

  const prompt = `${scenarioBrief(scenario)}

RESIDENT
${personaCard(persona)}

WHAT HAPPENS WITH THE POLICY (from the simulation engine — treat as fact)
${policyStates.map((st) => stateLine(scenario, st)).join("\n")}

WITHOUT THE POLICY, FINAL PERIOD
${stateLine(scenario, baselineStates[baselineStates.length - 1])}`;

  type Out = { periods?: { period: number; thought: string; sentiment: string }[]; baselineReflection?: string };
  const out = await generateJSON<Out>({ system, prompt, temperature: 0.9 });

  if (!out?.periods?.length) return NextResponse.json(fallback);

  const narrative: AgentNarrative = {
    personaId: persona.id,
    source: "gemini",
    baselineReflection: out.baselineReflection || fallback.baselineReflection,
    periods: policyStates.map((st, i) => {
      const g = out.periods!.find((x) => x.period === st.period) ?? out.periods![i];
      return {
        period: st.period,
        thought: (g?.thought || fallback.periods[i].thought).slice(0, 300),
        sentiment: SENTIMENTS.includes(g?.sentiment as Sentiment) ? (g!.sentiment as Sentiment) : fallback.periods[i].sentiment,
      };
    }),
  };
  return NextResponse.json(narrative);
}
