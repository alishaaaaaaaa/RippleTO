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
  if (st.burdenPct !== undefined) items.push(["Housing + transport", `${st.burdenPct}%`]);
  if (st.monthlyCost !== undefined) items.push(["Monthly cost", `$${st.monthlyCost.toLocaleString()}`]);
  if (st.heatRisk) items.push(["Heat risk", st.heatRisk]);
  if (st.nearestOpenSiteKm !== undefined) items.push(["Nearest cool space", `${st.nearestOpenSiteKm} km`]);
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-md bg-panel-2 px-2 py-1">
          <div className="text-[10px] text-muted">{k}</div>
          <div className="font-mono text-[13px] font-bold capitalize">{v}</div>
        </div>
      ))}
    </div>
  );
}

/** One compact row per resident; details only for the selected one. */
function Row({ p, i }: { p: Persona; i: number }) {
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
  const color = stateColor(scenario, st);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  return (
    <div
      ref={ref}
      onClick={() => select(selected ? null : p.id)}
      className={cx("cursor-pointer rounded-xl px-3 py-2.5 transition-colors", selected ? "bg-panel shadow-md ring-1 ring-line" : "hover:bg-panel/70")}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-navy" style={{ background: color }}>
            {p.name[0]}
          </div>
          {status === "thinking" && view === "policy" && !narrative && (
            <span className="thinking absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold">{p.name}</span>
            <span className="text-xs text-muted">{p.age}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted">{n?.name}</span>
          </div>
          <div className="truncate text-xs text-muted">{st.decisionLabel}</div>
        </div>
      </div>

      {!selected && thought && (
        <div className="mt-1 truncate pl-11 text-xs italic text-slate-500">
          {SENTIMENT_EMOJI[thought.sentiment]} “{thought.thought}”
        </div>
      )}

      {selected && (
        <div className="mt-3 space-y-3 pl-11 text-sm" onClick={(e) => e.stopPropagation()}>
          {thought && (
            <div className="rounded-lg bg-accent/10 px-2.5 py-2 text-xs italic leading-snug text-slate-700">
              {SENTIMENT_EMOJI[thought.sentiment]} “{thought.thought}”
            </div>
          )}
          {view === "policy" && enacted && status === "thinking" && !narrative && <div className="thinking text-xs italic text-muted">agent thinking…</div>}
          <p className="text-xs leading-relaxed text-muted">
            {p.occupation}. {p.bio}
          </p>
          <KeyNumbers st={st} />
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent-deep">Why</div>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600">
              {st.drivers.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          {view === "policy" && <div className="text-xs text-muted">Without the policy: {other.decisionLabel}</div>}
          <button onClick={() => openInterview(p.id)} className="w-full rounded-lg bg-navy py-2 text-xs font-semibold text-white hover:opacity-90">
            Call {p.name} <span className="opacity-60">(I)</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function PersonaPanel() {
  const view = useRipple((s) => s.view);
  const scenario = useRipple((s) => s.scenario);
  const row = useRipple((s) => s.sim[s.view].states[s.period - 1]);
  const counts = { better: 0, same: 0, worse: 0 };
  row.forEach((st) => counts[st.impact]++);

  return (
    <aside className="flex h-full w-[290px] shrink-0 flex-col border-r border-line bg-ink">
      <div className="px-4 pb-2 pt-4">
        <div className="text-xs font-semibold text-muted">12 residents</div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-panel-2" title={`${counts.better} better · ${counts.same} no change · ${counts.worse} worse ${view === "policy" ? "vs status quo" : "vs today"}`}>
          <div style={{ width: `${(counts.better / 12) * 100}%`, background: stateColor(scenario, { ...row[0], impact: "better", heatRisk: "low", burdenPct: 30, movedOut: false }) }} />
          <div className="bg-slate-300" style={{ width: `${(counts.same / 12) * 100}%` }} />
          <div style={{ width: `${(counts.worse / 12) * 100}%`, background: "#ff5470" }} />
        </div>
        <div className="mt-1.5 flex gap-3 text-[11px] text-muted">
          <span>{counts.better} better</span>
          <span>{counts.same} same</span>
          <span>{counts.worse} worse</span>
        </div>
      </div>
      <div className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {PERSONAS.map((p, i) => (
          <Row key={p.id} p={p} i={i} />
        ))}
      </div>
    </aside>
  );
}
