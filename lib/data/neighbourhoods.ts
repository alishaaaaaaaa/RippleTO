import type { Neighbourhood } from "@/lib/types";

/**
 * Neighbourhoods used by the personas.
 *
 * ⚠️ DATA STATUS: ILLUSTRATIVE.
 * Centres are approximate. Ward numbers follow Toronto's 25-ward map but some
 * neighbourhoods straddle ward lines — confirm with the City Wards dataset.
 * Indicators are rough placeholders in a plausible range so the app works
 * out of the box. Before judging, replace them with real values from the
 * City of Toronto "Neighbourhood Profiles" (2021 Census) dataset and flip
 * `dataStatus` to "verified". See docs/DATA.md for exact steps.
 */
export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    id: "glenfield-jane-heights",
    name: "Glenfield-Jane Heights",
    ward: 7,
    wardName: "Humber River–Black Creek",
    center: { lat: 43.7465, lng: -79.5155 },
    indicators: { medianHouseholdIncome: 62000, renterPct: 0.55, transitCommutePct: 0.38 },
    dataStatus: "illustrative",
  },
  {
    id: "black-creek",
    name: "Black Creek",
    ward: 7,
    wardName: "Humber River–Black Creek",
    center: { lat: 43.7645, lng: -79.5215 },
    indicators: { medianHouseholdIncome: 55000, renterPct: 0.62, transitCommutePct: 0.4 },
    dataStatus: "illustrative",
  },
  {
    id: "weston",
    name: "Weston",
    ward: 5,
    wardName: "York South–Weston",
    center: { lat: 43.7005, lng: -79.5165 },
    indicators: { medianHouseholdIncome: 58000, renterPct: 0.6, transitCommutePct: 0.33 },
    dataStatus: "illustrative",
  },
  {
    id: "mount-dennis",
    name: "Mount Dennis",
    ward: 5,
    wardName: "York South–Weston",
    center: { lat: 43.6885, lng: -79.4995 },
    indicators: { medianHouseholdIncome: 63000, renterPct: 0.5, transitCommutePct: 0.32 },
    dataStatus: "illustrative",
  },
  {
    id: "rockcliffe-smythe",
    name: "Rockcliffe-Smythe",
    ward: 5,
    wardName: "York South–Weston",
    center: { lat: 43.6745, lng: -79.4935 },
    indicators: { medianHouseholdIncome: 72000, renterPct: 0.38, transitCommutePct: 0.26 },
    dataStatus: "illustrative",
  },
  {
    id: "mount-olive",
    name: "Mount Olive-Silverstone-Jamestown",
    ward: 1,
    wardName: "Etobicoke North",
    center: { lat: 43.7465, lng: -79.5875 },
    indicators: { medianHouseholdIncome: 66000, renterPct: 0.5, transitCommutePct: 0.27 },
    dataStatus: "illustrative",
  },
  {
    id: "south-parkdale",
    name: "South Parkdale",
    ward: 4,
    wardName: "Parkdale–High Park",
    center: { lat: 43.6375, lng: -79.4385 },
    indicators: { medianHouseholdIncome: 52000, renterPct: 0.85, transitCommutePct: 0.45 },
    dataStatus: "illustrative",
  },
  {
    id: "thorncliffe-park",
    name: "Thorncliffe Park",
    ward: 15,
    wardName: "Don Valley West",
    center: { lat: 43.7055, lng: -79.3465 },
    indicators: { medianHouseholdIncome: 57000, renterPct: 0.8, transitCommutePct: 0.4 },
    dataStatus: "illustrative",
  },
  {
    id: "annex",
    name: "Annex",
    ward: 11,
    wardName: "University–Rosedale",
    center: { lat: 43.6705, lng: -79.4035 },
    indicators: { medianHouseholdIncome: 110000, renterPct: 0.62, transitCommutePct: 0.4 },
    dataStatus: "illustrative",
  },
  {
    id: "scarborough-village",
    name: "Scarborough Village",
    ward: 24,
    wardName: "Scarborough–Guildwood",
    center: { lat: 43.7385, lng: -79.2155 },
    indicators: { medianHouseholdIncome: 60000, renterPct: 0.52, transitCommutePct: 0.3 },
    dataStatus: "illustrative",
  },
];

export const NEIGHBOURHOOD_BY_ID: Record<string, Neighbourhood> = Object.fromEntries(
  NEIGHBOURHOODS.map((n) => [n.id, n]),
);
