import type { Scenario } from "@/lib/types";
import { SCENARIO_BY_ID } from "@/lib/scenarios";

/**
 * API routes receive the scenario from the client (so custom scenarios work).
 * Built-in scenarios are always taken from the server copy; custom ones get a
 * light shape check. Returns null if the payload is unusable.
 */
export function resolveScenario(input: unknown): Scenario | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Partial<Scenario>;
  if (s.id && SCENARIO_BY_ID[s.id] && !s.isCustom) return SCENARIO_BY_ID[s.id];
  if (!s.params || !s.periodLabels?.length || !s.title || !s.metrics?.length) return null;
  if (!["transit", "housing", "heat"].includes(s.params.kind)) return null;
  if (s.periodLabels.length > 24) return null;
  return s as Scenario;
}
