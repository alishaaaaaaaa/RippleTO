// ─────────────────────────────────────────────────────────────────────────────
// Ripple TO — shared types
// Mirrors Emergent's lib/types/ttx.ts idea: one typed data model that the
// engine, the API routes, the store and the UI all agree on.
// ─────────────────────────────────────────────────────────────────────────────

export type Track = "climate" | "fintech" | "health" | "social" | "civic";
export type ScenarioKind = "transit" | "housing" | "heat";
export type Arm = "baseline" | "policy";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Impact = "better" | "same" | "worse";

export interface LatLng {
  lat: number;
  lng: number;
}

// ── Places ──────────────────────────────────────────────────────────────────

export interface Neighbourhood {
  id: string;
  name: string;
  ward: number;
  wardName: string;
  center: LatLng;
  /** Context shown on persona cards. Replace with City Neighbourhood Profiles (see docs/DATA.md). */
  indicators: {
    medianHouseholdIncome: number; // CAD / year
    renterPct: number; // 0–1
    transitCommutePct: number; // 0–1
  };
  dataStatus: "illustrative" | "verified";
}

// ── People ──────────────────────────────────────────────────────────────────

export type Mode = "car" | "transit" | "bike" | "walk";

/**
 * A persona is a *composite* household built from neighbourhood-level patterns.
 * It is NOT a real person and NOT a prediction about any individual.
 * We intentionally do not model race or ethnicity — only circumstances
 * (income, tenure, car access, age, health, housing type) that drive outcomes.
 */
export interface Persona {
  id: string;
  name: string; // fictional first name
  age: number;
  household: string; // e.g. "Single parent, 2 kids"
  householdSize: number;
  occupation: string;
  neighbourhoodId: string;
  home: LatLng;
  destination: LatLng & { label: string };
  bio: string;
  /** How many real households this composite stands in for (illustrative weight). */
  represents: number;

  money: {
    incomeMonthly: number; // household, before tax
    tenure: "rent" | "own" | "social";
    housingCostMonthly: number; // rent or carrying cost
    leaseRenewalPeriod?: number; // month (1–12) the lease renews, renters only
  };

  travel: {
    hasCar: boolean;
    mode: Mode;
    tripsPerWeek: number; // round trips
    tripKm: number; // one way
    transitMin: number; // one way, today
    carMin: number; // one way, today (if they had a car)
    /** Share (0–1) of the trip that runs on the Jane St corridor. */
    janeCorridorShare: number;
    /** Uses a local 35 Jane stop that the proposal would remove. */
    usesRemovedStop: boolean;
    /** 0–1: how usable transit is from home (frequency, walk to stop, transfers). */
    transitAccess: number;
  };

  heat: {
    hasAC: boolean;
    livesAlone: boolean;
    floor: number; // 0 = house / ground
    maxWalkKm: number; // how far they can comfortably get on foot in heat
    chronicCondition: boolean;
    condition?: string;
  };
}

// ── Scenarios ───────────────────────────────────────────────────────────────

export interface ScenarioEvent {
  period: number; // 1-based
  title: string;
  description: string;
  severity: Severity;
  arm: Arm | "both";
}

export interface MapOverlay {
  id: string;
  kind: "line" | "point";
  label: string;
  description?: string;
  coords: LatLng[];
  color: string;
  arm: Arm | "both";
  dashed?: boolean;
}

export type MetricFormat = "int" | "pct" | "money" | "decimal" | "tonnes" | "min" | "km";

export interface MetricDef {
  id: string;
  label: string;
  unit?: string;
  format: MetricFormat;
  /** Which direction is good — used to colour deltas green/red. */
  better: "up" | "down";
  description: string;
}

export interface TransitParams {
  kind: "transit";
  busSavingMin: number; // full-corridor peak saving per one-way trip
  carPenaltyMin: number; // full-corridor peak delay per one-way trip for drivers
  removedStopWalkMin: number;
  rampPeriods: number; // periods until full benefit
  baselineDriftMinPerPeriod: number; // status quo: buses get slower as traffic grows
  switchThreshold: number; // how much cheaper transit must be (0–1) before a driver switches
  minTransitAccessToSwitch: number;
  fare: number; // per one-way trip, status quo
  /** Fare under the policy, if the policy changes fares (e.g. 0 = free transit). Defaults to `fare`. */
  policyFare?: number;
  carCostPerKm: number;
  co2KgPerCarKm: number;
}

