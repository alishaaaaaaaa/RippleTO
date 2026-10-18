"use client";

// ─────────────────────────────────────────────────────────────────────────────
// "Real 3D" view — Google Photorealistic 3D Tiles: the actual 3D-scanned city
// (real façades, trees, roofs) rendered with deck.gl. Scenario overlays are draped
// onto the scanned ground and residents' beams stand on top of it.
//
// Needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with the "Map Tiles API" enabled (see
// .env.example). If the key is missing/blocked or tiles don't arrive in time it
// calls onFail() and the app falls back to the Model view.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { FlyToInterpolator, type MapViewState, type PickingInfo } from "@deck.gl/core";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import { ColumnLayer, GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { _TerrainExtension as TerrainExtension } from "@deck.gl/extensions";
import { useRipple } from "@/lib/store";
import { PERSONAS } from "@/lib/data/personas";
import { legendFor, stateColor } from "@/lib/ui";
import { themeFor } from "@/lib/themes";
import { BEAM_LABEL, beamHeight, heroFor, lighten, linesData, flowData, sitesData, zonesData } from "@/lib/mapData";
import { hitPulse, rippleGeo, ringsAt, waveActive, type Ring } from "@/lib/ripple";
import { OrbitControls, type CameraHandle } from "./OrbitControls";
import type { Scenario } from "@/lib/types";

export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const TILESET = "https://tile.googleapis.com/v1/3dtiles/root.json";
const LOAD_TIMEOUT_MS = 20000;
/** Approx. ground height (m above sea level) of north-west Toronto — keeps the camera target on the street, not underground. */
const GROUND_M = 150;
/** Real buildings here are 10–100 m tall, so beams are scaled down to sit among them. */
const BEAM_SCALE = 0.32;

type RGBA = [number, number, number, number];
/** "#rrggbb" | "rgb(r,g,b)" | "rgba(r,g,b,a)" → deck.gl colour. */
function rgba(c: string, a = 255): RGBA {
  if (c.startsWith("#")) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [m[0], m[1], m[2], m[3] !== undefined ? Math.round(m[3] * 255) : a];
}

const heroView = (s: Scenario): MapViewState => {
  const h = heroFor(s);
  return { latitude: h.lat, longitude: h.lng, zoom: h.zoom + 0.2, pitch: h.pitch, bearing: h.bearing, position: [0, 0, GROUND_M], maxPitch: 75, minZoom: 11, maxZoom: 19 };
};

const drape = [new TerrainExtension()];
const offset = [new TerrainExtension()];

