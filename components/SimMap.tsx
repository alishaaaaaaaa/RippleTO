"use client";

// Leaflet map — the equivalent of Emergent's PeriodMapView.tsx.
// Loaded with next/dynamic (ssr: false) because Leaflet needs `window`.

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { HeatParams, LatLng, PersonaState, Scenario } from "@/lib/types";
import { useRipple } from "@/lib/store";
import { PERSONAS } from "@/lib/data/personas";
import { openCoolingSites } from "@/lib/engine/model";
import { legendFor, stateColor } from "@/lib/ui";

function FlyToScenario({ scenario }: { scenario: Scenario }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([scenario.mapView.center.lat, scenario.mapView.center.lng], scenario.mapView.zoom, { duration: 1.1 });
  }, [map, scenario.id, scenario.mapView.center.lat, scenario.mapView.center.lng, scenario.mapView.zoom]);
  return null;
}

/** Smoothly tween a marker between positions so people visibly "move". */
function useTween(target: LatLng, ms = 700): LatLng {
  const [pos, setPos] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    from.current = current.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const next = {
        lat: from.current.lat + (target.lat - from.current.lat) * e,
        lng: from.current.lng + (target.lng - from.current.lng) * e,
      };
      current.current = next;
      setPos(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target.lat, target.lng, ms]);
  return pos;
}

function PersonaPin({
  scenario,
  st,
  name,
  selected,
  onClick,
}: {
  scenario: Scenario;
  st: PersonaState;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  const pos = useTween(st.position);
  const color = stateColor(scenario, st);
  const pulse = st.heatRisk === "critical" || (st.movedOut && scenario.kind === "housing");
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `<div class="persona-pin ${selected ? "selected" : ""} ${pulse ? "pulse" : ""}" style="background:${color}">${name[0]}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    [color, name, selected, pulse],
  );
  return (
    <Marker position={[pos.lat, pos.lng]} icon={icon} eventHandlers={{ click: onClick }} zIndexOffset={selected ? 2000 : 1000}>
      <Tooltip direction="top" offset={[0, -16]} className="ripple-tip">
        <div className="font-semibold">{name}</div>
        <div className="max-w-56 whitespace-normal">{st.decisionLabel}</div>
      </Tooltip>
    </Marker>
  );
}

export default function SimMap() {
  const scenario = useRipple((s) => s.scenario);
  const view = useRipple((s) => s.view);
  const period = useRipple((s) => s.period);
  const row = useRipple((s) => s.sim[s.view].states[s.period - 1]);
  const selected = useRipple((s) => s.selectedPersonaId);
  const selectPersona = useRipple((s) => s.selectPersona);

  const overlays = scenario.overlays.filter((o) => o.arm === "both" || o.arm === view);
  const sites = scenario.kind === "heat" ? openCoolingSites(scenario.params as HeatParams, view, period - 1) : [];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[scenario.mapView.center.lat, scenario.mapView.center.lng]}
        zoom={scenario.mapView.zoom}
        className="h-full w-full"
        zoomControl={false}
        attributionControl
      >
        <FlyToScenario scenario={scenario} />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
          maxZoom={16}
        />

        {/* Scenario overlays: corridors, pressure zones */}
        {overlays
          .filter((o) => o.kind === "line")
          .map((o) => (
            <Polyline
              key={`${o.id}-${view}`}
              positions={o.coords.map((c) => [c.lat, c.lng])}
              pathOptions={{ color: o.color, weight: o.arm === "policy" ? 7 : 5, opacity: 0.9, dashArray: o.dashed ? "6 8" : undefined }}
            >
              <Tooltip sticky className="ripple-tip">
                <div className="font-semibold">{o.label}</div>
                {o.description && <div>{o.description}</div>}
              </Tooltip>
            </Polyline>
          ))}
        {scenario.kind !== "heat" &&
          overlays
            .filter((o) => o.kind === "point")
            .map((o) => (
              <CircleMarker
                key={o.id}
                center={[o.coords[0].lat, o.coords[0].lng]}
                radius={26}
                pathOptions={{ color: o.color, weight: 1, fillColor: o.color, fillOpacity: 0.12, dashArray: "4 4" }}
              >
                <Tooltip className="ripple-tip">{o.label}</Tooltip>
              </CircleMarker>
            ))}

        {/* Cooling sites (heat scenario): bright when open this period, dim when closed */}
        {sites.map(({ site, open }) =>
          site.policyOnly && view !== "policy" ? null : (
            <Marker
              key={site.id}
              position={[site.location.lat, site.location.lng]}
              zIndexOffset={-500}
              icon={L.divIcon({
                className: "",
                html: `<div class="site-pin" style="background:${open ? (site.policyOnly ? "#06b6d4" : "#38bdf8") : "#1e293b"};opacity:${open ? 1 : 0.55}">❄</div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              })}
            >
              <Tooltip className="ripple-tip">
                <div className="font-semibold">{site.name}</div>
                <div>{open ? "Open now" : "Closed this period"}{site.policyOnly ? " · added by response plan" : ""}</div>
              </Tooltip>
            </Marker>
          ),
        )}

        {/* Trip lines (transit) and displacement lines (housing) */}
        {PERSONAS.map((p, i) => {
          const st = row[i];
          if (scenario.kind === "transit" && p.travel.mode !== "walk") {
            return (
              <Polyline
                key={`trip-${p.id}`}
                positions={[
                  [p.home.lat, p.home.lng],
                  [p.destination.lat, p.destination.lng],
                ]}
                pathOptions={{ color: stateColor(scenario, st), weight: selected === p.id ? 3 : 1.5, opacity: selected === p.id ? 0.95 : 0.4, dashArray: "4 6" }}
              />
            );
          }
          if (scenario.kind === "housing" && st.movedOut) {
            return (
              <Polyline
                key={`move-${p.id}`}
                positions={[
                  [p.home.lat, p.home.lng],
                  [st.position.lat, st.position.lng],
                ]}
                pathOptions={{ color: "#ef3b56", weight: 2, opacity: 0.8, dashArray: "2 6" }}
              />
            );
          }
          return null;
        })}

        {PERSONAS.map((p, i) => (
          <PersonaPin
            key={p.id}
            scenario={scenario}
            st={row[i]}
            name={p.name}
            selected={selected === p.id}
            onClick={() => selectPersona(selected === p.id ? null : p.id)}
          />
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-line bg-panel/90 px-3 py-2 text-[11px] backdrop-blur">
        <div className="mb-1 font-semibold uppercase tracking-wider text-muted">Residents</div>
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
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#38bdf8]" /> cool space open
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#1e293b] ring-1 ring-white/50" /> closed
            </span>
          </div>
        )}
        {scenario.kind === "transit" && view === "policy" && scenario.overlays.some((o) => o.arm === "policy" && o.kind === "line") && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-block h-1 w-5 rounded bg-[#e11d48]" /> new red bus lanes
          </div>
        )}
      </div>
    </div>
  );
}
