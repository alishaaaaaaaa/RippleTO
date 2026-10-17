import type { CoolingSite, Scenario } from "@/lib/types";

// ⚠️ Site locations are APPROXIMATE and illustrative. Replace with the City's
// Cool Spaces / Heat Relief Network locations before judging (docs/DATA.md).
const SITES: CoolingSite[] = [
  { id: "lib-jane-sheppard", name: "Jane/Sheppard Library", type: "library", location: { lat: 43.7395, lng: -79.5125 }, openDay: true, openNight: false },
  { id: "lib-black-creek", name: "Black Creek Library", type: "library", location: { lat: 43.7585, lng: -79.5205 }, openDay: true, openNight: false },
  { id: "cc-driftwood", name: "Driftwood Community Centre", type: "community centre", location: { lat: 43.7665, lng: -79.5135 }, openDay: true, openNight: false, policyOpensNight: true },
  { id: "lib-weston", name: "Weston Library", type: "library", location: { lat: 43.7005, lng: -79.5145 }, openDay: true, openNight: false },
  { id: "lib-mount-dennis", name: "Mount Dennis Library", type: "library", location: { lat: 43.6875, lng: -79.4975 }, openDay: true, openNight: false },
  { id: "lib-parkdale", name: "Parkdale Library", type: "library", location: { lat: 43.6405, lng: -79.4325 }, openDay: true, openNight: false },
  { id: "lib-thorncliffe", name: "Thorncliffe Library", type: "library", location: { lat: 43.7045, lng: -79.3455 }, openDay: true, openNight: false },
  { id: "civic-metro-hall", name: "Metro Hall (24-hour cooling)", type: "civic", location: { lat: 43.6455, lng: -79.3895 }, openDay: true, openNight: true },
  { id: "mall-yorkdale", name: "Yorkdale (mall)", type: "mall", location: { lat: 43.7255, lng: -79.4525 }, openDay: true, openNight: false },
  { id: "lib-cedarbrae", name: "Cedarbrae Library", type: "library", location: { lat: 43.7565, lng: -79.2265 }, openDay: true, openNight: false },
  // Policy-only additions targeted at gaps
  { id: "pop-jane-finch", name: "Pop-up cooling hub — Jane & Finch", type: "pop-up", location: { lat: 43.7565, lng: -79.5175 }, openDay: true, openNight: true, policyOnly: true },
  { id: "pop-thorncliffe", name: "Night cooling hub — Thorncliffe Park", type: "pop-up", location: { lat: 43.7065, lng: -79.3485 }, openDay: true, openNight: true, policyOnly: true },
  { id: "pop-scarb-village", name: "Pop-up cooling hub — Scarborough Village", type: "pop-up", location: { lat: 43.7405, lng: -79.2165 }, openDay: true, openNight: true, policyOnly: true },
  { id: "pop-rockcliffe", name: "Seniors' cooling room — Rockcliffe", type: "pop-up", location: { lat: 43.6775, lng: -79.4945 }, openDay: true, openNight: false, policyOnly: true },
];

const LABELS = ["Day 1 · day", "Day 1 · night", "Day 2 · day", "Day 2 · night", "Day 3 · day", "Day 3 · night", "Day 4 · day", "Day 4 · night", "Day 5 · day", "Day 5 · night"];

