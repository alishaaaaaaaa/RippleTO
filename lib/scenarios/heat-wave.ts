import type { CoolingSite, Scenario } from "@/lib/types";

// Library sites: real branch locations and hours from Toronto Public Library's
// "Branch General Information" dataset (City of Toronto Open Data). Every branch
// closes by 8:30 p.m., so all are daytime-only. The community centre, Metro Hall
// and Yorkdale entries are approximate.
const SITES: CoolingSite[] = [
  // Real Toronto Public Library branches: the two nearest to each resident's home
  // 2990 Islington Avenue, Toronto, ON, M9L 2K6 · Mon 10 a.m. to 8:30 p.m.; Tue 12:30 p.m. to 8:30 p.m.; Wed 10 a.m. to 6 p.m.; Thu 12:30 p.m. to 8:30 p.m.; Fri 10 a.m. to 6 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-humber-summit", name: "Humber Summit Library", type: "library", location: { lat: 43.75906, lng: -79.57161 }, openDay: true, openNight: false },
  // 1785 Finch Avenue West, Toronto, ON, M3N 1M6 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 8:30 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-york-woods", name: "York Woods Library", type: "library", location: { lat: 43.75892, lng: -79.50731 }, openDay: true, openNight: false },
  // Guildwood Plaza, 123 Guildwood Parkway, Toronto, ON, M1E 4V2 · Mon Closed; Tue 12:30 p.m. to 8:30 p.m.; Wed 10 a.m. to 6 p.m.; Thu 12:30 p.m. to 8:30 p.m.; Fri 10 a.m. to 6 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-guildwood", name: "Guildwood Library", type: "library", location: { lat: 43.74704, lng: -79.19954 }, openDay: true, openNight: false },
  // 1515 Albion Road, Toronto, ON, M9V 1B2 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 8:30 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-albion", name: "Albion Library", type: "library", location: { lat: 43.73999, lng: -79.5845 }, openDay: true, openNight: false },
  // 1906 Sheppard Avenue West, Toronto, ON, M3L 1Y7 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 8:30 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-jane-sheppard", name: "Jane/Sheppard Library", type: "library", location: { lat: 43.73996, lng: -79.5101 }, openDay: true, openNight: false },
  // 3017 Kingston Road, Toronto, ON, M1M 1P1 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 8:30 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-cliffcrest", name: "Cliffcrest Library", type: "library", location: { lat: 43.72566, lng: -79.23049 }, openDay: true, openNight: false },
  // North York Sheridan Mall, 1700 Wilson Avenue Unit 63-64, Toronto, ON, M3L 1B2 · Mon 9 a.m. to 8 p.m.; Tue 9 a.m. to 8 p.m.; Wed 9 a.m. to 8 p.m.; Thu 9 a.m. to 8 p.m.; Fri 9 a.m. to 8 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-black-creek", name: "Black Creek Library", type: "library", location: { lat: 43.72156, lng: -79.5113 }, openDay: true, openNight: false },
  // 165 McRae Drive, Toronto, ON, M4G 1S8 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 5 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-leaside", name: "Leaside Library", type: "library", location: { lat: 43.70641, lng: -79.36761 }, openDay: true, openNight: false },
  // 48 Thorncliffe Park Drive, Toronto, ON, M4H 1J7 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 8:30 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-thorncliffe", name: "Thorncliffe Library", type: "library", location: { lat: 43.70297, lng: -79.34252 }, openDay: true, openNight: false },
  // 2 King Street, Toronto, ON, M9N 1K9 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 8:30 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-weston", name: "Weston Library", type: "library", location: { lat: 43.70171, lng: -79.52071 }, openDay: true, openNight: false },
  // 1123 Weston Road, Toronto, ON, M6N 3S3 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 8:30 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-mount-dennis", name: "Mount Dennis Library", type: "library", location: { lat: 43.68659, lng: -79.48828 }, openDay: true, openNight: false },
  // 120 Trowell Avenue, Toronto, ON, M6M 1L7 · Mon 10 a.m. to 8:30 p.m.; Tue 12:30 p.m. to 8:30 p.m.; Wed 10 a.m. to 6 p.m.; Thu 12:30 p.m. to 8:30 p.m.; Fri 10 a.m. to 6 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-evelyn-gregory", name: "Evelyn Gregory Library", type: "library", location: { lat: 43.68631, lng: -79.47233 }, openDay: true, openNight: false },
  // 10 Spadina Road, Toronto, ON, M5R 2S7 · Mon 10 a.m. to 8:30 p.m.; Tue 12:30 p.m. to 8:30 p.m.; Wed 10 a.m. to 6 p.m.; Thu 12:30 p.m. to 8:30 p.m.; Fri 10 a.m. to 6 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-spadina-road", name: "Spadina Road Library", type: "library", location: { lat: 43.66767, lng: -79.40462 }, openDay: true, openNight: false },
  // 620 Jane Street, Toronto, ON, M6S 4A6 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 8:30 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-daniel-g-hill", name: "Daniel G. Hill Library", type: "library", location: { lat: 43.66548, lng: -79.49145 }, openDay: true, openNight: false },
  // 560 Palmerston Avenue, Toronto, ON, M6G 2P7 · Mon 10 a.m. to 8:30 p.m.; Tue 12:30 p.m. to 8:30 p.m.; Wed 10 a.m. to 6 p.m.; Thu 12:30 p.m. to 8:30 p.m.; Fri 10 a.m. to 6 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-palmerston", name: "Palmerston Library", type: "library", location: { lat: 43.66511, lng: -79.41414 }, openDay: true, openNight: false },
  // 228 Roncesvalles Avenue, Toronto, ON, M6R 2L7 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 5 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-high-park", name: "High Park Library", type: "library", location: { lat: 43.64513, lng: -79.44887 }, openDay: true, openNight: false },
  // 1303 Queen Street West, Toronto, ON, M6K 1L6 · Mon 9 a.m. to 8:30 p.m.; Tue 9 a.m. to 8:30 p.m.; Wed 9 a.m. to 8:30 p.m.; Thu 9 a.m. to 8:30 p.m.; Fri 9 a.m. to 8:30 p.m.; Sat 9 a.m. to 5 p.m.; Sun 12 p.m. to 5 p.m.
  { id: "lib-parkdale", name: "Parkdale Library", type: "library", location: { lat: 43.64127, lng: -79.43265 }, openDay: true, openNight: false },
  // Other sites (locations approximate)
  { id: "cc-driftwood", name: "Driftwood Community Centre", type: "community centre", location: { lat: 43.7665, lng: -79.5135 }, openDay: true, openNight: false, policyOpensNight: true },
  { id: "civic-metro-hall", name: "Metro Hall (24-hour cooling)", type: "civic", location: { lat: 43.6455, lng: -79.3895 }, openDay: true, openNight: true },
  { id: "mall-yorkdale", name: "Yorkdale (mall)", type: "mall", location: { lat: 43.7255, lng: -79.4525 }, openDay: true, openNight: false },
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
    "Cool spaces are a sample, not the City's full 500+ network: 17 real library branches (the two nearest each resident) plus a few approximate sites. The TPL branch dataset is marked retired on the Open Data portal, so check hours before relying on them.",
    "Composite households weighted with 2021 Census data. Results are directional, not a forecast.",
    "2021 Census was taken in May 2021, during COVID, so transit commuting shares are lower than usual.",
  ],
  sources: [
    { label: "Toronto Public Library — Branch General Information (City of Toronto Open Data)", url: "https://open.toronto.ca/dataset/library-branch-general-information/" },
    { label: "City of Toronto Open Data — Neighbourhood Profiles, 2021 Census (158-neighbourhood model)", url: "https://open.toronto.ca/dataset/neighbourhood-profiles/" },
    { label: "City of Toronto — Cool spaces near you (Heat Relief Network)", url: "https://www.toronto.ca/community-people/health-wellness-care/health-programs-advice/hot-weather/cool-spaces-near-you" },
    { label: "U of T / Esri — Cooling locations for the senior population in Toronto", url: "https://ecce.esri.ca/blog/uoft-blog/2020/10/22/cooling-locations-for-the-senior-population-in-toronto/" },
    { label: "City of Toronto Open Data portal", url: "https://open.toronto.ca/" },
  ],
};
