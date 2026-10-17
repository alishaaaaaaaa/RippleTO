"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 3D city view — a light, glassy Toronto built from real OpenStreetMap buildings
// (OpenFreeMap tiles, no API key) and rendered with MapLibre GL.
//
// Each scenario has its own atmosphere (lib/themes.ts). Its signal colour lights
// the street network, the residents' light beams, and scenario-specific effects:
//   • Transit  — glowing corridor + fine animated trip lines
//   • Housing  — restrained green pressure zones that deepen month by month;
//                beams rise as household costs rise
//   • Heat     — a subtle heat field; cooling centres glow; animated walking routes
//
// If anything fails (no WebGL, tiles blocked, style won't load) it calls onFail()
// and the app falls back to the 2D map automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HeatParams, LatLng, PersonaState, Scenario } from "@/lib/types";
import { useRipple } from "@/lib/store";
import { PERSONAS } from "@/lib/data/personas";
import { openCoolingSites } from "@/lib/engine/model";
import { legendFor, stateColor } from "@/lib/ui";
import { alpha, themeFor, type Theme } from "@/lib/themes";

const STYLES = ["https://tiles.openfreemap.org/styles/positron", "https://tiles.openfreemap.org/styles/liberty"];
const LOAD_TIMEOUT_MS = 12000;

const PITCH = 55;
const BEARING = -18;
const zoom3d = (s: Scenario) => s.mapView.zoom + 0.7;

// City base palette (constant across scenarios — only the signal colour changes)
const CITY = {
  ground: "#f3f5f9",
  land: "#eef1f6",
  park: "#e5eee8",
  water: "#d3e2f2",
  minorRoad: "#dbe1ea",
  rail: "#c9d1dd",
  label: "#5b6a82",
};

type Ring = [number, number][];
type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
const fc = (features: Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

function polygonAround(c: LatLng, radiusM: number, sides = 6, rotate = 0): Ring {
  const ring: Ring = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((c.lat * Math.PI) / 180));
  for (let i = 0; i <= sides; i++) {
    const a = rotate + (i / sides) * Math.PI * 2;
    ring.push([c.lng + dLng * Math.cos(a), c.lat + dLat * Math.sin(a)]);
  }
  return ring;
}
const point = (c: LatLng, props: Record<string, unknown> = {}): Feature => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Point", coordinates: [c.lng, c.lat] },
});

export function webglSupported(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const safe = (fn: () => void) => {
  try {
    fn();
  } catch {
    /* a base-style layer didn't accept a property — ignore */
  }
};

/** Recolour the base map into a light city lit by the scenario's signal colour. */
function paintCity(map: MLMap, t: Theme) {
  for (const l of map.getStyle().layers) {
    if (l.id.startsWith("ripple-")) continue;
    const sl = (l as { "source-layer"?: string })["source-layer"] ?? "";
    const id = l.id;
    if (l.type === "background") safe(() => map.setPaintProperty(id, "background-color", CITY.ground));
    else if (l.type === "fill") {
      if (sl === "building") safe(() => map.setLayoutProperty(id, "visibility", "none"));
      else {
        const c = sl === "water" ? CITY.water : sl === "park" || sl === "landcover" ? CITY.park : CITY.land;
        safe(() => map.setPaintProperty(id, "fill-pattern", undefined));
        safe(() => map.setPaintProperty(id, "fill-color", c));
        safe(() => map.setPaintProperty(id, "fill-outline-color", c));
      }
    } else if (l.type === "line") {
      if (sl === "transportation") {
        if (/casing|outline/.test(id)) safe(() => map.setLayoutProperty(id, "visibility", "none"));
        else {
          safe(() => map.setPaintProperty(id, "line-pattern", undefined));
          safe(() =>
            map.setPaintProperty(id, "line-color", [
              "match",
              ["get", "class"],
              ["motorway", "trunk", "primary"],
              t.streets,
              ["secondary", "tertiary"],
              alpha(t.streets, 0.55),
              ["rail", "transit"],
              CITY.rail,
              CITY.minorRoad,
            ]),
          );
          safe(() => map.setPaintProperty(id, "line-opacity", 0.9));
        }
      } else if (sl === "waterway") safe(() => map.setPaintProperty(id, "line-color", CITY.water));
      else safe(() => map.setLayoutProperty(id, "visibility", "none"));
    } else if (l.type === "symbol") {
      if (sl === "place") {
        safe(() => map.setPaintProperty(id, "text-color", CITY.label));
        safe(() => map.setPaintProperty(id, "text-halo-color", "#ffffff"));
        safe(() => map.setPaintProperty(id, "icon-opacity", 0));
      } else safe(() => map.setLayoutProperty(id, "visibility", "none"));
    } else if (l.type === "fill-extrusion") safe(() => map.setLayoutProperty(id, "visibility", "none"));
  }

  if (map.getLayer("ripple-buildings"))
    safe(() =>
    map.setPaintProperty("ripple-buildings", "fill-extrusion-color", [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "render_height"], 0],
      0,
      t.glass[0],
      40,
      t.glass[1],
      140,
      t.glass[2],
    ]),
  );
  safe(() => map.setLight({ anchor: "viewport", color: "#ffffff", intensity: 0.22, position: [1.3, 210, 35] }));
  safe(() =>
    (map as unknown as { setSky: (s: Record<string, unknown>) => void }).setSky({
      "sky-color": "#f4f7fb",
      "horizon-color": t.soft,
      "fog-color": "#f1f4f9",
      "fog-ground-blend": 0.5,
      "horizon-fog-blend": 0.55,
      "sky-horizon-blend": 0.6,
      "atmosphere-blend": 0,
    }),
  );
}

