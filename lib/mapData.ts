// Shared data for both 3D views (Model and Real 3D): camera shots and the
// GeoJSON overlays built from the simulation state.

import type { HeatParams, LatLng, PersonaState, Scenario } from "@/lib/types";
import { PERSONAS } from "@/lib/data/personas";
import { openCoolingSites } from "@/lib/engine/model";
import { stateColor } from "@/lib/ui";
import type { Theme } from "@/lib/themes";

export const PITCH = 60;
export const BEARING = -12;

/** Close, tilted "hero" shots so real towers fill the frame. Custom scenarios use their template's shot. */
export const HERO: Record<string, { lat: number; lng: number; zoom: number; pitch: number; bearing: number }> = {
  transit: { lat: 43.7345, lng: -79.5128, zoom: 13.9, pitch: 62, bearing: -8 },
  housing: { lat: 43.6985, lng: -79.5105, zoom: 13.8, pitch: 60, bearing: 18 },
  heat: { lat: 43.7565, lng: -79.5195, zoom: 14.3, pitch: 63, bearing: -28 },
};
export const heroFor = (s: Scenario) => HERO[s.kind] ?? { ...s.mapView.center, zoom: s.mapView.zoom + 1.5, pitch: PITCH, bearing: BEARING };


export type Ring = [number, number][];
export type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
export const fc = (features: Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

export function polygonAround(c: LatLng, radiusM: number, sides = 6, rotate = 0): Ring {
  const ring: Ring = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((c.lat * Math.PI) / 180));
  for (let i = 0; i <= sides; i++) {
    const a = rotate + (i / sides) * Math.PI * 2;
    ring.push([c.lng + dLng * Math.cos(a), c.lat + dLat * Math.sin(a)]);
  }
  return ring;
}
export const point = (c: LatLng, props: Record<string, unknown> = {}): Feature => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Point", coordinates: [c.lng, c.lat] },
});

/** Mix a hex colour with white (amount 0–1) — beams read as light, not paint. */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

// ── Data builders ────────────────────────────────────────────────────────────

export function zonesData(s: Scenario, view: "baseline" | "policy", t: Theme) {
  if (s.kind === "heat") return fc([]);
  return fc(
    s.overlays
      .filter((o) => o.kind === "point" && (o.arm === "both" || o.arm === view))
      .map((o) => ({
        type: "Feature",
        properties: { color: t.accent, line: t.deep },
        geometry: { type: "Polygon", coordinates: [polygonAround(o.coords[0], 750, 48)] },
      })),
  );
}

export function linesData(s: Scenario, view: "baseline" | "policy", row: PersonaState[], t: Theme) {
  const features: Feature[] = s.overlays
    .filter((o) => o.kind === "line" && (o.arm === "both" || o.arm === view))
    .map((o) => {
      const lit = o.arm === "policy" || (s.kind === "housing" && o.arm === "both");
      return {
        type: "Feature",
        properties: {
          kind: lit && !o.dashed ? "corridor-lit" : "corridor",
          glow: t.accent,
          color: lit ? t.deep : "#9aa8bd",
          w: lit ? 4.5 : 3,
          o: 1,
          dashed: !!o.dashed,
        },
        geometry: { type: "LineString", coordinates: o.coords.map((c) => [c.lng, c.lat]) },
      };
    });
  PERSONAS.forEach((p, i) => {
    if (s.kind === "housing" && row[i].movedOut) {
      features.push({
        type: "Feature",
        properties: { kind: "move", color: t.scale.bad, w: 2.5, o: 0.9, dashed: true },
        geometry: { type: "LineString", coordinates: [[p.home.lng, p.home.lat], [row[i].position.lng, row[i].position.lat]] },
      });
    }
  });
  return fc(features);
}