export interface HousingParams {
  kind: "housing";
  pressureNeighbourhoods: string[];
  baselineIncreasePct: number; // at renewal, in pressure areas
  normalIncreasePct: number; // at renewal elsewhere (~provincial guideline)
  transitPassMonthly: number;
  carCostMonthly: number;
  burdenThreshold: number; // housing+transport share considered "cost-burdened"
  displacementThreshold: number; // share that forces a move if sustained
  policy: {
    protectedShare: number; // share of pressure-area renters whose increase is held to normal (non-profit acquisition / anti-renoviction)
    benefitMonthly: number; // portable housing benefit
    benefitIncomeCeilingMonthly: number;
    benefitBurdenTrigger: number;
  };
}

export interface CoolingSite {
  id: string;
  name: string;
  type: "library" | "community centre" | "civic" | "mall" | "pop-up";
  location: LatLng;
  openDay: boolean;
  openNight: boolean;
  policyOnly?: boolean; // opened only under the policy
  policyOpensNight?: boolean; // extends hours under the policy
}

export interface HeatParams {
  kind: "heat";
  humidex: number[]; // one per period
  isNight: boolean[]; // one per period
  sites: CoolingSite[];
  policy: {
    outreachFromPeriod: number; // door-knocking/calls to seniors living alone & high-rise residents start
    outreachCoverage: number; // 0–1 share of at-risk households reached
    freeTransitToCooling: boolean;
  };
}

export type ScenarioParams = TransitParams | HousingParams | HeatParams;

export interface Source {
  label: string;
  url: string;
}

export interface Scenario {
  id: string;
  kind: ScenarioKind;
  title: string;
  shortTitle: string;
  tagline: string;
  civicQuestion: string;
  tracks: Track[];
  periodLabels: string[]; // length = number of periods
  mapView: { center: LatLng; zoom: number };
  overlays: MapOverlay[];
  events: ScenarioEvent[];
  baseline: { name: string; description: string };
  policy: { name: string; description: string; enactLabel: string };
  params: ScenarioParams;
  metrics: MetricDef[];
  heroMetric: string;
  assumptions: string[];
  limitations: string[];
  sources: Source[];
  isCustom?: boolean;
  customPrompt?: string;
}

// ── Engine output ───────────────────────────────────────────────────────────

export type HeatRisk = "low" | "moderate" | "high" | "critical";

export interface PersonaState {
  personaId: string;
  period: number;
  decision: string; // machine code, e.g. "switched_to_transit"
  decisionLabel: string; // human label
  impact: Impact; // vs the baseline arm in the same period
  /** Plain-language reasons the rule model produced this outcome (the "why"). */
  drivers: string[];
  mode?: Mode;
  tripMin?: number;
  monthlyCost?: number;
  burdenPct?: number;
  heatRisk?: HeatRisk;
  nearestOpenSiteKm?: number;
  atCoolingSite?: string;
  movedOut?: boolean;
  position: LatLng;
}

export interface RunResult {
  arm: Arm;
  /** states[periodIndex][personaIndex] */
  states: PersonaState[][];
  /** metrics[periodIndex][metricId] */
  metrics: Record<string, number>[];
}

export interface Simulation {
  scenarioId: string;
  baseline: RunResult;
  policy: RunResult;
}

export interface AgentNarrative {
  personaId: string;
  /** One entry per period, for the policy arm. */
  periods: { period: number; thought: string; sentiment: Sentiment }[];
  /** One sentence on how life would have gone without the policy. */
  baselineReflection: string;
  source: "gemini" | "template";
}

export type Sentiment = "hopeful" | "relieved" | "calm" | "concerned" | "frustrated" | "anxious" | "distressed";

export interface ChatMessage {
  role: "user" | "persona";
  text: string;
}
