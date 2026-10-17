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
  const W = 250;
  const H = 36;
  const x = (i: number) => (i / Math.max(1, base.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const path = (arr: number[]) =>
    arr
      .slice(0, upTo)
      .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={path(base)} fill="none" stroke="#9aa8bd" strokeWidth={1.5} strokeDasharray={showPolicy ? "3 3" : undefined} />
      {showPolicy && <path d={path(policy)} fill="none" style={{ stroke: "var(--color-accent-deep)" }} strokeWidth={2} />}
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

  if (hero)
    return (
      <div className="rounded-2xl bg-panel p-4 shadow-sm ring-1 ring-line">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" style={{ boxShadow: "0 0 8px var(--color-accent)" }} />
          <div className="text-xs font-medium text-muted" title={m.description}>
            {m.label}
          </div>
        </div>
        <div className="mt-2 font-mono text-4xl font-bold tabular-nums tracking-tight">{formatMetric(animated, m.format)}</div>
        <div className="mt-1 h-5">
          {showCompare && Math.abs(delta) > 0.0001 && (
            <span className={cx("font-mono text-xs font-semibold", good ? "text-good" : "text-bad")}>{formatDelta(delta, m.format)} vs status quo</span>
          )}
        </div>
        <div className="mt-2">
          <Sparkline base={baseSeries} policy={policySeries} upTo={period} showPolicy={showCompare} />
        </div>
      </div>
    );

  return (
    <div className="rounded-xl bg-panel px-3 py-2.5 ring-1 ring-line" title={m.description}>
      <div className="line-clamp-2 min-h-[2.4em] text-[11px] leading-tight text-muted">{m.label}</div>
      <div className="mt-1 font-mono text-base font-bold tabular-nums">{formatMetric(animated, m.format)}</div>
      <div className="h-4">
        {showCompare && Math.abs(delta) > 0.0001 && (
          <span className={cx("font-mono text-[10px] font-semibold", good ? "text-good" : "text-bad")}>{formatDelta(delta, m.format)}</span>
        )}
      </div>
    </div>
  );
}

export function MetricsPanel() {
  const scenario = useRipple((s) => s.scenario);
  const view = useRipple((s) => s.view);
  const period = useRipple((s) => s.period);
  const hero = scenario.metrics.find((m) => m.id === scenario.heroMetric) ?? scenario.metrics[0];
  const rest = scenario.metrics.filter((m) => m.id !== hero.id);
  const visible = scenario.events.filter((e) => (e.arm === "both" || e.arm === view) && e.period <= period).sort((a, b) => b.period - a.period);
  const now = visible.filter((e) => e.period === period);
  const latest = now.length ? now : visible.slice(0, 1);

  return (
    <aside className="flex h-full w-[290px] shrink-0 flex-col border-l border-line bg-ink">
      <div className="px-4 pb-2 pt-4 text-xs font-semibold text-muted">
        {view === "policy" ? "With policy" : "Status quo"} · {scenario.periodLabels[period - 1]}
      </div>
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-3 pb-4">
        <MetricRow m={hero} hero />
        <div className="grid grid-cols-2 gap-2">
          {rest.map((m) => (
            <MetricRow key={m.id} m={m} />
          ))}
        </div>

        {latest.length > 0 && (
          <div className="space-y-2 pt-1">
            {latest.map((e) => (
              <div key={`${e.period}-${e.title}`} className={cx("rounded-xl border-l-[3px] bg-panel px-3 py-2.5 ring-1 ring-line", e.period !== period && "opacity-60")} style={{ borderLeftColor: SEVERITY_COLOR[e.severity] }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {e.period === period ? "Now" : scenario.periodLabels[e.period - 1]}
                </div>
                <div className="mt-0.5 text-sm font-semibold leading-snug">{e.title}</div>
                <div className="mt-0.5 text-xs leading-snug text-muted">{e.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
