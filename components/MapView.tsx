"use client";

// Chooses the map:
//   • Real 3D — Google's photorealistic 3D-scanned Toronto (needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
//   • Model   — real OpenStreetMap building shapes & heights, no key needed
//   • 2D      — flat Leaflet map
// Each falls back to the next one automatically, so the demo never shows a blank map.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRipple } from "@/lib/store";
import { cx } from "@/lib/ui";

const loading = () => <div className="grid h-full place-items-center text-sm text-muted">Loading map…</div>;
const SimMap = dynamic(() => import("./SimMap"), { ssr: false, loading });
const SimMap3D = dynamic(() => import("./SimMap3D"), { ssr: false, loading });
const SimMapPhoto = dynamic(() => import("./SimMapPhoto"), { ssr: false, loading });

const HAS_GOOGLE_KEY = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function MapView() {
  const mapMode = useRipple((s) => s.mapMode);
  const setMapMode = useRipple((s) => s.setMapMode);
  const [can3d, setCan3d] = useState<boolean | null>(null);
  const [failedPhoto, setFailedPhoto] = useState(false);
  const [failed3d, setFailed3d] = useState(false);

  useEffect(() => {
    import("./SimMap3D").then((m) => setCan3d(m.webglSupported())).catch(() => setCan3d(false));
  }, []);

  if (can3d === null) return loading();
  const canPhoto = can3d && HAS_GOOGLE_KEY && !failedPhoto;
  const canModel = can3d && !failed3d;
  const active: "photo" | "3d" | "2d" =
    mapMode === "photo" && canPhoto ? "photo" : (mapMode === "photo" || mapMode === "3d") && canModel ? "3d" : "2d";

  const tabs: { id: "photo" | "3d" | "2d"; label: string; enabled: boolean; title: string }[] = [
    {
      id: "photo",
      label: "Real 3D",
      enabled: can3d && HAS_GOOGLE_KEY,
      title: HAS_GOOGLE_KEY ? "Google's 3D-scanned Toronto" : "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local to turn this on",
    },
    { id: "3d", label: "Model", enabled: can3d, title: "Real building shapes & heights (OpenStreetMap)" },
    { id: "2d", label: "2D", enabled: true, title: "Flat map" },
  ];

  return (
    <div className="relative h-full w-full">
      {active === "photo" ? (
        <SimMapPhoto
          onFail={() => {
            setFailedPhoto(true);
            useRipple.getState().showToast("Real 3D couldn't load (check the Google key) — showing the 3D model");
          }}
        />
      ) : active === "3d" ? (
        <SimMap3D
          onFail={() => {
            setFailed3d(true);
            useRipple.getState().showToast("3D city couldn't load — showing the 2D map");
          }}
        />
      ) : (
        <SimMap />
      )}

      <div className="absolute bottom-4 right-4 z-[600] inline-flex overflow-hidden rounded-lg bg-panel/90 text-xs font-semibold shadow-md ring-1 ring-line backdrop-blur">
        {tabs.map((t) => (
          <button
            key={t.id}
            disabled={!t.enabled}
            title={t.title}
            onClick={() => {
              if (t.id === "photo") setFailedPhoto(false);
              if (t.id === "3d") setFailed3d(false);
              setMapMode(t.id);
            }}
            className={cx(
              "px-3 py-1.5",
              active === t.id ? "bg-accent text-navy" : t.enabled ? "text-muted hover:bg-panel-2" : "cursor-not-allowed text-slate-300",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
