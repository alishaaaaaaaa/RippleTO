import type { Scenario } from "@/lib/types";

// Approximate Jane Street alignment, Steeles → Eglinton (good enough for a city-scale map).
const STEELES = { lat: 43.7788, lng: -79.5253 };
const FINCH = { lat: 43.7579, lng: -79.5199 };
const SHEPPARD = { lat: 43.7404, lng: -79.5133 };
const WILSON = { lat: 43.7228, lng: -79.5089 };
const MAPLE_LEAF = { lat: 43.713, lng: -79.5062 };
const LAWRENCE = { lat: 43.7086, lng: -79.5047 };
const EGLINTON = { lat: 43.6875, lng: -79.502 };

export const janeRapidTO: Scenario = {
  id: "jane-rapidto",
  kind: "transit",
  title: "RapidTO: Red bus lanes on Jane Street",
  shortTitle: "Jane St bus lanes",
  tagline: "Faster buses for one of the TTC's busiest corridors — at the cost of a car lane.",
  civicQuestion:
    "Jane Street was named a RapidTO priority corridor, but the bus lanes have been in design for years. If council built them, who would actually get time back — and who would pay for it?",
  tracks: ["climate", "civic", "social"],
  periodLabels: Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`),
  mapView: { center: { lat: 43.722, lng: -79.5 }, zoom: 12 },
  overlays: [
    {
      id: "jane-north",
      kind: "line",
      label: "Bus lanes: Steeles → Wilson",
      description: "One general lane each way converted to a red bus lane.",
      coords: [STEELES, FINCH, SHEPPARD, WILSON],
      color: "#e11d48",
      arm: "policy",
    },
    {
      id: "jane-gap",
      kind: "line",
      label: "No change: Wilson → Maple Leaf (Hwy 401 ramps)",
      coords: [WILSON, MAPLE_LEAF],
      color: "#94a3b8",
      arm: "policy",
      dashed: true,
    },
    {
      id: "jane-south",
      kind: "line",
      label: "Bus lanes: Maple Leaf → Eglinton",
      description: "One general lane each way converted to a red bus lane.",
      coords: [MAPLE_LEAF, LAWRENCE, EGLINTON],
      color: "#e11d48",
      arm: "policy",
    },
    {
      id: "jane-today",
      kind: "line",
      label: "Jane Street today (mixed traffic)",
      coords: [STEELES, FINCH, SHEPPARD, WILSON, MAPLE_LEAF, LAWRENCE, EGLINTON],
      color: "#64748b",
      arm: "baseline",
    },
  ],
  events: [
    { period: 1, arm: "baseline", severity: "info", title: "Status quo", description: "35 Jane and 935 Jane Express buses share all lanes with cars. Bunching is common at rush hour." },
    { period: 6, arm: "baseline", severity: "low", title: "Traffic keeps growing", description: "New housing along the corridor adds car trips; bus trips creep slower." },
    { period: 1, arm: "policy", severity: "medium", title: "Red lanes painted", description: "Curb lanes Steeles–Wilson and Maple Leaf–Eglinton become bus-only at all times. Five local 35 Jane stops are consolidated." },
    { period: 2, arm: "policy", severity: "low", title: "Signal timing & enforcement", description: "Traffic signals retimed; enforcement blitz keeps lanes clear. Some drivers complain about congestion." },
    { period: 3, arm: "policy", severity: "info", title: "Full benefit reached", description: "Peak buses run ~8–9 min faster end to end; car trips on Jane ~6–7 min slower at peak." },
    { period: 5, arm: "policy", severity: "low", title: "Drivers re-route", description: "Some through-traffic shifts to Weston Rd and Keele St." },
    { period: 8, arm: "policy", severity: "info", title: "Ridership check-in", description: "Monitoring report shows more riders on the 35 and 935 at rush hour." },
    { period: 12, arm: "policy", severity: "info", title: "One-year review", description: "Council receives the first-year monitoring report the City has committed to." },
  ],
  baseline: {
    name: "Status quo",
    description: "No bus lanes. Buses stay in mixed traffic and slowly get slower as traffic grows.",
  },
  policy: {
    name: "Jane St RapidTO bus lanes",
    description:
      "Convert one lane each way to a bus lane between Steeles and Wilson, and between Maple Leaf/Church and Eglinton, following the City's recommended design.",
    enactLabel: "Build the bus lanes",
  },
  params: {
    kind: "transit",
    // City's published peak estimates by segment: buses ~4 + <1 + 2 + 2 min faster; cars ~2 + <1 + 1 + 3 min slower.
    busSavingMin: 8.5,
    carPenaltyMin: 6.5,
    removedStopWalkMin: 2,
    rampPeriods: 3,
    baselineDriftMinPerPeriod: 0.15,
    switchThreshold: 0.1,
    minTransitAccessToSwitch: 0.5,
    fare: 3.3,
    carCostPerKm: 0.3,
    co2KgPerCarKm: 0.19,
  },
  metrics: [
    { id: "co2_saved_t", label: "CO₂ avoided (cumulative)", format: "tonnes", better: "up", description: "Car-km avoided by people who switch to the bus × ~0.19 kg CO₂/km, summed over months." },
    { id: "car_trips_avoided", label: "Car trips avoided / week", format: "int", better: "up", description: "One-way car trips replaced by transit each week (weighted by households represented)." },
    { id: "avg_trip_change_min", label: "Avg. trip change on Jane", unit: "min", format: "decimal", better: "down", description: "Average change in one-way trip time for households that use the corridor, vs. the status quo in the same month." },
    { id: "hours_saved_week", label: "Rider hours saved / week", format: "int", better: "up", description: "Total weekly hours saved by transit riders, minus hours lost by drivers (weighted)." },
    { id: "households_better", label: "Households better off", format: "int", better: "up", description: "Weighted households whose trip is at least 1 minute faster than the status quo." },
    { id: "households_worse", label: "Households worse off", format: "int", better: "down", description: "Weighted households whose trip is at least 1 minute slower than the status quo." },
  ],
  heroMetric: "co2_saved_t",
  assumptions: [
    "Peak time changes use the City's published segment estimates for the recommended design (~8–9 min faster for buses, ~6–7 min slower for cars, end to end). Each household gets the share matching how much of their trip is on Jane.",
    "Drivers switch to transit when the bus becomes ≥10% cheaper in time-plus-money cost and transit is reasonably usable from home. Value of time scales with household income; fares count at 60% of face value because riders respond less to price than to time.",
    "Removing five local stops adds ~2 min of walking for riders who used them.",
    "Without the lanes, buses get ~0.15 min slower each month as traffic grows.",
    "Car emissions ~0.19 kg CO₂ per km; TTC fare $3.30; car operating cost $0.30/km. All approximate.",
  ],
  limitations: [
    "12 composite households can't capture every rider. Treat results as directional, not a forecast.",
    "Does not model induced demand, re-routing onto parallel streets, or reliability (bunching) gains, which are often the biggest real benefit.",
    "Household weights and neighbourhood indicators are illustrative until replaced with Census data.",
  ],
  sources: [
    { label: "City of Toronto — RapidTO: Jane Street (design, segment time estimates)", url: "https://www.toronto.ca/services-payments/streets-parking-transportation/transportation-projects/rapidto/rapidto-jane-street/" },
    { label: "UrbanToronto — RapidTO delays (status, July 2025)", url: "https://urbantoronto.ca/news/2025/07/not-so-rapidto-transit-priority-moves-back.58923" },
    { label: "City of Toronto Open Data portal", url: "https://open.toronto.ca/" },
    { label: "City of Toronto — Neighbourhood Profiles (2021 Census)", url: "https://www.toronto.ca/city-government/data-research-maps/neighbourhoods-communities/neighbourhood-profiles/" },
  ],
};
