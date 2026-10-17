import type { Scenario, Track } from "@/lib/types";
import { janeRapidTO } from "./jane-rapidto";
import { rentPressure } from "./rent-pressure";
import { heatWave } from "./heat-wave";

/** Add a scenario = write one file and list it here. The engine and UI need no changes. */
export const SCENARIOS: Scenario[] = [janeRapidTO, rentPressure, heatWave];

export const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

export const TEMPLATE_BY_KIND = {
  transit: janeRapidTO,
  housing: rentPressure,
  heat: heatWave,
} as const;

export const TRACK_LABELS: Record<Track, string> = {
  climate: "Climate & Sustainability",
  fintech: "Sustainable FinTech",
  health: "Healthcare & Well-being",
  social: "AI for Social Impact",
  civic: "School of Cities",
};
