// ─────────────────────────────────────────────────────────────────────────────
// Scenario atmospheres. The interface stays near-white everywhere; each scenario
// brings ONE signal colour that lights up the 3D city (streets, beams, glows),
// the resident markers and the charts. Colour = meaning, not decoration.
// ─────────────────────────────────────────────────────────────────────────────

import type { ScenarioKind } from "@/lib/types";

export interface Theme {
  name: string;
  mood: string;
  /** The scenario's signal colour. */
  accent: string;
  /** Darker shade of the accent, readable as text and lines on white. */
  deep: string;
  /** Softer tint of the accent for fills and halos. */
  soft: string;
  /** 4-step scale used for residents & data: good → neutral → warning → bad. */
  scale: { good: string; neutral: string; warn: string; bad: string };
  /** Glass-tower colours for the 3D buildings (low → tall). */
  glass: [string, string, string];
  /** Colour of light reflected on the street network. */
  streets: string;
}

const NEUTRAL = "#9fb0c8";
const WARN = "#ff9f5a";
const BAD = "#ff5470";

export const THEMES: Record<ScenarioKind | "flood", Theme> = {
  transit: {
    name: "Warm signal yellow",
    mood: "Energetic and optimistic. Corridors light up and trips flow along fine moving lines.",
    accent: "#F6C945",
    deep: "#A77A06",
    soft: "#fbe7a1",
    scale: { good: "#F6C945", neutral: NEUTRAL, warn: WARN, bad: BAD },
    glass: ["#dfe6f0", "#eff3f8", "#ffffff"],
    streets: "#F6C945",
  },
  housing: {
    name: "Muted urban green",
    mood: "Restrained. Pressure builds slowly across neighbourhoods as household costs creep up.",
    accent: "#83C78A",
    deep: "#3F8F48",
    soft: "#c4e6c7",
    scale: { good: "#83C78A", neutral: "#d8b847", warn: WARN, bad: BAD },
    glass: ["#dde8e2", "#eef4f0", "#ffffff"],
    streets: "#83C78A",
  },
  heat: {
    name: "Cool cyan",
    mood: "A heat field hangs over the city; cooling centres and walking routes glow cool.",
    accent: "#38BFE5",
    deep: "#1588AE",
    soft: "#a9e6f6",
    scale: { good: "#38BFE5", neutral: "#f2b92a", warn: WARN, bad: BAD },
    glass: ["#d9e7f1", "#ecf4fa", "#ffffff"],
    streets: "#38BFE5",
  },
  flood: {
    name: "Electric water blue",
    mood: "Water rises in low-lying areas; affected streets reflect blue light.",
    accent: "#439DEB",
    deep: "#2B74C2",
    soft: "#b3d6f7",
    scale: { good: "#439DEB", neutral: NEUTRAL, warn: WARN, bad: BAD },
    glass: ["#d9e3f2", "#ebf2fb", "#ffffff"],
    streets: "#439DEB",
  },
};

export const themeFor = (kind: ScenarioKind | "flood"): Theme => THEMES[kind] ?? THEMES.transit;

/** Apply the scenario's signal colour to the whole interface (Tailwind's `accent` token). */
export function applyThemeToDocument(t: Theme) {
  try {
    const root = document.documentElement;
    root.style.setProperty("--color-accent", t.accent);
    root.style.setProperty("--color-accent-soft", t.soft);
    root.style.setProperty("--color-accent-deep", t.deep);
  } catch {
    /* SSR / no DOM */
  }
}

/** Hex colour → rgba() string with alpha. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