export const heatWave: Scenario = {
  id: "heat-wave",
  kind: "heat",
  title: "Five-day extreme heat warning",
  shortTitle: "Heat wave",
  tagline: "Toronto has 500+ cool spaces. Can the people who need them most actually get to one?",
  civicQuestion:
    "During a five-day heat warning, seniors living alone and people in tower apartments without air conditioning face the highest risk — especially overnight, when most cooling sites are closed. Where are the gaps, and which response closes them?",
  tracks: ["health", "climate", "civic", "social"],
  periodLabels: LABELS,
  mapView: { center: { lat: 43.71, lng: -79.42 }, zoom: 11 },
  overlays: SITES.map((s) => ({
    id: s.id,
    kind: "point" as const,
    label: s.name,
    description: `${s.type}${s.openNight ? " · open overnight" : " · daytime only"}${s.policyOnly ? " · opened by the response plan" : ""}`,
    coords: [s.location],
    color: s.policyOnly ? "#06b6d4" : "#38bdf8",
    arm: s.policyOnly ? ("policy" as const) : ("both" as const),
  })),
  events: [
    { period: 1, arm: "both", severity: "medium", title: "Heat warning issued", description: "Humidex in the mid-30s. Cooling sites open during regular hours." },
    { period: 3, arm: "both", severity: "high", title: "Extended heat warning", description: "Humidex near 40. Overnight lows stay above 23°C, so apartments don't cool down." },
    { period: 5, arm: "both", severity: "critical", title: "Peak day", description: "Humidex 42. Paramedics report a rise in heat-related calls." },
    { period: 6, arm: "baseline", severity: "high", title: "Third hot night", description: "Most cooling sites are closed overnight. Tower apartments stay above 30°C indoors." },
    { period: 1, arm: "policy", severity: "info", title: "Extreme Heat Response activated", description: "Pop-up hubs open in high-risk areas; community centres extend to overnight; free TTC rides to cool spaces." },
    { period: 2, arm: "policy", severity: "info", title: "Wellness checks begin", description: "Outreach teams and volunteers call and door-knock seniors living alone and tower residents without AC." },
    { period: 9, arm: "both", severity: "low", title: "Break in the heat", description: "Temperatures start to drop. Warning ends after Day 5." },
  ],
  baseline: {
    name: "Regular cooling network",
    description: "Libraries, community centres and malls open during normal daytime hours. One 24-hour civic site downtown.",
  },
  policy: {
    name: "Extreme Heat Response Plan",
    description:
      "Open pop-up cooling hubs where the gaps are, keep key community centres open overnight, give free TTC rides to cool spaces, and run proactive wellness checks for seniors living alone and tower residents without AC.",
    enactLabel: "Activate heat response",
  },
  params: {
    kind: "heat",
    humidex: [36, 27, 39, 29, 42, 31, 40, 30, 34, 24],
    isNight: [false, true, false, true, false, true, false, true, false, true],
    sites: SITES,
    policy: { outreachFromPeriod: 2, outreachCoverage: 0.8, freeTransitToCooling: true },
  },
  metrics: [
    { id: "residents_high_risk", label: "Households at high heat risk", format: "int", better: "down", description: "Weighted households at high or critical heat-illness risk this period." },
    { id: "residents_critical", label: "Households at critical risk", format: "int", better: "down", description: "Weighted households at critical risk — the group most likely to need paramedics." },
    { id: "cant_reach_cooling", label: "No AC & can't reach a cool space", format: "int", better: "down", description: "Weighted households without AC whose nearest open cool space is beyond what they can reach." },
    { id: "avg_distance_km", label: "Avg. distance to nearest open site", format: "km", better: "down", description: "For households without AC." },
    { id: "outreach_contacts", label: "Wellness checks completed", format: "int", better: "up", description: "Weighted households contacted by outreach (cumulative)." },
    { id: "sites_open", label: "Cool spaces open", format: "int", better: "up", description: "Sites in this model open during this period." },
  ],
  heroMetric: "residents_high_risk",
  assumptions: [
    "Household weights come from 2021 Census counts: neighbourhood households × the share matching each resident's tenure, household size and age group (shares treated as independent, so weights are approximate).",
    "Risk rises with humidex, no air conditioning, age 65+, living alone, chronic illness and living on a high floor. It builds up over consecutive hot periods without relief.",
    "Indoor heat lingers overnight, so night periods still carry risk even when outdoor humidex drops.",
    "A household can reach a site within their walking range, or within ~3 km if they have a car or (under the policy) free transit.",
    "Seniors living alone usually don't seek out cooling unless someone contacts them; outreach reaches ~80% of at-risk households.",
  ],
  limitations: [
    "Not a medical model. It shows relative risk and access gaps, not health outcomes for any individual.",
    "Site list is a small, approximate sample of the City's 500+ cool spaces.",
    "Composite households weighted with 2021 Census data. Results are directional, not a forecast.",
    "2021 Census was taken in May 2021, during COVID, so transit commuting shares are lower than usual.",
  ],
  sources: [
    { label: "City of Toronto Open Data — Neighbourhood Profiles, 2021 Census (158-neighbourhood model)", url: "https://open.toronto.ca/dataset/neighbourhood-profiles/" },
    { label: "City of Toronto — Cool spaces near you (Heat Relief Network)", url: "https://www.toronto.ca/community-people/health-wellness-care/health-programs-advice/hot-weather/cool-spaces-near-you" },
    { label: "U of T / Esri — Cooling locations for the senior population in Toronto", url: "https://ecce.esri.ca/blog/uoft-blog/2020/10/22/cooling-locations-for-the-senior-population-in-toronto/" },
        { label: "City of Toronto Open Data portal", url: "https://open.toronto.ca/" },
  ],
};
