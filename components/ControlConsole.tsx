"use client";

import { useRipple } from "@/lib/store";
import { cx } from "@/lib/ui";

/**
 * On-screen twin of the hardware panel: timeline knob, arm switch, big red button.
 * Everything here is also reachable from the keyboard (= the Pico panel).
 */
export function ControlConsole() {
  const scenario = useRipple((s) => s.scenario);
  const period = useRipple((s) => s.period);
  const playing = useRipple((s) => s.playing);
  const view = useRipple((s) => s.view);
  const enacted = useRipple((s) => s.enacted);
  const armed = useRipple((s) => s.armed);
  const { setPeriod, togglePlay, prev, next, setView, toggleArmed, enact, setPlaying, resetToStatusQuo } = useRipple.getState();
  const N = scenario.periodLabels.length;

  return (
    <div className="flex shrink-0 items-stretch gap-4 border-t border-line bg-panel px-4 py-3">
      {/* Timeline */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="rounded-md border border-line px-2 py-1 text-sm hover:bg-panel-2" aria-label="Previous period">
            ◀
          </button>
          <button
            onClick={togglePlay}
            className="w-20 rounded-md bg-navy px-3 py-1 text-sm font-bold text-white hover:brightness-90"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚ Pause" : "▶ Play"}
          </button>
          <button onClick={next} className="rounded-md border border-line px-2 py-1 text-sm hover:bg-panel-2" aria-label="Next period">
            ▶
          </button>
          <div className="ml-2 font-mono text-lg font-bold">{scenario.periodLabels[period - 1]}</div>
          <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-line text-xs font-semibold">
            <button
              onClick={() => setView("baseline")}
              className={cx("px-3 py-1.5", view === "baseline" ? "bg-slate-200 text-navy" : "text-muted hover:bg-panel-2")}
            >
              Status quo
            </button>
            <button
              onClick={() => setView("policy")}
              className={cx("px-3 py-1.5", view === "policy" ? "bg-accent text-navy" : "text-muted hover:bg-panel-2", !enacted && "opacity-40")}
            >
              With policy
            </button>
          </div>
        </div>
        <input
          type="range"
          min={1}
          max={N}
          value={period}
          onChange={(e) => {
            setPlaying(false);
            setPeriod(Number(e.target.value));
          }}
          className="w-full accent-[var(--color-accent-deep)]"
          aria-label="Timeline"
        />
        <div className="flex justify-between font-mono text-[10px] text-muted">
          {scenario.periodLabels.map((l, i) => (
            <span key={l} className={cx(i + 1 === period && "font-bold text-accent-deep")}>
              {N > 10 ? l.replace("Month ", "M") : l.replace(" · ", " ").replace("Day ", "D")}
            </span>
          ))}
        </div>
      </div>

      {/* Arm + enact */}
      <div className="flex items-center gap-3 border-l border-line pl-4">
        <button
          onClick={toggleArmed}
          className={cx(
            "flex h-[76px] w-[86px] flex-col items-center justify-center rounded-xl border-2 text-[11px] font-black tracking-widest transition-colors",
            armed ? "border-danger bg-danger/15 text-danger" : "border-line bg-panel-2 text-muted",
          )}
          title="Safety cover — key A to arm, D to disarm"
        >
          <span className="text-2xl">{armed ? "🔓" : "🔒"}</span>
          {armed ? "ARMED" : "SAFE"}
          <span className="mt-0.5 font-mono text-[9px] font-normal tracking-normal">A / D</span>
        </button>
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={enact}
            className={cx(
              "grid h-[76px] w-[76px] place-items-center rounded-full border-4 text-center text-[10px] font-black uppercase leading-tight transition",
              armed ? "armed-glow border-red-300 bg-danger text-white hover:brightness-110 active:scale-95" : "border-red-200 bg-red-50 text-red-300",
            )}
            title="Enact — key E"
          >
            {enacted ? "Replay" : "Enact"}
          </button>
        </div>
        <div className="w-40 text-xs leading-snug">
          <div className="font-semibold">{scenario.policy.enactLabel}</div>
          <div className="mt-0.5 text-muted">{enacted ? "Policy enacted. Press B to compare worlds." : armed ? "Press the button (E)." : "Arm first (A), then press (E)."}</div>
          {enacted && (
            <button onClick={resetToStatusQuo} className="mt-1 text-[11px] text-info underline">
              Reset to status quo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
