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
import { RippleMark, Wordmark } from "@/components/RippleMark";
import { RippleHero } from "@/components/RippleHero";

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
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-panel p-5 ring-1 ring-line transition hover:ring-2 focus-visible:outline-none focus-visible:ring-2"
    >
      {/* The scenario's own ripple, in its signal colour */}
      <svg className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 opacity-70 transition-transform duration-500 group-hover:scale-110" viewBox="0 0 100 100" aria-hidden="true">
        {[46, 34, 22].map((r, k) => (
          <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={k === 2 ? t.deep : t.accent} strokeWidth={k === 2 ? 1.6 : 1.2} opacity={0.35 + k * 0.2} />
        ))}
        <circle cx="50" cy="50" r="9" fill={t.accent} />
      </svg>
      <div className="relative text-xs text-muted">Press {i + 1} on the panel</div>
      <h3 className="relative mt-6 max-w-[15ch] font-display text-2xl font-bold leading-[1.1] tracking-tight text-navy">{s.title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-muted">{s.tagline}</p>
      <div className="relative mt-auto pt-5">
        <div className="text-xs text-muted">
          {teaser.m.label}
          {s.kind === "heat" ? " at peak" : ""}, with the policy
        </div>
        <div className={`font-display text-3xl font-bold tracking-tight ${good ? "text-good" : "text-bad"}`}>{formatDelta(teaser.delta, teaser.m.format)}</div>
      </div>
      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {s.tracks.map((tr) => (
          <span key={tr} className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] text-muted">
            {TRACK_LABELS[tr]}
          </span>
        ))}
      </div>
      <div className="relative mt-4 text-sm font-bold" style={{ color: t.deep }}>
        Run this scenario
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
    <div className="rounded-2xl bg-panel p-5 ring-1 ring-line">
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-xl font-bold tracking-tight text-navy">Try your own idea</h3>
        <span className="text-xs text-muted">Experimental</span>
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
          className="flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent-deep"
        />
        <button disabled={loading} className="rounded-lg bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">
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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav className="flex items-center gap-2.5">
        <RippleMark size={30} />
        <Wordmark size="text-xl" />
        <span className="ml-auto hidden text-sm text-muted sm:inline">A civic scenario simulator for Toronto</span>
      </nav>

      <section className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <h1 className="font-display text-[clamp(2.6rem,5.4vw,4.4rem)] font-bold leading-[0.98] tracking-[-0.035em] text-navy">
            Drop a decision into Toronto. See who it reaches.
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted">
            Pick a real city decision and enact it. The effect spreads out across the map, street by street, to twelve AI residents who live
            through it and tell you how it went. Then get a plain-language briefing for any ward.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={`/sim?s=${SCENARIOS[0].id}`} className="rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-deep">
              Start with the Jane St bus lanes
            </Link>
            <a href="#scenarios" className="rounded-xl px-4 py-3 text-sm font-bold text-navy ring-1 ring-line hover:bg-panel">
              See all scenarios
            </a>
          </div>
        </div>
        <RippleHero scenario={SCENARIOS[0]} />
      </section>

      <section id="scenarios" className="mt-20">
        <h2 className="font-display text-2xl font-bold tracking-tight text-navy">Three decisions to try</h2>
        <p className="mt-1 text-sm text-muted">Each one sends its ripple out in its own colour.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {SCENARIOS.map((s, i) => (
            <ScenarioCard key={s.id} s={s} i={i} />
          ))}
        </div>
        <div className="mt-4">
          <CustomScenario />
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-bold tracking-tight text-navy">The same twelve residents live through every scenario</h2>
        <p className="mt-1 text-sm text-muted">Composites built from 2021 Census patterns for their neighbourhoods.</p>
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {PERSONAS.map((p) => (
            <div key={p.id}>
              <div className="font-display text-lg font-bold leading-tight text-navy">
                {p.name}, {p.age}
              </div>
              <div className="text-sm leading-snug text-muted">{p.occupation}</div>
              <div className="mt-0.5 text-xs text-muted">{NEIGHBOURHOOD_BY_ID[p.neighbourhoodId]?.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 grid gap-8 md:grid-cols-3">
        {[
          ["Rules do the math", "A transparent model computes trip times, rent burden and heat risk for every household, period by period. Every number can be explained."],
          ["AI gives people a voice", "Each resident is an AI agent that reacts to what happened to them. Call any of them and ask why."],
          ["Briefings for real users", "Generate a neutral ward briefing for residents, journalists or councillors, with sources and limits."],
        ].map(([t, d]) => (
          <div key={t} className="border-t-2 border-navy pt-4">
            <div className="font-display text-lg font-bold text-navy">{t}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </section>

      <footer className="mt-20 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        Residents are composites built from neighbourhood patterns, not real people. We don&apos;t model race or ethnicity. Results are directional,
        not forecasts. Ripple is non-partisan and does not predict or endorse any candidate. Map © OpenStreetMap contributors.
      </footer>
    </div>
  );
}
