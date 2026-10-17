// Custom scenario generator: type a policy idea in plain English, get a
// runnable scenario. Gemini picks the closest model (transit / housing / heat)
// and sets its parameters; we clamp every number so the engine stays sane.

import { NextRequest, NextResponse } from "next/server";
import type { HeatParams, HousingParams, Scenario, ScenarioEvent, ScenarioKind, Severity, TransitParams } from "@/lib/types";
import { TEMPLATE_BY_KIND } from "@/lib/scenarios";
import { generateJSON } from "@/lib/ai/gemini";

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

function guessKind(prompt: string): ScenarioKind {
  const p = prompt.toLowerCase();
  if (/(heat|cool|hot|humidex|temperature|air condition|summer|extreme weather)/.test(p)) return "heat";
  if (/(rent|housing|evict|renovict|tenant|landlord|afford|apartment|home)/.test(p)) return "housing";
  return "transit";
}

/** Without AI, read a few obvious levers straight from the prompt. */
function offlineParams(kind: ScenarioKind, prompt: string): Record<string, unknown> {
  const p = prompt.toLowerCase();
  const dollars = Number(p.match(/\$\s?(\d{2,4})/)?.[1]);
  if (kind === "transit") {
    const out: Record<string, unknown> = {};
    if (/free/.test(p)) out.fare = 0;
    else if (/(cheaper|half|discount)/.test(p)) out.fare = 1.65;
    if (/(bus lane|red lane|priority|rapidto|transit lane)/.test(p)) Object.assign(out, { busSavingMin: 8.5, carPenaltyMin: 6.5, removedStopWalkMin: 2 });
    if (!Object.keys(out).length) Object.assign(out, { busSavingMin: 4, carPenaltyMin: 2 });
    return out;
  }
  if (kind === "housing") {
    const out: Record<string, unknown> = { policy: {} as Record<string, unknown> };
    const pol = out.policy as Record<string, unknown>;
    if (Number.isFinite(dollars)) pol.benefitMonthly = dollars;
    if (/(acqui|non-profit|nonprofit|buy)/.test(p)) pol.protectedShare = 0.8;
    if (/(benefit|allowance|supplement)/.test(p) && !Number.isFinite(dollars)) pol.benefitMonthly = 300;
    return out;
  }
  const out: Record<string, unknown> = {};
  if (/(free (ttc|transit|ride))/.test(p)) out.freeTransitToCooling = true;
  if (/(check|outreach|door|call)/.test(p)) out.outreachCoverage = 0.9;
  return out;
}

interface GeminiScenario {
  kind: ScenarioKind;
  title: string;
  shortTitle: string;
  tagline: string;
  civicQuestion: string;
  baselineDescription: string;
  policyName: string;
  policyDescription: string;
  enactLabel: string;
  events: { period: number; title: string; description: string; severity: Severity; arm: "baseline" | "policy" | "both" }[];
  params: Record<string, unknown>;
}

