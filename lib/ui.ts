import { themeFor } from "@/lib/themes";
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

/**
 * What colour a resident's marker/card should be. Uses the scenario's theme:
 * "good" outcomes glow in the scenario colour, bad ones in warm red, so the
 * scenario colour itself reads as "this policy is working here".
 */
export function stateColor(s: Scenario, st: PersonaState): string {
  const k = themeFor(s.kind).scale;
  if (s.kind === "heat" && st.heatRisk) return { low: k.good, moderate: k.neutral, high: k.warn, critical: k.bad }[st.heatRisk];
  if (s.kind === "housing") {
    if (st.movedOut) return k.bad;
    const b = st.burdenPct ?? 0;
    if (b >= 55) return k.warn;
    if (b >= 45) return k.neutral;
    return k.good;
  }
  return st.impact === "better" ? k.good : st.impact === "worse" ? k.bad : k.neutral;
}

export function legendFor(s: Scenario): { color: string; label: string }[] {
  const k = themeFor(s.kind).scale;
  if (s.kind === "heat")
    return [
      { color: k.good, label: "low risk" },
      { color: k.neutral, label: "moderate" },
      { color: k.warn, label: "high" },
      { color: k.bad, label: "critical" },
    ];
  if (s.kind === "housing")
    return [
      { color: k.good, label: "< 45% of income" },
      { color: k.neutral, label: "45–55%" },
      { color: k.warn, label: "> 55%" },
      { color: k.bad, label: "displaced" },
    ];
  return [
    { color: k.good, label: "faster trip" },
    { color: k.neutral, label: "no change" },
    { color: k.bad, label: "slower trip" },
  ];
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