export default function SimMapPhoto({ onFail }: { onFail: (why: string) => void }) {
  const scenario = useRipple((s) => s.scenario);
  const view = useRipple((s) => s.view);
  const period = useRipple((s) => s.period);
  const row = useRipple((s) => s.sim[s.view].states[s.period - 1]);
  const selected = useRipple((s) => s.selectedPersonaId);
  const flashAt = useRipple((s) => s.flashAt);
  const playing = useRipple((s) => s.playing);
  const enacted = useRipple((s) => s.enacted);
  const theme = themeFor(scenario.kind);

  const [viewState, setViewState] = useState<MapViewState>(() => heroView(useRipple.getState().scenario));
  const vs = useRef(viewState);
  vs.current = viewState;
  const [loaded, setLoaded] = useState(false);
  const [credits, setCredits] = useState("");
  const failed = useRef(false);
  const camera = useRef<CameraHandle | null>(null);

  const fail = (why: string) => {
    if (failed.current) return;
    failed.current = true;
    console.warn("[Real 3D] falling back:", why);
    onFail(why);
  };

  useEffect(() => {
    const t = setTimeout(() => !loadedRef.current && fail("Google 3D tiles took too long to load"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadedRef = useRef(false);
  loadedRef.current = loaded;

  const fly = (v: Partial<MapViewState>, duration = 1600) =>
    setViewState((cur) => ({ ...cur, ...v, transitionDuration: duration, transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }) }) as MapViewState);
  const ease = (v: Partial<MapViewState>, duration = 500) => setViewState((cur) => ({ ...cur, ...v, transitionDuration: duration }) as MapViewState);

  camera.current = {
    pitch: () => vs.current.pitch ?? 0,
    rotateBy: (deg, animate = true) =>
      animate ? ease({ bearing: (vs.current.bearing ?? 0) + deg }, 600) : setViewState((cur) => ({ ...cur, bearing: (cur.bearing ?? 0) + deg, transitionDuration: 0 })),
    setPitch: (deg) => setViewState((cur) => ({ ...cur, pitch: deg, transitionDuration: 0 })),
    zoomBy: (d) => ease({ zoom: vs.current.zoom + d }, 400),
    reset: () => fly(heroView(useRipple.getState().scenario), 1400),
  };

  // ── Camera choreography (mirrors the Model view) ────────────────────────
  const firstScenario = useRef(true);
  useEffect(() => {
    if (firstScenario.current) {
      firstScenario.current = false;
      return;
    }
    fly(heroView(scenario), 1800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  const firstFlash = useRef(true);
  useEffect(() => {
    if (firstFlash.current) {
      firstFlash.current = false;
      return;
    }
    if (flashAt) ease({ pitch: 66, bearing: (vs.current.bearing ?? 0) + 35 }, 3200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashAt]);

  const hadSelection = useRef(false);
  useEffect(() => {
    if (selected) {
      const st = useRipple.getState();
      const i = PERSONAS.findIndex((p) => p.id === selected);
      const pos = st.sim[st.view].states[st.period - 1][i]?.position;
      if (pos) fly({ latitude: pos.lat, longitude: pos.lng, zoom: 16.2, pitch: 65, bearing: (vs.current.bearing ?? 0) - 20 }, 1700);
      hadSelection.current = true;
    } else if (hadSelection.current) {
      hadSelection.current = false;
      fly(heroView(scenario), 1600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (!playing || selected) return;
    ease({ bearing: (vs.current.bearing ?? 0) + 4 }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, playing]);

  // ── The ripple clock: re-render ~30×/s only while rings are on screen
  const geo = useMemo(() => rippleGeo(scenario), [scenario]);
  const ambient = view === "policy" && enacted;
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      const t = Date.now();
      if (ts - last > 33) {
        last = ts;
        setNow(t);
      }
      if (ambient || waveActive(t, flashAt)) raf = requestAnimationFrame(tick);
      else setNow(0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ambient, flashAt]);
  const rings: Ring[] = now ? ringsAt(now, geo, flashAt, ambient) : [];

  // ── Layers ─────────────────────────────────────────────────────────────
  const tiles = useMemo(
    () =>
      new Tile3DLayer({
        id: "google-3d-tiles",
        data: TILESET,
        operation: "terrain+draw",
        loadOptions: {
          // Our own fetch: adds the key, and turns a rejected key / network failure into a
          // clean fallback instead of an uncaught runtime error.
          fetch: async (url: string) => {
            const isRoot = url.includes("/3dtiles/root.json");
            try {
              const r = await fetch(url, { headers: { "X-GOOG-API-KEY": GOOGLE_KEY } });
              if (!r.ok && isRoot) {
                fail(`Google 3D tiles returned ${r.status} — check the key has "Map Tiles API" enabled and billing on`);
                return new Promise<Response>(() => {}); // never settles; this view is swapped out by the fallback
              }
              return r;
            } catch (e) {
              if (!isRoot) throw e;
              fail(`Couldn't reach Google 3D tiles (${String(e)})`);
              return new Promise<Response>(() => {}); // never settles; this view is swapped out by the fallback
            }
          },
          tileset: {
            maximumScreenSpaceError: 16,
            maximumMemoryUsage: 512,
            memoryAdjustedScreenSpaceError: true,
            // Google requires showing the data providers for the tiles on screen.
            onTraversalComplete: (selectedTiles: { content?: { gltf?: { asset?: { copyright?: string } } } }[]) => {
              const names = new Set<string>();
              selectedTiles.forEach((t) => t.content?.gltf?.asset?.copyright?.split(";").forEach((c) => c.trim() && names.add(c.trim())));
              const next = [...names].join("; ");
              setCredits((prev) => (prev === next ? prev : next));
              return selectedTiles;
            },
          },
        },
        onTilesetLoad: () => !failed.current && setLoaded(true),
        onTileError: (_tile: unknown, url: string, message: string) => {
          if (!loadedRef.current) fail(`tile error ${message} (${url})`);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const select = (id?: string) => {
    if (!id) return;
    const st = useRipple.getState();
    st.selectPersona(st.selectedPersonaId === id ? null : id);
  };

  const overlays = useMemo(() => {
    const zones = zonesData(scenario, view, theme);
    const lines = linesData(scenario, view, row, theme);
    const flows = flowData(scenario, row, selected, theme);
    const sites = sitesData(scenario, view, period, theme);
    const N = scenario.periodLabels.length;
    const zoneAlpha = Math.round(255 * (scenario.kind === "housing" ? 0.1 + 0.18 * (period / N) : 0.14));
    const people = PERSONAS.map((p, i) => ({ id: p.id, name: p.name, pos: row[i].position, st: row[i], i }));
    const siteCols = (sites.pts.features as GeoJSON.Feature<GeoJSON.Point, { color: string; glow: number }>[]).map((f, k) => ({
      pos: f.geometry.coordinates,
      color: (sites.poly.features[k]?.properties as { color: string } | undefined)?.color ?? theme.accent,
      open: f.properties.glow > 0,
    }));

    return [
      new GeoJsonLayer({
        id: "zones",
        data: zones,
        extensions: drape,
        filled: true,
        stroked: true,
        getFillColor: (f: GeoJSON.Feature) => rgba(String(f.properties?.color), zoneAlpha),
        getLineColor: (f: GeoJSON.Feature) => rgba(String(f.properties?.line), 230),
        getLineWidth: 4,
        lineWidthUnits: "pixels",
        updateTriggers: { getFillColor: [zoneAlpha, theme.accent] },
      }),
      new ScatterplotLayer<Ring>({
        id: "ripple-waves",
        data: rings,
        extensions: drape,
        stroked: true,
        filled: false,
        radiusUnits: "meters",
        lineWidthUnits: "pixels",
        getPosition: (r) => [r.center.lng, r.center.lat],
        getRadius: (r) => r.r,
        getLineWidth: (r) => (r.front ? 4 : 2),
        getLineColor: (r) => rgba(r.front ? theme.accent : theme.deep, Math.round(255 * r.a)),
        updateTriggers: { getRadius: [now], getLineColor: [now, theme.accent] },
      }),
      new GeoJsonLayer({
        id: "corridors",
        data: lines,
        extensions: drape,
        getLineColor: (f: GeoJSON.Feature) => rgba(String(f.properties?.kind === "corridor-lit" ? f.properties?.glow : f.properties?.color), 235),
        getLineWidth: (f: GeoJSON.Feature) => (f.properties?.kind === "corridor-lit" ? 14 : 6),
        lineWidthUnits: "pixels",
        lineCapRounded: true,
        lineJointRounded: true,
      }),
      new GeoJsonLayer({
        id: "flows",
        data: flows,
        extensions: drape,
        getLineColor: (f: GeoJSON.Feature) => rgba(String(f.properties?.color), 220),
        getLineWidth: (f: GeoJSON.Feature) => Number(f.properties?.w ?? 2) * 1.6,
        lineWidthUnits: "pixels",
        lineCapRounded: true,
      }),
      new ScatterplotLayer({
        id: "people-ground",
        data: people,
        extensions: drape,
        getPosition: (d: (typeof people)[number]) => [d.pos.lng, d.pos.lat],
        getRadius: (d: (typeof people)[number]) => (d.id === selected ? 34 : 22) + 40 * hitPulse(now, flashAt, geo.delays[d.i]),
        getFillColor: (d: (typeof people)[number]) => rgba(stateColor(scenario, d.st), 150),
        radiusUnits: "meters",
        transitions: { getPosition: 700 },
        updateTriggers: { getRadius: [selected, now], getFillColor: [row, scenario.id] },
      }),
      new ColumnLayer({
        id: "cooling-sites",
        data: siteCols,
        extensions: offset,
        terrainDrawMode: "offset",
        diskResolution: 4,
        angle: 45,
        radius: 24,
        getPosition: (d: (typeof siteCols)[number]) => d.pos as [number, number],
        getElevation: (d: (typeof siteCols)[number]) => (d.open ? 60 : 6),
        getFillColor: (d: (typeof siteCols)[number]) => rgba(d.color, d.open ? 235 : 140),
      }),
      new ColumnLayer({
        id: "beams",
        data: people,
        extensions: offset,
        terrainDrawMode: "offset",
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 90],
        diskResolution: 16,
        radius: 9,
        getPosition: (d: (typeof people)[number]) => [d.pos.lng, d.pos.lat],
        getElevation: (d: (typeof people)[number]) => beamHeight(scenario, d.i, d.st) * BEAM_SCALE * (d.id === selected ? 1.25 : 1),
        getFillColor: (d: (typeof people)[number]) => rgba(lighten(stateColor(scenario, d.st), 0.15), d.id === selected ? 250 : 215),
        material: { ambient: 0.6, diffuse: 0.5, shininess: 40, specularColor: [255, 255, 255] },
        transitions: { getPosition: 700, getElevation: 500 },
        updateTriggers: { getElevation: [row, selected, scenario.id], getFillColor: [row, selected, scenario.id] },
        onClick: (info: PickingInfo) => select((info.object as (typeof people)[number] | undefined)?.id),
      }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, view, period, row, selected, theme, now]);

  return (
    <div className="relative h-full w-full" style={{ background: "#dfe6ee" }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: v }) => setViewState(v as MapViewState)}
        controller={{ touchRotate: true, inertia: 400, dragRotate: true }}
        layers={[tiles, ...overlays]}
        getCursor={({ isHovering, isDragging }) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab")}
        getTooltip={({ object, layer }) => {
          if (layer?.id !== "beams" || !object) return null;
          const d = object as { name: string; st: { decisionLabel: string } };
          return { text: `${d.name}: ${d.st.decisionLabel}`, style: { fontSize: "12px", borderRadius: "8px", background: "#0f1b2d", color: "#fff", padding: "6px 8px" } };
        }}
        onError={(e) => {
          if (!loadedRef.current) fail(String(e?.message ?? e));
        }}
      />

      {!loaded && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">Loading real 3D Toronto…</div>}
      <OrbitControls camera={camera} />

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

      {/* Required attribution for Google Photorealistic 3D Tiles: Google logo + data providers. */}
      <div className={`pointer-events-none absolute bottom-14 left-4 z-[500] flex items-center gap-2 ${loaded ? "" : "hidden"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://maps.gstatic.com/mapfiles/api-3/images/google_white5.png" alt="Google" className="h-[18px] drop-shadow" />
        {credits && <span className="max-w-[420px] truncate rounded bg-white/75 px-1.5 py-0.5 text-[10px] text-slate-700">{credits}</span>}
      </div>
    </div>
  );
}
