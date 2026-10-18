"use client";

// Camera controls shared by both 3D views (Real 3D and Model).
// Rotate, tilt, zoom, reset — plus an auto-orbit that slowly circles the scene.
// You can also drag on the map: right-click/Ctrl-drag (or two fingers) to orbit and tilt.

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/ui";

export interface CameraHandle {
  /** Current tilt in degrees (0 = straight down). */
  pitch(): number;
  /** Rotate the camera around the centre of the screen. animate=false for smooth per-frame orbit. */
  rotateBy(deg: number, animate?: boolean): void;
  setPitch(deg: number): void;
  zoomBy(delta: number): void;
  /** Fly back to the scenario's starting shot. */
  reset(): void;
}

const MAX_PITCH = 75;

export function OrbitControls({ camera, paused }: { camera: React.RefObject<CameraHandle | null>; paused?: boolean }) {
  const [open, setOpen] = useState(true);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(6); // degrees per second
  const [pitch, setPitchState] = useState(60);
  const dragging = useRef(false);

  // Keep the tilt slider in sync when the user drags the map.
  useEffect(() => {
    const id = setInterval(() => {
      const p = camera.current?.pitch();
      if (p !== undefined && !dragging.current) setPitchState(Math.round(p));
    }, 250);
    return () => clearInterval(id);
  }, [camera]);

  // Auto-orbit: rotate a little every frame.
  useEffect(() => {
    if (!auto || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      camera.current?.rotateBy(speed * dt, false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto, speed, paused, camera]);

  const btn = "grid h-8 w-8 place-items-center rounded-lg text-base text-navy hover:bg-panel-2 active:scale-95";

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-4 top-4 z-[600] rounded-lg bg-panel/90 px-3 py-1.5 text-xs font-semibold text-navy shadow-md ring-1 ring-line backdrop-blur hover:bg-panel"
      >
        ⟳ Camera
      </button>
    );

  return (
    <div className="absolute right-4 top-4 z-[600] w-[184px] rounded-xl bg-panel/92 p-2.5 text-xs text-navy shadow-lg ring-1 ring-line backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-navy">Camera</span>
        <button onClick={() => setOpen(false)} className="rounded px-1 text-muted hover:bg-panel-2" aria-label="Hide camera controls">
          ✕
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button className={btn} title="Rotate left" onClick={() => camera.current?.rotateBy(-30)}>
          ↺
        </button>
        <button className={btn} title="Zoom out" onClick={() => camera.current?.zoomBy(-0.6)}>
          −
        </button>
        <button className={btn} title="Zoom in" onClick={() => camera.current?.zoomBy(0.6)}>
          +
        </button>
        <button className={btn} title="Rotate right" onClick={() => camera.current?.rotateBy(30)}>
          ↻
        </button>
      </div>

      <label className="mt-2 block">
        <div className="mb-0.5 flex justify-between text-[11px] text-muted">
          <span>Tilt</span>
          <span className="font-mono">{pitch}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_PITCH}
          value={pitch}
          onPointerDown={() => (dragging.current = true)}
          onPointerUp={() => (dragging.current = false)}
          onChange={(e) => {
            const v = Number(e.target.value);
            setPitchState(v);
            camera.current?.setPitch(v);
          }}
          className="w-full accent-[var(--color-accent-deep)]"
        />
      </label>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setAuto(!auto)}
          className={cx("flex-1 rounded-lg px-2 py-1.5 font-semibold", auto ? "bg-accent text-navy" : "bg-panel-2 text-navy hover:brightness-95")}
        >
          {auto ? "■ Stop orbit" : "▶ Auto-orbit"}
        </button>
      </div>
      {auto && (
        <label className="mt-1.5 block">
          <div className="mb-0.5 flex justify-between text-[11px] text-muted">
            <span>Speed</span>
            <span className="font-mono">{speed}°/s</span>
          </div>
          <input type="range" min={1} max={30} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-[var(--color-accent-deep)]" />
        </label>
      )}

      <button onClick={() => camera.current?.reset()} className="mt-2 w-full rounded-lg px-2 py-1.5 text-muted hover:bg-panel-2 hover:text-navy">
        Reset view
      </button>
      <div className="mt-1 text-[10px] leading-snug text-muted">Tip: right-drag or Ctrl-drag the map to orbit freely.</div>
    </div>
  );
}
