"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRipple } from "@/lib/store";
import { SCENARIOS, TRACK_LABELS } from "@/lib/scenarios";
import { cx } from "@/lib/ui";
import { SourcesDialog } from "./SourcesDialog";

export function Header() {
  const router = useRouter();
  const scenario = useRipple((s) => s.scenario);
  const custom = useRipple((s) => s.customScenarios);
  const aiEnabled = useRipple((s) => s.aiEnabled);
  const setAiEnabled = useRipple((s) => s.setAiEnabled);
  const soundOn = useRipple((s) => s.soundOn);
  const toggleSound = useRipple((s) => s.toggleSound);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setAiEnabled(!!d.ai))
      .catch(() => setAiEnabled(false));
  }, [setAiEnabled]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-panel px-4">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-black text-ink">R</span>
        <span className="text-lg font-extrabold tracking-tight">
          Ripple<span className="text-accent">TO</span>
        </span>
      </Link>

      <select
        aria-label="Scenario"
        value={scenario.id}
        onChange={(e) => router.push(`/sim?s=${e.target.value}`)}
        className="max-w-72 truncate rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-sm font-semibold"
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

      <div className="hidden items-center gap-1.5 xl:flex">
        {scenario.tracks.map((t) => (
          <span key={t} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
            {TRACK_LABELS[t]}
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2 text-xs">
        <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-300" title="Neighbourhood numbers are placeholders until replaced with Census data — see docs/DATA.md">
          Illustrative data
        </span>
        <span
          className={cx(
            "rounded-md border px-2 py-1",
            aiEnabled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-line text-muted",
          )}
          title={aiEnabled ? "Gemini is generating resident voices and briefings" : "No GEMINI_API_KEY — using built-in templates"}
        >
          {aiEnabled === null ? "AI …" : aiEnabled ? "● AI agents live" : "○ AI offline (templates)"}
        </span>
        <button onClick={toggleSound} className="rounded-md border border-line px-2 py-1 hover:bg-panel-2" title="Toggle alert sound">
          {soundOn ? "🔊" : "🔇"}
        </button>
        <button onClick={() => setSourcesOpen(true)} className="rounded-md border border-line px-2 py-1 hover:bg-panel-2">
          Data & limits
        </button>
        <Link href={`/briefing?s=${scenario.id}`} className="rounded-md bg-accent px-3 py-1.5 font-semibold text-ink hover:brightness-110">
          Ward briefing →
        </Link>
      </div>
      <SourcesDialog open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </header>
  );
}