/** Lines that animate: commutes (transit) and walking routes to cooling (heat). */
export function flowData(s: Scenario, row: PersonaState[], selected: string | null, t: Theme) {
  const features: Feature[] = [];
  PERSONAS.forEach((p, i) => {
    const st = row[i];
    const sel = selected === p.id;
    if (s.kind === "transit" && p.travel.mode !== "walk") {
      features.push({
        type: "Feature",
        properties: { color: st.impact === "worse" ? t.scale.bad : st.impact === "better" ? t.deep : "#8a99b0", w: sel ? 3.5 : 2 },
        geometry: { type: "LineString", coordinates: [[p.home.lng, p.home.lat], [p.destination.lng, p.destination.lat]] },
      });
    }
    if (s.kind === "heat" && st.atCoolingSite) {
      features.push({
        type: "Feature",
        properties: { color: t.deep, w: sel ? 4 : 3 },
        geometry: { type: "LineString", coordinates: [[p.home.lng, p.home.lat], [st.position.lng, st.position.lat]] },
      });
    }
  });
  return fc(features);
}

export function sitesData(s: Scenario, view: "baseline" | "policy", period: number, t: Theme) {
  if (s.kind !== "heat") return { poly: fc([]), pts: fc([]) };
  const list = openCoolingSites(s.params as HeatParams, view, period - 1).filter(({ site }) => !(site.policyOnly && view !== "policy"));
  return {
    poly: fc(
      list.map(({ site, open }) => ({
        type: "Feature",
        properties: { color: open ? (site.policyOnly ? t.deep : t.accent) : "#cbd5e1", h: open ? 130 : 12 },
        geometry: { type: "Polygon", coordinates: [polygonAround(site.location, 70, 4, Math.PI / 4)] },
      })),
    ),
    pts: fc(list.map(({ site, open }) => point(site.location, { color: t.accent, glow: open ? 0.55 : 0 }))),
  };
}

/** A subtle temperature field: stronger on hot days, lingering at night, peaking over homes without AC. */
export function heatData(s: Scenario, period: number) {
  if (s.kind !== "heat") return fc([]);
  const prm = s.params as HeatParams;
  const hx = prm.humidex[period - 1];
  const prev = prm.humidex[period - 2] ?? hx;
  const eff = prm.isNight[period - 1] ? Math.max(hx, prev - 6) : hx;
  const w = Math.max(0, Math.min(1, (eff - 26) / 16));
  const feats: Feature[] = [];
  const c = s.mapView.center;
  for (let i = -9; i <= 9; i++) for (let j = -14; j <= 14; j++) feats.push(point({ lat: c.lat + i * 0.02, lng: c.lng + j * 0.02 }, { w: w * 0.6 }));
  PERSONAS.forEach((p) => !p.heat.hasAC && feats.push(point(p.home, { w })));
  return fc(feats);
}

export function beamHeight(s: Scenario, i: number, st: PersonaState): number {
  if (s.kind === "housing") return st.movedOut ? 200 : 200 + (st.burdenPct ?? 30) * 17;
  if (s.kind === "heat") return { low: 380, moderate: 720, high: 1080, critical: 1450 }[st.heatRisk ?? "low"];
  return 450 + (PERSONAS[i].represents / 3200) * 900;
}

export function beamsData(s: Scenario, row: PersonaState[], positions: LatLng[], selected: string | null) {
  return {
    poly: fc(
      PERSONAS.map((p, i) => {
        const sel = selected === p.id;
        return {
          type: "Feature",
          properties: { id: p.id, color: lighten(stateColor(s, row[i]), 0.25), h: beamHeight(s, i, row[i]) * (sel ? 1.2 : 1) },
          geometry: { type: "Polygon", coordinates: [polygonAround(positions[i], sel ? 26 : 15, 8)] },
        };
      }),
    ),
    pts: fc(PERSONAS.map((p, i) => point(positions[i], { color: stateColor(s, row[i]) }))),
  };
}

export const BEAM_LABEL = { transit: "households", housing: "% of income on housing + transit", heat: "heat risk" } as const;

