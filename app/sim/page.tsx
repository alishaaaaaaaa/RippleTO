"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useRipple } from "@/lib/store";
import { useControls } from "@/lib/useControls";
import { Header } from "@/components/Header";
import { PersonaPanel } from "@/components/PersonaPanel";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ControlConsole } from "@/components/ControlConsole";
import { InterviewDialog } from "@/components/InterviewDialog";
import { Overlays } from "@/components/Overlays";
import { applyThemeToDocument, themeFor } from "@/lib/themes";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading map…</div>,
});

function ScenarioBanner() {
  const scenario = useRipple((s) => s.scenario);
  const view = useRipple((s) => s.view);
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-[min(520px,calc(100%-140px))]">
      <div className="pointer-events-auto rounded-xl bg-panel/85 px-3.5 py-2.5 shadow-lg ring-1 ring-line backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={
                  view === "policy"
                    ? "rounded bg-accent px-1.5 py-0.5 text-[10px] font-black tracking-wider text-navy"
                    : "rounded bg-slate-300 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-navy"
                }
              >
                {view === "policy" ? "WITH POLICY" : "STATUS QUO"}
              </span>
              <h1 className="truncate text-sm font-bold">{scenario.title}</h1>
              {scenario.isCustom && <span className="rounded bg-info/20 px-1.5 text-[10px] font-bold text-info">CUSTOM</span>}
            </div>
            {open && (
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {scenario.civicQuestion}
                <br />
                <b className="text-text">{view === "policy" ? scenario.policy.name : scenario.baseline.name}:</b>{" "}
                {view === "policy" ? scenario.policy.description : scenario.baseline.description}
              </p>
            )}
          </div>
          <button onClick={() => setOpen(!open)} className="shrink-0 text-xs text-muted hover:text-text" aria-label="About this scenario">
            {open ? "Less" : "About"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SimInner() {
  const params = useSearchParams();
  const id = params.get("s");
  const loadScenario = useRipple((s) => s.loadScenario);
  const current = useRipple((s) => s.scenario.id);
  const kind = useRipple((s) => s.scenario.kind);
  useControls();

  // Each scenario's signal colour tints the whole interface (the base stays near-white).
  useEffect(() => applyThemeToDocument(themeFor(kind)), [kind]);

  useEffect(() => {
    if (id && id !== current) loadScenario(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <div className="flex min-h-0 flex-1">
        <PersonaPanel />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <MapView />
            <ScenarioBanner />
          </div>
          <ControlConsole />
        </main>
        <MetricsPanel />
      </div>
      <InterviewDialog />
      <Overlays />
    </div>
  );
}

export default function SimPage() {
  return (
    <Suspense fallback={<div className="grid h-screen place-items-center text-muted">Loading…</div>}>
      <SimInner />
    </Suspense>
  );
}
