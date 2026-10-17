// "Call" a resident. Mirrors Emergent's phone-interview feature, but grounded:
// the persona can only talk about what the engine says happened to them.

import { NextRequest, NextResponse } from "next/server";
import type { Arm, ChatMessage } from "@/lib/types";
import { PERSONAS, PERSONA_BY_ID } from "@/lib/data/personas";
import { simulate } from "@/lib/engine/model";
import { templateInterviewReply } from "@/lib/engine/templates";
import { generateText } from "@/lib/ai/gemini";
import { GROUNDING_RULES, personaCard, scenarioBrief, stateLine } from "@/lib/ai/context";
import { resolveScenario } from "@/lib/scenarios/validate";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const scenario = resolveScenario(body?.scenario);
  const persona = PERSONA_BY_ID[body?.personaId];
  const message = String(body?.message ?? "").slice(0, 600);
  const arm: Arm = body?.arm === "baseline" ? "baseline" : "policy";
  const history: ChatMessage[] = Array.isArray(body?.history) ? body.history.slice(-10) : [];
  if (!scenario || !persona || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const N = scenario.periodLabels.length;
  const period = Math.min(Math.max(1, Number(body?.period) || 1), N);
  const sim = simulate(scenario);
  const k = PERSONAS.findIndex((p) => p.id === persona.id);
  const run = sim[arm];
  const soFar = run.states.slice(0, period).map((row) => row[k]);
  const now = soFar[soFar.length - 1];

  const system = `You are ${persona.name}, a fictional composite Toronto resident, talking on the phone with a city staffer or journalist.
${GROUNDING_RULES}
- Stay in character. Answer in 2–4 short spoken sentences (this is read aloud).
- Talk about your own life and what has happened to you so far. If asked something you wouldn't know, say so.
- If asked who to vote for, politely say you'd rather not get into that.`;

  const prompt = `${scenarioBrief(scenario)}
Current view: ${arm === "policy" ? "WITH the policy" : "WITHOUT the policy (status quo)"}, it is now ${scenario.periodLabels[period - 1]}.

ABOUT YOU
${personaCard(persona)}

WHAT HAS HAPPENED TO YOU SO FAR (fact)
${soFar.map((st) => stateLine(scenario, st)).join("\n")}

CONVERSATION SO FAR
${history.map((m) => `${m.role === "user" ? "Caller" : persona.name}: ${m.text}`).join("\n") || "(just picked up)"}

Caller: ${message}
${persona.name}:`;

  const reply = await generateText({ system, prompt, temperature: 0.8 });
  return NextResponse.json({
    reply: reply ?? templateInterviewReply(scenario, persona, now, message, arm === "policy" ? sim.baseline.states[period - 1][k] : undefined),
    source: reply ? "gemini" : "template",
  });
}
