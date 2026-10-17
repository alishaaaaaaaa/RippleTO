"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 3D "Model" view — Toronto's real building footprints & heights from OpenStreetMap
// (OpenFreeMap tiles, no API key), painted in real-world materials, rendered with MapLibre GL.
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
import type { LatLng } from "@/lib/types";
import { useRipple } from "@/lib/store";
import { PERSONAS } from "@/lib/data/personas";
import { legendFor, stateColor } from "@/lib/ui";
import { themeFor } from "@/lib/themes";
import { BEAM_LABEL, beamsData, fc, flowData, heatData, heroFor, linesData, sitesData, zonesData } from "@/lib/mapData";
import { OrbitControls, type CameraHandle } from "./OrbitControls";

const STYLES = ["https://tiles.openfreemap.org/styles/positron", "https://tiles.openfreemap.org/styles/liberty"];
const LOAD_TIMEOUT_MS = 12000;

// Realistic city palette (constant across scenarios — only overlays take the scenario colour)
const CITY = {
  ground: "#ebe7df",
  land: "#e8e4db",
  residential: "#e6e1d7",
  park: "#c9ddb6",
  wood: "#b9d3a4",
  water: "#a3c8e6",
  road: "#ffffff",
  majorRoad: "#fbf7ee",
  casing: "#cfc9be",
  rail: "#b5afa5",
  label: "#6b6458",
};

/** Real-world building materials by height. A per-building seed varies the colour so blocks don't look uniform. */
const MATERIALS = {
  low: ["#d9c8b1", "#cbb59b", "#e3d9c9", "#c7b19f", "#d8d1c5"], // brick, sandstone, stucco houses
  mid: ["#d2d1cd", "#c5c2bb", "#dcd8cf", "#bec2c5", "#cfc8bb"], // concrete & precast mid-rise
  tall: ["#a8bccd", "#b9c8d4", "#9cb0c3", "#c4cdd4", "#aeb9c1"], // glass & steel towers
};
const pick = (list: string[]) => {
  const seed = ["to-number", ["coalesce", ["id"], ["get", "render_height"], 0], 0];
  const expr: unknown[] = ["match", ["%", ["floor", seed], list.length]];
  list.slice(1).forEach((c, i) => expr.push(i + 1, c));
  expr.push(list[0]);
  return expr;
};
const H = ["coalesce", ["get", "render_height"], 8];
const BUILDING_COLOR = ["case", ["<", H, 14], pick(MATERIALS.low), ["<", H, 55], pick(MATERIALS.mid), pick(MATERIALS.tall)];

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

