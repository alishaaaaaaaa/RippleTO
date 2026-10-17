"use client";

// Chooses between the 3D city (MapLibre) and the 2D map (Leaflet).
// 3D is the default; if the browser has no WebGL or the 3D tiles can't load,
// it quietly falls back to 2D so the demo never shows a blank map.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRipple } from "@/lib/store";
import { cx } from "@/lib/ui";

const loading = () => <div className="grid h-full place-items-center text-sm text-muted">Loading map…</div>;
const SimMap = dynamic(() => import("./SimMap"), { ssr: false, loading });
const SimMap3D = dynamic(() => import("./SimMap3D"), { ssr: false, loading });

export default function MapView() {
  const mapMode = useRipple((s) => s.mapMode);
  const setMapMode = useRipple((s) => s.setMapMode);
  const [can3d, setCan3d] = useState<boolean | null>(null);
  const [failed3d, setFailed3d] = useState(false);

  useEffect(() => {
    import("./SimMap3D").then((m) => setCan3d(m.webglSupported())).catch(() => setCan3d(false));
  }, []);

  if (can3d === null) return loading();
  const use3d = mapMode === "3d" && can3d && !failed3d;

  return (
    <div className="relative h-full w-full">
      {use3d ? (
        <SimMap3D
          onFail={() => {
            setFailed3d(true);
            useRipple.getState().showToast("3D city couldn't load — showing the 2D map");
          }}
        />
      ) : (
        <SimMap />
      )}

      {can3d && (
        <div className="absolute bottom-4 right-4 z-[600] inline-flex overflow-hidden rounded-lg bg-panel/90 text-xs font-semibold shadow-md ring-1 ring-line backdrop-blur">
          <button
            onClick={() => {
              setFailed3d(false);
              setMapMode("3d");
            }}
            className={cx("px-3 py-1.5", use3d ? "bg-accent text-navy" : "text-muted hover:bg-panel-2")}
          >
            3D city
          </button>
          <button
            onClick={() => setMapMode("2d")}
            className={cx("px-3 py-1.5", !use3d ? "bg-slate-200 text-navy" : "text-muted hover:bg-panel-2")}
          >
            2D map
          </button>
        </div>
      )}
    </div>
  );
}
