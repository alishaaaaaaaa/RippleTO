"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRipple } from "@/lib/store";
import { formatDelta, formatMetric } from "@/lib/format";
import { SEVERITY_COLOR, cx } from "@/lib/ui";
import type { MetricDef } from "@/lib/types";

function useAnimatedNumber(target: number, ms = 600) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const cur = useRef(target);
  useEffect(() => {
    from.current = cur.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const val = from.current + (target - from.current) * (1 - Math.pow(1 - t, 3));
      cur.current = val;
      setV(val);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Sparkline({ base, policy, upTo, showPolicy }: { base: number[]; policy: number[]; upTo: number; showPolicy: boolean }) {
  const all = [...base, ...(showPolicy ? policy : [])];
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 1);
  const W = 120;
  const H = 32;
  const x = (i: number) => (i / Math.max(1, base.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const path = (arr: number[]) =>
    arr
      .slice(0, upTo)
      .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={path(base)} fill="none" stroke="#8b97ab" strokeWidth={1.5} strokeDasharray={showPolicy ? "3 3" : undefined} />
      {showPolicy && <path d={path(policy)} fill="none" stroke="#f5a524" strokeWidth={2} />}
    </svg>
  );
}

function MetricRow({ m, hero }: { m: MetricDef; hero?: boolean }) {
  const view = useRipple((s) => s.view);
  const enacted = useRipple((s) => s.enacted);
  const period = useRipple((s) => s.period);
  // Select stable arrays from the store, then derive (selectors must not return new arrays each call).
  const baseMetrics = useRipple((s) => s.sim.baseline.metrics);
  const policyMetrics = useRipple((s) => s.sim.policy.metrics);
  const baseSeries = useMemo(() => baseMetrics.map((x) => x[m.id]), [baseMetrics, m.id]);
  const policySeries = useMemo(() => policyMetrics.map((x) => x[m.id]), [policyMetrics, m.id]);
  const value = (view === "policy" ? policySeries : baseSeries)[period - 1];
  const animated = useAnimatedNumber(value);
  const showCompare = enacted && view === "policy";
  const delta = policySeries[period - 1] - baseSeries[period - 1];
  const good = m.better === "up" ? delta > 0 : delta < 0;

  return (
    <div className={cx("rounded-xl border border-line bg-panel p-3", hero && "border-accent/40 bg-gradient-to-br from-accent/10 to-transparent")}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-muted" title={m.description}>
          {m.label}
        </div>
        <Sparkline base={baseSeries} policy={policySeries} upTo={period} showPolicy={showCompare} />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className={cx("font-mono font-bold tabular-nums", hero ? "text-3xl" : "text-xl")}>{formatMetric(animated, m.format)}</div>
        {showCompare && Math.abs(delta) > 0.0001 && (
          <div className={cx("font-mono text-xs font-semibold", good ? "text-good" : "text-bad")}>{formatDelta(delta, m.format)} vs status quo</div>
        )}
      </div>
      {hero && <div className="mt-1 text-[11px] leading-snug text-muted">{m.description}</div>}
    </div>
  );
}

export function MetricsPanel() {
  const scenario = useRipple((s) => s.scenario);
  const view = useRipple((s) => s.view);
  const period = useRipple((s) => s.period);
  const hero = scenario.metrics.find((m) => m.id === scenario.heroMetric) ?? scenario.metrics[0];
  const rest = scenario.metrics.filter((m) => m.id !== hero.id);
  const events = scenario.events
    .filter((e) => e.arm === "both" || e.arm === view)
    .filter((e) => e.period <= period)
    .sort((a, b) => b.period - a.period);

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-ink">
      <div className="border-b border-line px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {view === "policy" ? "With policy" : "Status quo"} · {scenario.periodLabels[period - 1]}
        </div>
      </div>
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-3">
        <MetricRow m={hero} hero />
        <div className="grid grid-cols-1 gap-2">
          {rest.map((m) => (
            <MetricRow key={m.id} m={m} />
          ))}
        </div>

        <div className="pt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Event feed</div>
          <div className="space-y-2">
            {events.length === 0 && <div className="text-xs text-muted">Nothing yet.</div>}
            {events.map((e, i) => (
              <div
                key={`${e.period}-${e.title}`}
                className={cx("rounded-lg border border-line bg-panel p-2.5", e.period === period ? "opacity-100" : "opacity-60")}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[e.severity] }} />
                  <span className="font-mono text-muted">{scenario.periodLabels[e.period - 1]}</span>
                  {i === 0 && e.period === period && <span className="rounded bg-accent/20 px-1.5 text-[10px] font-bold text-accent">NEW</span>}
                </div>
                <div className="mt-1 text-sm font-semibold">{e.title}</div>
                <div className="text-xs leading-snug text-muted">{e.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
