"use client";

import { useEffect, useRef } from "react";
import { useRipple } from "@/lib/store";
import { PERSONAS } from "@/lib/data/personas";
import { NEIGHBOURHOOD_BY_ID } from "@/lib/data/neighbourhoods";
import { SENTIMENT_EMOJI, cx, stateColor } from "@/lib/ui";
import type { Persona, PersonaState } from "@/lib/types";

function KeyNumbers({ st }: { st: PersonaState }) {
  const items: [string, string][] = [];
  if (st.tripMin !== undefined && st.mode !== "bike" && st.mode !== "walk") items.push(["Trip", `${st.tripMin} min`]);
  if (st.burdenPct !== undefined) items.push(["Housing + transport", `${st.burdenPct}% of income`]);
  if (st.monthlyCost !== undefined) items.push(["Monthly cost", `$${st.monthlyCost.toLocaleString()}`]);
  if (st.heatRisk) items.push(["Heat risk", st.heatRisk]);
  if (st.nearestOpenSiteKm !== undefined) items.push(["Nearest open cool space", `${st.nearestOpenSiteKm} km`]);
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-md bg-ink/60 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wide text-muted">{k}</div>
          <div className="font-mono text-sm font-bold capitalize">{v}</div>
        </div>
      ))}
    </div>
  );
}

function Card({ p, i }: { p: Persona; i: number }) {
  const scenario = useRipple((s) => s.scenario);
  const view = useRipple((s) => s.view);
  const period = useRipple((s) => s.period);
  const enacted = useRipple((s) => s.enacted);
  const st = useRipple((s) => s.sim[s.view].states[s.period - 1][i]);
  const other = useRipple((s) => s.sim.baseline.states[s.period - 1][i]);
  const narrative = useRipple((s) => s.narratives[s.scenario.id]?.[p.id]);
  const status = useRipple((s) => s.agentStatus[p.id]);
  const selected = useRipple((s) => s.selectedPersonaId === p.id);
  const select = useRipple((s) => s.selectPersona);
  const openInterview = useRipple((s) => s.openInterview);
  const ref = useRef<HTMLDivElement>(null);
  const n = NEIGHBOURHOOD_BY_ID[p.neighbourhoodId];
  const thought = view === "policy" ? narrative?.periods.find((x) => x.period === period) : undefined;

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  return (
    <div
      ref={ref}
      onClick={() => select(selected ? null : p.id)}
      className={cx(
        "cursor-pointer rounded-xl border p-3 transition-colors",
        selected ? "border-accent bg-panel-2" : "border-line bg-panel hover:border-slate-600",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-ink"
          style={{ background: stateColor(scenario, st) }}
        >
          {p.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate font-semibold">
              {p.name}, {p.age}
            </div>
            <div className="shrink-0 text-[10px] text-muted">Ward {n?.ward}</div>
          </div>
          <div className="truncate text-xs text-muted">
            {p.occupation} · {n?.name}
          </div>
          <div className="mt-1 text-[13px] leading-snug">{st.decisionLabel}</div>
          {view === "policy" && enacted && status === "thinking" && !narrative && (
            <div className="thinking mt-1.5 text-xs italic text-muted">agent thinking…</div>
          )}
          {thought && (
            <div className="mt-1.5 rounded-lg bg-ink/60 px-2 py-1.5 text-xs italic leading-snug text-slate-300">
              <span className="not-italic">{SENTIMENT_EMOJI[thought.sentiment]}</span> “{thought.thought}”
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="mt-3 space-y-3 border-t border-line pt-3 text-sm" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs leading-relaxed text-muted">{p.bio}</p>
          <KeyNumbers st={st} />
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">Why (from the model)</div>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-300">
              {st.drivers.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          {view === "policy" && (
            <div className="rounded-md border border-line px-2 py-1.5 text-xs text-muted">
              <b className="text-text">Without the policy:</b> {other.decisionLabel}
              {narrative?.baselineReflection && <div className="mt-1 italic">“{narrative.baselineReflection}”</div>}
            </div>
          )}
          <button
            onClick={() => openInterview(p.id)}
            className="w-full rounded-lg bg-info/15 py-2 text-sm font-semibold text-info hover:bg-info/25"
          >
            📞 Call {p.name} <span className="text-xs text-muted">(I)</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function PersonaPanel() {
  const view = useRipple((s) => s.view);
  const row = useRipple((s) => s.sim[s.view].states[s.period - 1]);
  const counts = { better: 0, same: 0, worse: 0 };
  row.forEach((st) => counts[st.impact]++);

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-line bg-ink">
      <div className="border-b border-line px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Residents · 12 composite households</div>
        <div className="mt-1 flex gap-3 text-xs">
          <span className="text-good">▲ {counts.better} better</span>
          <span className="text-muted">● {counts.same} no change</span>
          <span className="text-bad">▼ {counts.worse} worse</span>
          <span className="ml-auto text-muted">{view === "policy" ? "vs status quo" : "vs today"}</span>
        </div>
      </div>
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-3">
        {PERSONAS.map((p, i) => (
          <Card key={p.id} p={p} i={i} />
        ))}
      </div>
    </aside>
  );
}
