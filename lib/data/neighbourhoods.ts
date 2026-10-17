import type { Neighbourhood } from "@/lib/types";

/**
 * Neighbourhoods used by the personas.
 *
 * DATA: City of Toronto Neighbourhood Profiles, 2021 Census, 158-neighbourhood
 * model (25% sample data). https://open.toronto.ca/dataset/neighbourhood-profiles/
 *  - medianHouseholdIncome: "Median total income of household in 2020 ($)"
 *  - renterPct: Renter ÷ "Total - Private households by tenure"
 *  - transitCommutePct: Public transit ÷ "Total - Main mode of commuting"
 * Caveat: the Census was taken in May 2021, during COVID, so transit
 * commuting shares are lower than pre-pandemic levels.
 * Centres are approximate. Ward numbers follow Toronto's 25-ward map; some
 * neighbourhoods straddle ward lines.
 */
export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    id: "glenfield-jane-heights",
    name: "Glenfield-Jane Heights",
    ward: 7,
    wardName: "Humber River–Black Creek",
    center: { lat: 43.7465, lng: -79.5155 },
    indicators: { medianHouseholdIncome: 70500, renterPct: 0.482, transitCommutePct: 0.276 },
    dataStatus: "verified",
  },
  {
    id: "black-creek",
    name: "Black Creek",
    ward: 7,
    wardName: "Humber River–Black Creek",
    center: { lat: 43.7645, lng: -79.5215 },
    indicators: { medianHouseholdIncome: 65000, renterPct: 0.674, transitCommutePct: 0.293 },
    dataStatus: "verified",
  },
  {
    id: "weston",
    name: "Weston",
    ward: 5,
    wardName: "York South–Weston",
    center: { lat: 43.7005, lng: -79.5165 },
    indicators: { medianHouseholdIncome: 64500, renterPct: 0.645, transitCommutePct: 0.295 },
    dataStatus: "verified",
  },
  {
    id: "mount-dennis",
    name: "Mount Dennis",
    ward: 5,
    wardName: "York South–Weston",
    center: { lat: 43.6885, lng: -79.4995 },
    indicators: { medianHouseholdIncome: 70500, renterPct: 0.525, transitCommutePct: 0.310 },
    dataStatus: "verified",
  },
  {
    id: "rockcliffe-smythe",
    name: "Rockcliffe-Smythe",
    ward: 5,
    wardName: "York South–Weston",
    center: { lat: 43.6745, lng: -79.4935 },
    indicators: { medianHouseholdIncome: 69000, renterPct: 0.438, transitCommutePct: 0.271 },
    dataStatus: "verified",
  },
  {
    id: "mount-olive",
    name: "Mount Olive-Silverstone-Jamestown",
    ward: 1,
    wardName: "Etobicoke North",
    center: { lat: 43.7465, lng: -79.5875 },
    indicators: { medianHouseholdIncome: 76500, renterPct: 0.540, transitCommutePct: 0.221 },
    dataStatus: "verified",
  },
  {
    id: "south-parkdale",
    name: "South Parkdale",
    ward: 4,
    wardName: "Parkdale–High Park",
    center: { lat: 43.6375, lng: -79.4385 },
    indicators: { medianHouseholdIncome: 57200, renterPct: 0.849, transitCommutePct: 0.419 },
    dataStatus: "verified",
  },
  {
    id: "thorncliffe-park",
    name: "Thorncliffe Park",
    ward: 15,
    wardName: "Don Valley West",
    center: { lat: 43.7055, lng: -79.3465 },
    indicators: { medianHouseholdIncome: 67000, renterPct: 0.859, transitCommutePct: 0.295 },
    dataStatus: "verified",
  },
  {
    id: "annex",
    name: "Annex",
    ward: 11,
    wardName: "University–Rosedale",
    center: { lat: 43.6705, lng: -79.4035 },
    indicators: { medianHouseholdIncome: 85000, renterPct: 0.591, transitCommutePct: 0.245 },
    dataStatus: "verified",
  },
  {
    id: "scarborough-village",
    name: "Scarborough Village",
    ward: 24,
    wardName: "Scarborough–Guildwood",
    center: { lat: 43.7385, lng: -79.2155 },
    indicators: { medianHouseholdIncome: 71500, renterPct: 0.550, transitCommutePct: 0.327 },
    dataStatus: "verified",
  },
];

export const NEIGHBOURHOOD_BY_ID: Record<string, Neighbourhood> = Object.fromEntries(
  NEIGHBOURHOODS.map((n) => [n.id, n]),
);
