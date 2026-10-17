"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRipple } from "@/lib/store";
import { SCENARIOS } from "@/lib/scenarios";
import { cx } from "@/lib/ui";
import { SourcesDialog } from "./SourcesDialog";
import { PanelButton } from "./PanelButton";

const SHORTCUTS: [string, string][] = [
  ["← / →", "Move through time"],
  ["Space", "Play / pause"],
  ["A / D", "Arm / disarm"],
  ["E", "Enact the policy"],
  ["B", "Compare status quo ↔ policy"],
  ["I", "Call the selected resident"],
  ["1 2 3", "Switch scenario"],
];

/** Minimal header: brand, scenario, one primary action. Everything else lives in the ⋯ menu. */
export function Header() {
  const router = useRouter();
  const scenario = useRipple((s) => s.scenario);
  const custom = useRipple((s) => s.customScenarios);
  const aiEnabled = useRipple((s) => s.aiEnabled);
  const setAiEnabled = useRipple((s) => s.setAiEnabled);
  const soundOn = useRipple((s) => s.soundOn);
  const toggleSound = useRipple((s) => s.toggleSound);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setAiEnabled(!!d.ai))
      .catch(() => setAiEnabled(false));
  }, [setAiEnabled]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <header className="relative z-[1000] flex h-14 shrink-0 items-center gap-4 border-b border-line bg-panel/95 px-5 backdrop-blur">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-black text-navy">R</span>
        <span className="text-base font-extrabold tracking-tight">
          Ripple<span className="text-accent-deep">TO</span>
        </span>
      </Link>

      <span className="h-5 w-px bg-line" />

      <select
        aria-label="Scenario"
        value={scenario.id}
        onChange={(e) => router.push(`/sim?s=${e.target.value}`)}
        className="max-w-80 truncate rounded-lg border-0 bg-transparent py-1.5 pr-6 text-sm font-semibold outline-none hover:bg-panel-2"
      >
        {SCENARIOS.map((s, i) => (
          <option key={s.id} value={s.id}>
            {i + 1}. {s.title}
          </option>
        ))}
        {custom.map((s) => (
          <option key={s.id} value={s.id}>
            ✦ {s.title}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href={`/briefing?s=${scenario.id}`}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-navy shadow-sm hover:brightness-105"
        >
          Ward briefing
        </Link>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-muted hover:bg-panel-2"
            aria-label="More"
            aria-expanded={menuOpen}
          >
            ⋯
            <span
              className={cx("absolute right-1 top-1 h-1.5 w-1.5 rounded-full", aiEnabled ? "bg-emerald-500" : "bg-slate-300")}
              title={aiEnabled ? "AI agents live" : "AI offline"}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-72 overflow-hidden rounded-xl border border-line bg-panel text-sm shadow-xl">
              <div className="space-y-1 border-b border-line p-3 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <span className={cx("h-2 w-2 rounded-full", aiEnabled ? "bg-emerald-500" : "bg-slate-300")} />
                  {aiEnabled === null ? "Checking AI…" : aiEnabled ? "AI agents live (Gemini)" : "AI offline — using built-in templates"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" /> 2021 Census neighbourhood data
                </div>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setSourcesOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-panel-2"
                >
                  Data, assumptions & limits
                </button>
                <button onClick={toggleSound} className="w-full rounded-lg px-3 py-2 text-left hover:bg-panel-2">
                  Alert sound: {soundOn ? "on" : "off"}
                </button>
                <div className="px-1.5 py-1 [&>button]:w-full [&>button]:text-left">
                  <PanelButton />
                </div>
              </div>
              <div className="border-t border-line p-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Panel / keyboard</div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {SHORTCUTS.map(([k, v]) => (
                    <div key={k} className="contents">
                      <kbd className="rounded bg-panel-2 px-1.5 font-mono text-[11px]">{k}</kbd>
                      <span className="text-muted">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <SourcesDialog open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </header>
  );
}
