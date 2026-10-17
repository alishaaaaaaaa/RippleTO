// Offline fallbacks. Used when there's no GEMINI_API_KEY or a call fails, so
// the demo never breaks. They read the same engine output the AI would.

import type { AgentNarrative, Persona, PersonaState, Scenario, Sentiment, Simulation } from "@/lib/types";
import { PERSONAS } from "@/lib/data/personas";
import { NEIGHBOURHOOD_BY_ID } from "@/lib/data/neighbourhoods";
import { formatMetric } from "@/lib/format";

function sentimentFor(st: PersonaState): Sentiment {
  if (st.heatRisk === "critical") return "distressed";
  if (st.heatRisk === "high") return "anxious";
  if (st.movedOut) return "distressed";
  if (st.impact === "better") return st.period <= 2 ? "hopeful" : "relieved";
  if (st.impact === "worse") return "frustrated";
  if ((st.burdenPct ?? 0) > 50) return "concerned";
  return "calm";
}

const FIRST_PERSON: [RegExp, string][] = [
  [/^Age (\d+), lives alone\./, "I'm $1 and I live alone."],
  [/^Age (\d+)\./, "I'm $1."],
  [/^Lives alone and hasn't been contacted — unlikely to go to a cooling site on their own\./, "I live alone and nobody's checked on me. I'm not going to head out to a cooling centre on my own."],
  [/^Reached by a wellness check\./, "Someone from the City checked in on me."],
  [/^Outreach team arranged a ride to /, "An outreach team got me a ride to "],
  [/^Now shares a room/, "I'm sharing a room now,"],
  [/^Spent over/, "I was spending over"],
  [/^Spends /, "I'm spending "],
  [/^Receives /, "I'm getting "],
  [/^Gains /, "I'm getting back "],
  [/^Loses /, "I'm losing "],
  [/^Went to /, "I went to "],
  [/^Has /, "I have "],
  [/^Lives /, "I live "],
  [/^Owns their home/, "I own my home"],
  [/^Their /, "My "],
  [/^About (\d+)% of their trip/, "About $1% of my trip"],
  [/\btheir\b/g, "my"],
  [/\bthem\b/g, "me"],
];

export function firstPerson(s: string): string {
  return FIRST_PERSON.reduce((acc, [re, rep]) => acc.replace(re, rep), s);
}

/** A natural first-person line for the offline template voice. */
function voiceLine(s: Scenario, p: Persona, st: PersonaState, ref?: PersonaState): string {
  if (s.kind === "transit") {
    const d = ref && st.tripMin !== undefined && ref.tripMin !== undefined ? st.tripMin - ref.tripMin : 0;
    if (st.decisionLabel.includes("lower fare")) return "Same bus, but I'm keeping the fare money. That adds up over a month.";
    if (st.decision === "not_on_corridor") return "Honestly, this one doesn't change my day much.";
    if (p.travel.mode === "car")
      return d >= 1
        ? `Jane's about ${d} minutes slower in the car now. I get it, but the bus doesn't work for my hours.`
        : "Traffic on Jane is about the same for me so far.";
    if (d <= -1) return p.householdSize > 2 ? `The bus is ${-d} minutes faster. That's more time with my kids at night.` : `My trip is ${-d} minutes faster. I'll take it.`;
    if (d >= 1) return `My trip's ${d} minutes slower. It adds up over a week.`;
    return "My trip's about the same so far.";
  }
  if (s.kind === "housing") {
    switch (st.decision) {
      case "moved_out":
        return "We had to move further out. Rent's a bit lower, but the commute is brutal now.";
      case "doubled_up":
        return "I gave up my place. I'm sharing a room further out now.";
      case "owner":
        return "I own, so rent hikes don't hit me directly. I see my neighbours struggling though.";
      case "rgi":
        return "My rent's tied to my income, so I'm protected. Not everyone around me is.";
      case "renewed":
        return `The renewal came in at $${(st.monthlyCost ?? 0).toLocaleString()} all-in. That stings.`;
    }
    if (st.drivers.some((d) => d.includes("benefit"))) return "The housing benefit is honestly what's keeping me here.";
    return (st.burdenPct ?? 0) > 50 ? "Every month's a stretch. One surprise bill and I'm behind." : "Tight, but manageable for now.";
  }
  // heat
  if (st.heatRisk === "critical") return "I can barely breathe in here. It's been hot for days and it doesn't cool down at night.";
  if (st.atCoolingSite) return `I'm at ${st.atCoolingSite}. It's the only place I can cool down.`;
  if (st.decision === "home_ac") return "I've got AC, so I'm okay. I worry about my neighbours.";
  if (st.decision === "cant_reach") return "The nearest cool place is too far for me to get to.";
  if (st.heatRisk === "high") return "It's sweltering in here. I'm trying to keep cool with a fan and wet towels.";
  return "It's hot, but I'm managing.";
}

export function templateNarrative(s: Scenario, persona: Persona, policyStates: PersonaState[], baselineStates: PersonaState[]): AgentNarrative {
  const lastB = baselineStates[baselineStates.length - 1];
  return {
    personaId: persona.id,
    source: "template",
    periods: policyStates.map((st, i) => {
      const extra = st.drivers.find((d) => /wellness|ride|benefit|stop|protect/i.test(d));
      return {
        period: st.period,
        sentiment: sentimentFor(st),
        thought: `${voiceLine(s, persona, st, baselineStates[i])}${extra ? " " + firstPerson(extra) : ""}`.trim(),
      };
    }),
    baselineReflection: `Without it? ${voiceLine(s, persona, lastB, undefined)}`,
  };
}

export function templateInterviewReply(s: Scenario, persona: Persona, st: PersonaState | undefined, question: string, ref?: PersonaState): string {
  const q = question.toLowerCase();
  const n = NEIGHBOURHOOD_BY_ID[persona.neighbourhoodId];
  if (!st || /(who are you|about you|yourself|introduce)/.test(q)) return `I'm ${persona.name}, ${persona.age}, from ${n?.name}. ${persona.bio}`;
  const voice = voiceLine(s, persona, st, ref);
  const why = st.drivers.slice(0, 3).map(firstPerson).join(" ");
  if (/(why|how come|reason|explain)/.test(q)) return `${voice} ${why}`;
  if (/(city|change|fix|want|wish|should|ask|councillor)/.test(q)) {
    if (st.impact === "worse") return `${voice} I'd want the City to think about people in my situation, not just the averages.`;
    if (st.impact === "better") return `${voice} Keep it going, and don't let it get watered down.`;
    return `${voice} I'd ask what they're doing for people this doesn't reach.`;
  }
  return `${voice} ${st.drivers[0] ? firstPerson(st.drivers[0]) : ""}`.trim();
}

export function templateBriefing(s: Scenario, sim: Simulation, wardFilter: number | "all"): string {
  const N = s.periodLabels.length;
  const last = N - 1;
  const idx = PERSONAS.map((p, i) => ({ p, i })).filter(({ p }) => wardFilter === "all" || NEIGHBOURHOOD_BY_ID[p.neighbourhoodId]?.ward === wardFilter);
  const wardName = wardFilter === "all" ? "Toronto (city-wide)" : `Ward ${wardFilter} — ${NEIGHBOURHOOD_BY_ID[idx[0]?.p.neighbourhoodId]?.wardName ?? ""}`;
  const better = idx.filter(({ i }) => sim.policy.states[last][i].impact === "better");
  const worse = idx.filter(({ i }) => sim.policy.states[last][i].impact === "worse");
  const same = idx.filter(({ i }) => sim.policy.states[last][i].impact === "same");
  const rows = s.metrics
    .map((m) => {
      const b = sim.baseline.metrics[last][m.id];
      const p = sim.policy.metrics[last][m.id];
      return `| ${m.label} | ${formatMetric(b, m.format)} | ${formatMetric(p, m.format)} |`;
    })
    .join("\n");
  const line = ({ p, i }: { p: Persona; i: number }) => `- **${p.name}** (${p.age}, ${NEIGHBOURHOOD_BY_ID[p.neighbourhoodId]?.name}): ${sim.policy.states[last][i].decisionLabel}. ${sim.policy.states[last][i].drivers[0] ?? ""}`;

  return `# ${s.policy.name}: what it would mean for ${wardName}

*${s.periodLabels[last]} · Ripple TO simulation · composite households, illustrative data*

## The question
${s.civicQuestion}

## What changes
${s.policy.description}

## The numbers (end of simulation)
| Measure | Status quo | With policy |
|---|---|---|
${rows}

## Who comes out ahead
${better.length ? better.map(line).join("\n") : "- No simulated households in this area are clearly better off."}

## Who pays a cost
${worse.length ? worse.map(line).join("\n") : "- No simulated households in this area are clearly worse off."}

## Who isn't reached
${same.length ? same.map(line).join("\n") : "- Every simulated household here is affected in some way."}

## Questions to ask candidates in your ward
- Would you support "${s.policy.name}"? What would you change about it?
- How would you help the households who come out worse under this plan?
- Who in this ward isn't reached by it at all, and what's your plan for them?

## Limits of this simulation
${s.limitations.map((l) => `- ${l}`).join("\n")}

**Sources:** ${s.sources.map((x) => `[${x.label}](${x.url})`).join(" · ")}
`;
}
