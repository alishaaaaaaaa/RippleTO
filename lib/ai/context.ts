// Builds compact, factual context blocks for prompts. Keeping prompts grounded
// in engine output is what stops the model from inventing numbers.

import type { Persona, PersonaState, Scenario } from "@/lib/types";
import { NEIGHBOURHOOD_BY_ID } from "@/lib/data/neighbourhoods";

export function personaCard(p: Persona): string {
  const n = NEIGHBOURHOOD_BY_ID[p.neighbourhoodId];
  return [
    `Name: ${p.name}, age ${p.age}. ${p.household}. ${p.occupation}.`,
    `Lives in ${n?.name ?? p.neighbourhoodId} (Ward ${n?.ward} ${n?.wardName}).`,
    `Background: ${p.bio}`,
    `Household income ~$${p.money.incomeMonthly.toLocaleString()}/month. Housing: ${p.money.tenure === "rent" ? `renter, $${p.money.housingCostMonthly}/mo` : p.money.tenure === "own" ? "owner" : "community housing (rent-geared-to-income)"}.`,
    `Gets around by ${p.travel.mode}${p.travel.hasCar ? " (has a car)" : " (no car)"}; usual trip to ${p.destination.label}.`,
    `Home has ${p.heat.hasAC ? "air conditioning" : "no air conditioning"}${p.heat.floor ? `, floor ${p.heat.floor}` : ""}${p.heat.chronicCondition && p.heat.condition ? `; has ${p.heat.condition}` : ""}.`,
  ].join("\n");
}

export function stateLine(s: Scenario, st: PersonaState): string {
  const bits = [`${s.periodLabels[st.period - 1]}: ${st.decisionLabel}.`];
  if (st.tripMin !== undefined) bits.push(`Trip ${st.tripMin} min.`);
  if (st.burdenPct !== undefined) bits.push(`Housing+transport = ${st.burdenPct}% of income.`);
  if (st.heatRisk) bits.push(`Heat risk: ${st.heatRisk}.`);
  if (st.drivers.length) bits.push(`Why: ${st.drivers.join(" ")}`);
  return bits.join(" ");
}

export function scenarioBrief(s: Scenario): string {
  return [
    `Scenario: ${s.title}. ${s.civicQuestion}`,
    `Status quo: ${s.baseline.description}`,
    `Policy: ${s.policy.name} — ${s.policy.description}`,
  ].join("\n");
}

export const GROUNDING_RULES = `Rules:
- Only use facts given to you. Never invent numbers, places, programs or people.
- You are a fictional composite resident used in a civic simulation, not a real person.
- Speak plainly, like a real Torontonian would. No policy jargon. No political endorsements of candidates or parties.
- Do not reference race, ethnicity or religion.`;
