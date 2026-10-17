import type { HeatRisk, Impact, PersonaState, Scenario, Sentiment, Severity } from "@/lib/types";

export const IMPACT_COLOR: Record<Impact, string> = {
  better: "#22c55e",
  same: "#94a3b8",
  worse: "#f97316",
};

export const RISK_COLOR: Record<HeatRisk, string> = {
  low: "#22c55e",
  moderate: "#facc15",
  high: "#f97316",
  critical: "#ef3b56",
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  info: "#38bdf8",
  low: "#94a3b8",
  medium: "#facc15",
  high: "#f97316",
  critical: "#ef3b56",
};

export const SENTIMENT_EMOJI: Record<Sentiment, string> = {
  hopeful: "🙂",
  relieved: "😌",
  calm: "😐",
  concerned: "😟",
  frustrated: "😤",
  anxious: "😰",
  distressed: "😣",
};

/** What colour a persona's pin/card should be, given the scenario and what we're viewing. */
export function stateColor(s: Scenario, st: PersonaState): string {
  if (s.kind === "heat" && st.heatRisk) return RISK_COLOR[st.heatRisk];
  if (s.kind === "housing") {
    if (st.movedOut) return "#ef3b56";
    const b = st.burdenPct ?? 0;
    if (b >= 55) return "#f97316";
    if (b >= 45) return "#facc15";
    return "#22c55e";
  }
  return IMPACT_COLOR[st.impact];
}

export function legendFor(s: Scenario): { color: string; label: string }[] {
  if (s.kind === "heat")
    return (["low", "moderate", "high", "critical"] as HeatRisk[]).map((r) => ({ color: RISK_COLOR[r], label: `${r} risk` }));
  if (s.kind === "housing")
    return [
      { color: "#22c55e", label: "< 45% of income" },
      { color: "#facc15", label: "45–55%" },
      { color: "#f97316", label: "> 55%" },
      { color: "#ef3b56", label: "displaced" },
    ];
  return [
    { color: IMPACT_COLOR.better, label: "faster trip" },
    { color: IMPACT_COLOR.same, label: "no change" },
    { color: IMPACT_COLOR.worse, label: "slower trip" },
  ];
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