/** Add our layers once per style load. */
function setupLayers(map: MLMap) {
  const style = map.getStyle();
  const vectorSource = Object.entries(style.sources).find(([, s]) => s.type === "vector")?.[0];
  const empty = fc([]);
  for (const id of ["ripple-heat", "ripple-zones", "ripple-lines", "ripple-flow", "ripple-sites", "ripple-sites-pt", "ripple-beams", "ripple-beams-pt"]) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty });
  }
  if (map.getLayer("ripple-beams")) return;

  map.addLayer({
    id: "ripple-heat",
    type: "heatmap",
    source: "ripple-heat",
    paint: {
      "heatmap-weight": ["get", "w"],
      "heatmap-intensity": 0.9,
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 22, 13, 70, 16, 140],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(255,255,255,0)",
        0.3,
        "rgba(255,200,120,0.28)",
        0.65,
        "rgba(255,150,80,0.42)",
        1,
        "rgba(255,84,112,0.55)",
      ],
      "heatmap-opacity": 0.85,
    },
  });
  map.addLayer({ id: "ripple-zones-fill", type: "fill", source: "ripple-zones", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.1 } });
  map.addLayer({
    id: "ripple-zones-line",
    type: "line",
    source: "ripple-zones",
    paint: { "line-color": ["get", "line"], "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.9 },
  });

  if (vectorSource) {
    map.addLayer({
      id: "ripple-buildings",
      type: "fill-extrusion",
      source: vectorSource,
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "fill-extrusion-color": "#eef2f8",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.82,
        "fill-extrusion-vertical-gradient": true,
      },
    });
  }

  map.addLayer({
    id: "ripple-lines-glow",
    type: "line",
    source: "ripple-lines",
    filter: ["==", ["get", "kind"], "corridor-lit"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "glow"], "line-width": 26, "line-blur": 16, "line-opacity": 0.75 },
  });
  map.addLayer({
    id: "ripple-lines-solid",
    type: "line",
    source: "ripple-lines",
    filter: ["!=", ["get", "dashed"], true],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": ["get", "w"], "line-opacity": ["get", "o"] },
  });
  map.addLayer({
    id: "ripple-lines-dashed",
    type: "line",
    source: "ripple-lines",
    filter: ["==", ["get", "dashed"], true],
    paint: { "line-color": ["get", "color"], "line-width": ["get", "w"], "line-opacity": ["get", "o"], "line-dasharray": [2, 2] },
  });
  // Fine animated lines (trips, walking routes) — dash pattern is cycled in JS.
  map.addLayer({
    id: "ripple-flow",
    type: "line",
    source: "ripple-flow",
    layout: { "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-width": ["get", "w"], "line-opacity": 0.95, "line-dasharray": [0, 4, 3] },
  });

  map.addLayer({
    id: "ripple-sites-glow",
    type: "circle",
    source: "ripple-sites-pt",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 8, 13, 22, 16, 60],
      "circle-color": ["get", "color"],
      "circle-blur": 0.9,
      "circle-opacity": ["get", "glow"],
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "ripple-sites",
    type: "fill-extrusion",
    source: "ripple-sites",
    paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.95 },
  });

  map.addLayer({
    id: "ripple-beams-glow",
    type: "circle",
    source: "ripple-beams-pt",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 7, 13, 18, 16, 50],
      "circle-color": ["get", "color"],
      "circle-blur": 0.85,
      "circle-opacity": 0.7,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "ripple-beams",
    type: "fill-extrusion",
    source: "ripple-beams",
    paint: {
      "fill-extrusion-color": ["get", "color"],
      // Tall light beams from afar; building-scale and see-through at street level.
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 12, ["get", "h"], 15.5, ["*", ["get", "h"], 0.2]],
      "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.95, 15.5, 0.6],
      "fill-extrusion-vertical-gradient": true,
    },
  });
}

