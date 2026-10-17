"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SCENARIOS, TRACK_LABELS } from "@/lib/scenarios";
import { PERSONAS } from "@/lib/data/personas";
import { NEIGHBOURHOOD_BY_ID } from "@/lib/data/neighbourhoods";
import { simulate } from "@/lib/engine/model";
import { formatDelta } from "@/lib/format";
import { useRipple } from "@/lib/store";
import type { Scenario } from "@/lib/types";
import { applyThemeToDocument, themeFor } from "@/lib/themes";

const KIND_ICON = { transit: "🚌", housing: "🏠", heat: "🌡️" } as const;

function ScenarioCard({ s, i }: { s: Scenario; i: number }) {
  const teaser = useMemo(() => {
    const sim = simulate(s);
    const last = s.periodLabels.length - 1;
    const m = s.metrics.find((x) => x.id === s.heroMetric)!;
    // For the heat scenario the peak matters more than the last half-day.
    const pick = (arr: Record<string, number>[]) => (s.kind === "heat" ? Math.max(...arr.map((r) => r[m.id])) : arr[last][m.id]);
    return { m, delta: pick(sim.policy.metrics) - pick(sim.baseline.metrics) };
  }, [s]);
  const good = teaser.m.better === "up" ? teaser.delta > 0 : teaser.delta < 0;

  const t = themeFor(s.kind);

  return (
    <Link
      href={`/sim?s=${s.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ ["--card" as string]: t.accent }}
    >
      {/* Scenario atmosphere: a band of its signal colour with a soft glow */}
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: t.accent }} />
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-40 blur-3xl" style={{ background: t.accent }} />
      <div className="relative flex items-center justify-between">
        <span className="text-3xl">{KIND_ICON[s.kind]}</span>
        <span className="font-mono text-xs text-muted">press {i + 1}</span>
      </div>
      <h3 className="relative mt-3 text-lg font-bold leading-tight">{s.title}</h3>
      <p className="relative mt-1 text-sm text-muted">{s.tagline}</p>
      <div className="relative mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.deep }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
        {t.name}
      </div>
      <p className="relative mt-1 text-xs italic text-muted">{t.mood}</p>
      <div className="relative mt-4 rounded-lg p-3" style={{ background: `${t.accent}1f` }}>
        <div className="text-[11px] uppercase tracking-wider text-muted">{teaser.m.label}{s.kind === "heat" ? " (peak)" : ""}</div>
        <div className={`font-mono text-2xl font-bold ${good ? "text-good" : "text-bad"}`}>{formatDelta(teaser.delta, teaser.m.format)}</div>
        <div className="text-[11px] text-muted">with “{s.policy.name}” vs. status quo</div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {s.tracks.map((tr) => (
          <span key={tr} className="rounded-full border border-line bg-panel px-2 py-0.5 text-[10px] text-muted">
            {TRACK_LABELS[tr]}
          </span>
        ))}
      </div>
      <div className="relative mt-4 text-sm font-semibold group-hover:underline" style={{ color: t.deep }}>
        Run simulation →
      </div>
    </Link>
  );
}

function CustomScenario() {
  const router = useRouter();
  const addCustom = useRipple((s) => s.addCustomScenario);
  const loadScenario = useRipple((s) => s.loadScenario);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const examples = ["Make the TTC free for everyone under 18", "Keep every library open until midnight during heat warnings", "A $500/month housing benefit for low-income renters"];

  async function go(text: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scenario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      addCustom(d.scenario);
      loadScenario(d.scenario);
      if (d.note) useRipple.getState().showToast(d.note);
      router.push(`/sim?s=${d.scenario.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel/60 p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">✦</span>
        <h3 className="text-lg font-bold">Try your own idea</h3>
        <span className="rounded bg-info/15 px-1.5 text-[10px] font-bold text-info">EXPERIMENTAL</span>
      </div>
      <p className="mt-1 text-sm text-muted">Describe a policy in plain English. AI picks the closest model and sets it up. Rough sketch, not a forecast.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (prompt.trim()) void go(prompt.trim());
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Free TTC for seniors during heat warnings"
          className="flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-info"
        />
        <button disabled={loading} className="rounded-lg bg-info px-4 text-sm font-semibold text-navy disabled:opacity-50">
          {loading ? "Building…" : "Simulate"}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.map((ex) => (
          <button key={ex} disabled={loading} onClick={() => go(ex)} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:text-text">
            {ex}
          </button>
        ))}
      </div>
      {error && <div className="mt-2 text-sm text-danger">{error}</div>}
    </div>
  );
}

export default function Home() {
  useEffect(() => applyThemeToDocument(themeFor("transit")), []);
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-lg font-black text-navy">R</span>
        <span className="text-xl font-extrabold tracking-tight">
          Ripple<span className="text-accent-deep">TO</span>
        </span>
        <span className="ml-3 hidden text-sm text-muted sm:inline">Civic scenario simulator for Toronto</span>
      </nav>

      <section className="mt-12 max-w-3xl">
        <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
          See how a city decision <span className="text-accent-deep">ripples</span> through Toronto, one household at a time.
        </h1>
        <p className="mt-4 text-lg text-muted">
          Before the 2026 municipal election, pick a real Toronto decision, enact it, and watch twelve AI residents live through it on a map. Then
          see who comes out ahead, who pays and who gets missed, and get a plain-language briefing for any ward.
        </p>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {SCENARIOS.map((s, i) => (
          <ScenarioCard key={s.id} s={s} i={i} />
        ))}
      </section>

      <section className="mt-4">
        <CustomScenario />
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">The same 12 residents live through every scenario</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PERSONAS.map((p) => (
            <div key={p.id} className="rounded-xl border border-line bg-panel p-3">
              <div className="font-semibold">
                {p.name}, {p.age}
              </div>
              <div className="text-xs text-muted">{p.occupation}</div>
              <div className="mt-1 text-[11px] text-muted">{NEIGHBOURHOOD_BY_ID[p.neighbourhoodId]?.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        {[
          ["1 · Rules do the math", "A transparent model computes trip times, rent burden and heat risk for every household, month by month. Every number can be explained."],
          ["2 · AI gives people a voice", "Each resident is an AI agent that reacts to what happened to them. You can call any of them and ask why."],
          ["3 · Briefings for real users", "Generate a neutral, plain-language ward briefing for residents, journalists or councillors, with sources and limits."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-line bg-panel p-5">
            <div className="font-bold">{t}</div>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>

      <footer className="mt-14 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        Residents are composites built from neighbourhood patterns, not real people. We don&apos;t model race or ethnicity. Results are directional,
        not forecasts. Ripple is non-partisan and does not predict or endorse any candidate. Map © OpenStreetMap contributors © CARTO.
      </footer>
    </div>
  );
}