/** Repaint the base map to look like a real city: warm ground, green parks, white streets, real materials. */
function paintCity(map: MLMap) {
  for (const l of map.getStyle().layers) {
    if (l.id.startsWith("ripple-")) continue;
    const sl = (l as { "source-layer"?: string })["source-layer"] ?? "";
    const id = l.id;
    if (l.type === "background") safe(() => map.setPaintProperty(id, "background-color", CITY.ground));
    else if (l.type === "fill") {
      if (sl === "building") safe(() => map.setLayoutProperty(id, "visibility", "none"));
      else {
        const c =
          sl === "water"
            ? CITY.water
            : sl === "park"
              ? CITY.park
              : sl === "landcover"
                ? ["match", ["get", "class"], ["wood", "forest"], CITY.wood, ["grass", "farmland", "scrub"], CITY.park, CITY.land]
                : sl === "landuse"
                  ? ["match", ["get", "class"], ["residential", "suburb", "neighbourhood"], CITY.residential, ["cemetery", "pitch", "playground", "stadium"], CITY.park, CITY.land]
                  : CITY.land;
        safe(() => map.setPaintProperty(id, "fill-pattern", undefined));
        safe(() => map.setPaintProperty(id, "fill-color", c as never));
        safe(() => map.setPaintProperty(id, "fill-outline-color", "rgba(0,0,0,0)"));
        safe(() => map.setPaintProperty(id, "fill-opacity", 1));
      }
    } else if (l.type === "line") {
      if (sl === "transportation") {
        safe(() => map.setPaintProperty(id, "line-pattern", undefined));
        if (/casing|outline/.test(id)) {
          safe(() => map.setLayoutProperty(id, "visibility", "visible"));
          safe(() => map.setPaintProperty(id, "line-color", CITY.casing));
        } else
          safe(() =>
            map.setPaintProperty(id, "line-color", ["match", ["get", "class"], ["motorway", "trunk", "primary"], CITY.majorRoad, ["rail", "transit"], CITY.rail, CITY.road]),
          );
        safe(() => map.setPaintProperty(id, "line-opacity", 1));
      } else if (sl === "waterway") safe(() => map.setPaintProperty(id, "line-color", CITY.water));
      else if (sl === "boundary") safe(() => map.setLayoutProperty(id, "visibility", "none"));
    } else if (l.type === "symbol") {
      // Keep street and place names (real-map feel); drop shop/POI icons.
      if (sl === "transportation_name" || sl === "place") {
        safe(() => map.setLayoutProperty(id, "visibility", "visible"));
        safe(() => map.setPaintProperty(id, "text-color", CITY.label));
        safe(() => map.setPaintProperty(id, "text-halo-color", "rgba(255,255,255,0.9)"));
        safe(() => map.setPaintProperty(id, "icon-opacity", 0));
      } else safe(() => map.setLayoutProperty(id, "visibility", "none"));
    } else if (l.type === "fill-extrusion") safe(() => map.setLayoutProperty(id, "visibility", "none"));
  }

  if (map.getLayer("ripple-buildings")) safe(() => map.setPaintProperty("ripple-buildings", "fill-extrusion-color", BUILDING_COLOR as never));
  // Afternoon sun from the south-west gives buildings readable light and shade.
  safe(() => map.setLight({ anchor: "map", color: "#fff6e8", intensity: 0.42, position: [1.4, 215, 40] }));
  safe(() =>
    (map as unknown as { setSky: (s: Record<string, unknown>) => void }).setSky({
      "sky-color": "#a9cdee",
      "horizon-color": "#e9f1f7",
      "fog-color": "#eef1f3",
      "fog-ground-blend": 0.7,
      "horizon-fog-blend": 0.5,
      "sky-horizon-blend": 0.7,
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
        "fill-extrusion-color": "#d6d2ca",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 1,
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
    paint: { "line-color": ["get", "glow"], "line-width": ["interpolate", ["linear"], ["zoom"], 11, 18, 14, 60, 16, 140], "line-blur": ["interpolate", ["linear"], ["zoom"], 11, 12, 14, 40, 16, 90], "line-opacity": 0.55 },
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
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 8, 14, 34, 16, 80],
      "circle-color": ["get", "color"],
      "circle-blur": 0.9,
      "circle-opacity": 0.85,
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
  const camera = useRef<CameraHandle | null>(null);
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
        center: [heroFor(s0).lng, heroFor(s0).lat],
        zoom: heroFor(s0).zoom,
        pitch: heroFor(s0).pitch,
        bearing: heroFor(s0).bearing,
        maxPitch: 75,
        attributionControl: { compact: true },
        canvasContextAttributes: { antialias: true },
      });
    } catch (e) {
      fail(e);
      return;
    }
    mapRef.current = map;
    camera.current = {
      pitch: () => map.getPitch(),
      rotateBy: (deg, animate = true) =>
        animate ? map.easeTo({ bearing: map.getBearing() + deg, duration: 600 }) : map.jumpTo({ bearing: map.getBearing() + deg }),
      setPitch: (deg) => map.jumpTo({ pitch: deg }),
      zoomBy: (d) => map.easeTo({ zoom: map.getZoom() + d, duration: 400 }),
      reset: () => {
        const h = heroFor(useRipple.getState().scenario);
        map.flyTo({ center: [h.lng, h.lat], zoom: h.zoom, pitch: h.pitch, bearing: h.bearing, duration: 1400 });
      },
    };
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
        paintCity(map);
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
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.fontSize = "9px";
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
      camera.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const h = heroFor(scenario);
    map.flyTo({ center: [h.lng, h.lat], zoom: h.zoom, pitch: h.pitch, bearing: h.bearing, duration: 1800 });
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
    map.easeTo({ pitch: 66, bearing: map.getBearing() + 35, zoom: map.getZoom() + 0.25, duration: 3200 });
  }, [flashAt, ready]);

  const hadSelection = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selected) {
      const st = useRipple.getState();
      const i = PERSONAS.findIndex((p) => p.id === selected);
      const pos = st.sim[st.view].states[st.period - 1][i].position;
      map.flyTo({ center: [pos.lng, pos.lat], zoom: 15.6, pitch: 66, bearing: map.getBearing() - 20, duration: 1700 });
      hadSelection.current = true;
    } else if (hadSelection.current) {
      hadSelection.current = false;
      const h = heroFor(scenario);
      map.flyTo({ center: [h.lng, h.lat], zoom: h.zoom, pitch: h.pitch, bearing: h.bearing, duration: 1600 });
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
      {ready > 0 && <OrbitControls camera={camera} />}
      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex items-center gap-3 rounded-full bg-panel/85 px-3.5 py-1.5 text-[11px] text-muted shadow-md ring-1 ring-line backdrop-blur">
        {legendFor(scenario).map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="h-3 w-px bg-line" />
        <span className="whitespace-nowrap">beam = {BEAM_LABEL[scenario.kind]}</span>
      </div>
    </div>
  );
}