// ── Data builders ────────────────────────────────────────────────────────────

function zonesData(s: Scenario, view: "baseline" | "policy", t: Theme) {
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

function linesData(s: Scenario, view: "baseline" | "policy", row: PersonaState[], t: Theme) {
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
function flowData(s: Scenario, row: PersonaState[], selected: string | null, t: Theme) {
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

function sitesData(s: Scenario, view: "baseline" | "policy", period: number, t: Theme) {
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
function heatData(s: Scenario, period: number) {
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

function beamHeight(s: Scenario, i: number, st: PersonaState): number {
  if (s.kind === "housing") return st.movedOut ? 200 : 200 + (st.burdenPct ?? 30) * 17;
  if (s.kind === "heat") return { low: 380, moderate: 720, high: 1080, critical: 1450 }[st.heatRisk ?? "low"];
  return 450 + (PERSONAS[i].represents / 3200) * 900;
}

function beamsData(s: Scenario, row: PersonaState[], positions: LatLng[], selected: string | null) {
  return {
    poly: fc(
      PERSONAS.map((p, i) => {
        const sel = selected === p.id;
        return {
          type: "Feature",
          properties: { id: p.id, color: stateColor(s, row[i]), h: beamHeight(s, i, row[i]) * (sel ? 1.2 : 1) },
          geometry: { type: "Polygon", coordinates: [polygonAround(positions[i], sel ? 48 : 32, 8)] },
        };
      }),
    ),
    pts: fc(PERSONAS.map((p, i) => point(positions[i], { color: stateColor(s, row[i]) }))),
  };
}

const BEAM_LABEL = { transit: "households represented", housing: "share of income on housing + transport", heat: "heat risk" } as const;

// Dash patterns cycled to make lines "flow" (MapLibre's standard animated-line technique).
const DASHES: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

export default function SimMap3D({ onFail }: { onFail: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const positions = useRef<LatLng[]>(PERSONAS.map((p) => p.home));
  const [ready, setReady] = useState(0);

  const scenario = useRipple((s) => s.scenario);
  const view = useRipple((s) => s.view);
  const period = useRipple((s) => s.period);
  const row = useRipple((s) => s.sim[s.view].states[s.period - 1]);
  const selected = useRipple((s) => s.selectedPersonaId);
  const flashAt = useRipple((s) => s.flashAt);
  const playing = useRipple((s) => s.playing);
  const theme = themeFor(scenario.kind);

  // ── Create the map once ─────────────────────────────────────────────────
  useEffect(() => {
    if (!container.current) return;
    const s0 = useRipple.getState().scenario;
    let styleIdx = 0;
    let loaded = false;
    let failed = false;
    const fail = (why: unknown) => {
      if (failed) return;
      failed = true;
      console.warn("[3D map] falling back to 2D:", why);
      onFail();
    };

    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: STYLES[0],
        center: [s0.mapView.center.lng, s0.mapView.center.lat],
        zoom: zoom3d(s0),
        pitch: PITCH,
        bearing: BEARING,
        maxPitch: 75,
        attributionControl: { compact: true },
        canvasContextAttributes: { antialias: true },
      });
    } catch (e) {
      fail(e);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    const timeout = setTimeout(() => !loaded && fail("style load timed out"), LOAD_TIMEOUT_MS);

    map.on("error", (e) => {
      if (loaded) return;
      styleIdx++;
      if (styleIdx < STYLES.length) map.setStyle(STYLES[styleIdx]);
      else fail(e.error ?? e);
    });

    map.on("style.load", () => {
      // Mark loaded FIRST: MapLibre reports minor styling issues as "error" events,
      // which must not be mistaken for the base map failing to load.
      loaded = true;
      clearTimeout(timeout);
      try {
        setupLayers(map);
        paintCity(map, themeFor(useRipple.getState().scenario.kind));
        setReady((n) => n + 1);
      } catch (e) {
        fail(e);
      }
    });

    const select = (id?: string) => {
      if (!id) return;
      const st = useRipple.getState();
      st.selectPersona(st.selectedPersonaId === id ? null : id);
    };
    map.on("click", "ripple-beams", (e) => select(e.features?.[0]?.properties?.id as string | undefined));
    map.on("mouseenter", "ripple-beams", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "ripple-beams", () => (map.getCanvas().style.cursor = ""));

    markers.current = PERSONAS.map((p) => {
      const el = document.createElement("div");
      el.className = "persona-pin";
      el.style.width = "22px";
      el.style.height = "22px";
      el.style.fontSize = "10px";
      el.textContent = p.name[0];
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        select(p.id);
      });
      return new maplibregl.Marker({ element: el }).setLngLat([p.home.lng, p.home.lat]).addTo(map);
    });

    // Flowing lines
    let step = 0;
    const flow = setInterval(() => {
      if (!loaded || !map.getLayer("ripple-flow")) return;
      step = (step + 1) % DASHES.length;
      safe(() => map.setPaintProperty("ripple-flow", "line-dasharray", DASHES[step]));
    }, 70);

    return () => {
      clearTimeout(timeout);
      clearInterval(flow);
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Atmosphere: repaint the city whenever the scenario (and so the theme) changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    paintCity(map, theme);
  }, [ready, theme]);

  // ── Scenario layers ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const set = (id: string, data: GeoJSON.FeatureCollection) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
    set("ripple-zones", zonesData(scenario, view, theme));
    set("ripple-lines", linesData(scenario, view, row, theme));
    set("ripple-flow", flowData(scenario, row, selected, theme));
    const sites = sitesData(scenario, view, period, theme);
    set("ripple-sites", sites.poly);
    set("ripple-sites-pt", sites.pts);
    set("ripple-heat", heatData(scenario, period));
    // Housing pressure deepens gradually over the year.
    const N = scenario.periodLabels.length;
    safe(() => map.setPaintProperty("ripple-zones-fill", "fill-opacity", scenario.kind === "housing" ? 0.06 + 0.16 * (period / N) : 0.1));
  }, [ready, scenario, view, period, row, selected, theme]);

  // ── Residents: beams + pins, tweened so people visibly move ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const from = positions.current.slice();
    const to = row.map((st) => st.position);
    const start = performance.now();
    let raf = 0;

    PERSONAS.forEach((p, i) => {
      const el = markers.current[i]?.getElement();
      if (!el) return;
      el.style.background = stateColor(scenario, row[i]);
      el.classList.toggle("selected", selected === p.id);
      el.classList.toggle("pulse", row[i].heatRisk === "critical" || (scenario.kind === "housing" && !!row[i].movedOut));
      el.title = `${p.name}: ${row[i].decisionLabel}`;
    });

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const cur = to.map((b, i) => ({ lat: from[i].lat + (b.lat - from[i].lat) * e, lng: from[i].lng + (b.lng - from[i].lng) * e }));
      positions.current = cur;
      const beams = beamsData(scenario, row, cur, selected);
      (map.getSource("ripple-beams") as GeoJSONSource | undefined)?.setData(beams.poly);
      (map.getSource("ripple-beams-pt") as GeoJSONSource | undefined)?.setData(beams.pts);
      cur.forEach((c, i) => markers.current[i]?.setLngLat([c.lng, c.lat]));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, scenario, row, selected]);

  // ── Camera choreography ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.flyTo({ center: [scenario.mapView.center.lng, scenario.mapView.center.lat], zoom: zoom3d(scenario), pitch: PITCH, bearing: BEARING, duration: 1800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scenario.id]);

  const firstFlash = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (firstFlash.current) {
      firstFlash.current = false;
      return;
    }
    if (!map || !ready || !flashAt) return;
    map.easeTo({ pitch: 64, bearing: map.getBearing() + 40, zoom: map.getZoom() + 0.35, duration: 3200 });
  }, [flashAt, ready]);

  const hadSelection = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selected) {
      const st = useRipple.getState();
      const i = PERSONAS.findIndex((p) => p.id === selected);
      const pos = st.sim[st.view].states[st.period - 1][i].position;
      map.flyTo({ center: [pos.lng, pos.lat], zoom: 15.4, pitch: 64, bearing: map.getBearing() - 20, duration: 1700 });
      hadSelection.current = true;
    } else if (hadSelection.current) {
      hadSelection.current = false;
      map.flyTo({ center: [scenario.mapView.center.lng, scenario.mapView.center.lat], zoom: zoom3d(scenario), pitch: PITCH, bearing: BEARING, duration: 1600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !playing || selected) return;
    map.easeTo({ bearing: map.getBearing() + 4, duration: 1500, easing: (t) => t });
  }, [period, playing, ready, selected]);

  return (
    <div className="relative h-full w-full" style={{ background: CITY.ground }}>
      <div ref={container} className="h-full w-full" />
      {!ready && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">Loading 3D city…</div>}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-line bg-panel/90 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.accent}` }} />
          <span className="font-semibold uppercase tracking-wider text-muted">{theme.name}</span>
        </div>
        <div className="mb-1 text-muted">Beam height = {BEAM_LABEL[scenario.kind]}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {legendFor(scenario).map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
        {scenario.kind === "heat" && (
          <div className="mt-1 flex gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: theme.accent }} /> cool space open
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#cbd5e1]" /> closed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "linear-gradient(90deg,rgba(255,214,150,.6),rgba(255,84,112,.6))" }} /> heat
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
