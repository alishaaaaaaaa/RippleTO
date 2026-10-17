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

const SimMap = dynamic(() => import("@/components/SimMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading map…</div>,
});

function ScenarioBanner() {
  const scenario = useRipple((s) => s.scenario);
  const view = useRipple((s) => s.view);
  const [open, setOpen] = useState(true);
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex justify-center">
      <div className="pointer-events-auto max-w-3xl rounded-xl border border-line bg-panel/90 px-4 py-3 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={
                  view === "policy"
                    ? "rounded bg-accent px-1.5 py-0.5 text-[10px] font-black tracking-wider text-ink"
                    : "rounded bg-slate-300 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-ink"
                }
              >
                {view === "policy" ? "WITH POLICY" : "STATUS QUO"}
              </span>
              <h1 className="truncate font-bold">{scenario.title}</h1>
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
          <button onClick={() => setOpen(!open)} className="text-xs text-muted hover:text-text">
            {open ? "Hide" : "More"}
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyHints() {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-[500] rounded-lg border border-line bg-panel/90 px-3 py-2 font-mono text-[10px] leading-relaxed text-muted backdrop-blur">
      <div className="mb-0.5 font-sans font-semibold uppercase tracking-wider">Panel / keyboard</div>
      ←/→ time · Space play · A arm · E enact
      <br />B compare · I call resident · 1-3 scenario
    </div>
  );
}

function SimInner() {
  const params = useSearchParams();
  const id = params.get("s");
  const loadScenario = useRipple((s) => s.loadScenario);
  const current = useRipple((s) => s.scenario.id);
  useControls();

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
            <SimMap />
            <ScenarioBanner />
            <KeyHints />
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