function build(kind: ScenarioKind, prompt: string, g?: Partial<GeminiScenario>): Scenario {
  const t = structuredClone(TEMPLATE_BY_KIND[kind]) as Scenario;
  const N = t.periodLabels.length;
  const p = g?.params ?? {};
  let params = t.params;

  if (kind === "transit") {
    const b = t.params as TransitParams;
    // Custom transit ideas start from "no road change"; only what the idea changes is set.
    params = {
      ...b,
      busSavingMin: clamp(p.busSavingMin, 0, 20, 0),
      carPenaltyMin: clamp(p.carPenaltyMin, 0, 15, 0),
      removedStopWalkMin: clamp(p.removedStopWalkMin, 0, 5, 0),
      rampPeriods: Math.round(clamp(p.rampPeriods, 1, 6, b.rampPeriods)),
      policyFare: p.fare === undefined ? undefined : clamp(p.fare, 0, 5, b.fare),
    };
  } else if (kind === "housing") {
    const b = t.params as HousingParams;
    const bp = (p.policy as Record<string, unknown>) ?? p;
    params = {
      ...b,
      baselineIncreasePct: clamp(p.baselineIncreasePct, 0, 0.25, b.baselineIncreasePct),
      normalIncreasePct: clamp(p.normalIncreasePct, 0, 0.1, b.normalIncreasePct),
      transitPassMonthly: clamp(p.transitPassMonthly, 0, 300, b.transitPassMonthly),
      policy: {
        protectedShare: clamp(bp.protectedShare, 0, 1, b.policy.protectedShare),
        benefitMonthly: clamp(bp.benefitMonthly, 0, 1000, b.policy.benefitMonthly),
        benefitIncomeCeilingMonthly: clamp(bp.benefitIncomeCeilingMonthly, 1000, 10000, b.policy.benefitIncomeCeilingMonthly),
        benefitBurdenTrigger: clamp(bp.benefitBurdenTrigger, 0.3, 0.8, b.policy.benefitBurdenTrigger),
      },
    };
  } else {
    const b = t.params as HeatParams;
    const hx = Array.isArray(p.humidex) && p.humidex.length === N ? (p.humidex as unknown[]).map((v, i) => clamp(v, 18, 50, b.humidex[i])) : b.humidex;
    params = {
      ...b,
      humidex: hx,
      policy: {
        outreachFromPeriod: Math.round(clamp(p.outreachFromPeriod, 1, N, b.policy.outreachFromPeriod)),
        outreachCoverage: clamp(p.outreachCoverage, 0, 1, b.policy.outreachCoverage),
        freeTransitToCooling: typeof p.freeTransitToCooling === "boolean" ? p.freeTransitToCooling : b.policy.freeTransitToCooling,
      },
    };
  }

  const events: ScenarioEvent[] = Array.isArray(g?.events)
    ? g!.events
        .filter((e) => e && e.title && e.description)
        .slice(0, 10)
        .map((e) => ({
          period: Math.round(clamp(e.period, 1, N, 1)),
          title: String(e.title).slice(0, 80),
          description: String(e.description).slice(0, 240),
          severity: (["info", "low", "medium", "high", "critical"].includes(e.severity) ? e.severity : "info") as Severity,
          arm: ["baseline", "policy", "both"].includes(e.arm) ? e.arm : "policy",
        }))
    : [
        ...t.events.filter((e) => e.arm === "baseline"),
        { period: 1, arm: "policy" as const, severity: "info" as const, title: "Policy takes effect", description: prompt.slice(0, 240) },
      ];

  let overlays = t.overlays;
  if (kind === "transit" && (params as TransitParams).busSavingMin === 0) {
    overlays = t.overlays
      .filter((o) => o.id === "jane-today")
      .map((o) => ({ ...o, arm: "both" as const, label: "Jane Street (stand-in corridor for this sketch)" }));
  }

  return {
    ...t,
    overlays,
    id: `custom-${Date.now().toString(36)}`,
    isCustom: true,
    customPrompt: prompt,
    title: g?.title?.slice(0, 90) || `What if: ${prompt.slice(0, 70)}`,
    shortTitle: g?.shortTitle?.slice(0, 28) || "Custom scenario",
    tagline: g?.tagline?.slice(0, 160) || t.tagline,
    civicQuestion: g?.civicQuestion?.slice(0, 400) || prompt,
    tracks: t.tracks,
    baseline: { name: "Status quo", description: g?.baselineDescription?.slice(0, 300) || t.baseline.description },
    policy: {
      name: g?.policyName?.slice(0, 80) || prompt.slice(0, 60),
      description: g?.policyDescription?.slice(0, 400) || prompt,
      enactLabel: g?.enactLabel?.slice(0, 32) || "Enact policy",
    },
    params,
    events,
    limitations: [
      `Custom scenario generated by AI from: "${prompt}". It reuses Ripple's ${kind} model${kind === "transit" ? " and the Jane Street corridor as a stand-in for exposure" : ""}, so treat it as a rough sketch.`,
      ...t.limitations,
    ],
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const prompt = String(body?.prompt ?? "").trim().slice(0, 300);
  if (prompt.length < 6) return NextResponse.json({ error: "Describe a policy in a few words." }, { status: 400 });

  const system = `You turn a resident's plain-English Toronto policy idea into parameters for a civic simulation.
Pick "kind": "transit" (bus/bike lanes, fares, road space — modelled on the Jane Street corridor, 12 months),
"housing" (rents, evictions, renter protections, housing benefits — 12 months), or "heat" (extreme heat response — 10 half-day periods).
Return JSON:
{"kind","title","shortTitle"(≤28 chars),"tagline","civicQuestion","baselineDescription","policyName","policyDescription","enactLabel"(≤28 chars, imperative),
 "events":[{"period","title","description","severity":"info|low|medium|high|critical","arm":"baseline|policy|both"}] (4–8 events),
 "params": {...}}
params by kind (only include what the idea changes; keep realistic):
- transit: busSavingMin (0–20, full-corridor minutes saved per trip), carPenaltyMin (0–15), removedStopWalkMin (0–5), rampPeriods (1–6), fare (policy fare, 0–5 CAD per trip; 0 = free transit; status quo is $3.30). Omit busSavingMin/carPenaltyMin unless the idea changes road space
- housing: baselineIncreasePct (0–0.25 rent jump at renewal in pressure areas), normalIncreasePct (0–0.1), transitPassMonthly (0–300), policy: {protectedShare 0–1, benefitMonthly 0–1000, benefitIncomeCeilingMonthly, benefitBurdenTrigger 0.3–0.8}
- heat: humidex (array of exactly 10 numbers 18–50), outreachFromPeriod (1–10), outreachCoverage (0–1), freeTransitToCooling (bool)
Be neutral and non-partisan. Don't invent statistics in text; describe mechanisms.`;

  const g = await generateJSON<GeminiScenario>({ system, prompt: `Idea: ${prompt}`, temperature: 0.6 });
  const kind: ScenarioKind = g?.kind && ["transit", "housing", "heat"].includes(g.kind) ? g.kind : guessKind(prompt);
  const scenario = build(kind, prompt, g ?? { params: offlineParams(kind, prompt) });
  return NextResponse.json({
    scenario,
    source: g ? "gemini" : "template",
    note: g ? undefined : "AI is offline, so this uses the closest built-in model with default settings.",
  });
}
