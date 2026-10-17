"use client";

// Zustand store — same role as Emergent's lib/stores/ttxStoreV2.ts:
// one place for the scenario, the current period, playback and AI results.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AgentNarrative, Arm, Scenario, Simulation } from "@/lib/types";
import { SCENARIOS, SCENARIO_BY_ID } from "@/lib/scenarios";
import { PERSONAS } from "@/lib/data/personas";
import { simulate } from "@/lib/engine/model";

type AgentStatus = "idle" | "thinking" | "done" | "error";

interface RippleState {
  scenario: Scenario;
  sim: Simulation;
  customScenarios: Scenario[];

  view: Arm; // which world we're looking at
  enacted: boolean;
  armed: boolean;
  period: number; // 1-based
  playing: boolean;
  flashAt: number; // timestamp of last enact (drives the red flash)
  toast: { text: string; at: number } | null;

  narratives: Record<string, Record<string, AgentNarrative>>; // scenarioId → personaId → narrative
  agentStatus: Record<string, AgentStatus>;
  aiEnabled: boolean | null;

  selectedPersonaId: string | null;
  interviewPersonaId: string | null;
  soundOn: boolean;
  mapMode: "photo" | "3d" | "2d";

  loadScenario: (idOrScenario: string | Scenario) => void;
  addCustomScenario: (s: Scenario) => void;
  setPeriod: (p: number) => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  setPlaying: (v: boolean) => void;
  setArmed: (v: boolean) => void;
  toggleArmed: () => void;
  enact: () => void;
  setView: (v: Arm) => void;
  resetToStatusQuo: () => void;
  selectPersona: (id: string | null) => void;
  openInterview: (id: string | null) => void;
  setAiEnabled: (v: boolean) => void;
  toggleSound: () => void;
  setMapMode: (m: "photo" | "3d" | "2d") => void;
  showToast: (text: string) => void;
  runAgents: () => Promise<void>;
}

const first = SCENARIOS[0];

export const useRipple = create<RippleState>()(
  persist(
    (set, get) => ({
      scenario: first,
      sim: simulate(first),
      customScenarios: [],

      view: "baseline",
      enacted: false,
      armed: false,
      period: 1,
      playing: false,
      flashAt: 0,
      toast: null,

      narratives: {},
      agentStatus: {},
      aiEnabled: null,

      selectedPersonaId: null,
      interviewPersonaId: null,
      soundOn: true,
      mapMode: "photo",

      loadScenario: (idOrScenario) => {
        const s =
          typeof idOrScenario === "string"
            ? SCENARIO_BY_ID[idOrScenario] ?? get().customScenarios.find((c) => c.id === idOrScenario) ?? first
            : idOrScenario;
        set({
          scenario: s,
          sim: simulate(s),
          view: "baseline",
          enacted: false,
          armed: false,
          period: 1,
          playing: false,
          agentStatus: {},
          selectedPersonaId: null,
          interviewPersonaId: null,
        });
      },

      addCustomScenario: (s) => set({ customScenarios: [s, ...get().customScenarios].slice(0, 6) }),

      setPeriod: (p) => {
        const N = get().scenario.periodLabels.length;
        set({ period: Math.max(1, Math.min(N, Math.round(p))) });
      },
      next: () => {
        const { period, scenario } = get();
        if (period < scenario.periodLabels.length) set({ period: period + 1 });
        else set({ playing: false });
      },
      prev: () => set({ period: Math.max(1, get().period - 1) }),
      togglePlay: () => {
        const { playing, period, scenario } = get();
        if (!playing && period >= scenario.periodLabels.length) set({ period: 1, playing: true });
        else set({ playing: !playing });
      },
      setPlaying: (v) => set({ playing: v }),

      setArmed: (v) => {
        if (get().armed !== v) get().showToast(v ? "ARMED — press the button to enact" : "Disarmed");
        set({ armed: v });
      },
      toggleArmed: () => get().setArmed(!get().armed),

      enact: () => {
        const { armed, enacted, scenario } = get();
        if (!armed) {
          get().showToast("Lift the safety cover (or press A) to arm first");
          return;
        }
        if (enacted) {
          // Re-run the animation from the start.
          set({ view: "policy", period: 1, playing: true, flashAt: Date.now() });
          return;
        }
        set({ enacted: true, view: "policy", period: 1, playing: true, flashAt: Date.now() });
        get().showToast(`ENACTED: ${scenario.policy.name}`);
        void get().runAgents();
      },

      setView: (v) => {
        if (v === "policy" && !get().enacted) {
          get().showToast("Enact the policy first");
          return;
        }
        set({ view: v });
      },

      resetToStatusQuo: () => set({ view: "baseline", enacted: false, armed: false, period: 1, playing: false }),

      selectPersona: (id) => set({ selectedPersonaId: id }),
      openInterview: (id) => set({ interviewPersonaId: id, playing: false }),
      setAiEnabled: (v) => set({ aiEnabled: v }),
      toggleSound: () => set({ soundOn: !get().soundOn }),
      setMapMode: (m) => set({ mapMode: m }),
      showToast: (text) => set({ toast: { text, at: Date.now() } }),

      /** Fire one request per persona in parallel; cards fill in as each agent returns. */
      runAgents: async () => {
        const { scenario, narratives } = get();
        if (narratives[scenario.id] && Object.keys(narratives[scenario.id]).length === PERSONAS.length) return;
        set({ agentStatus: Object.fromEntries(PERSONAS.map((p) => [p.id, "thinking" as AgentStatus])) });
        await Promise.all(
          PERSONAS.map(async (p) => {
            try {
              const res = await fetch("/api/agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scenario, personaId: p.id }),
              });
              if (!res.ok) throw new Error(String(res.status));
              const n: AgentNarrative = await res.json();
              if (get().scenario.id !== scenario.id) return;
              set((st) => ({
                narratives: { ...st.narratives, [scenario.id]: { ...(st.narratives[scenario.id] ?? {}), [p.id]: n } },
                agentStatus: { ...st.agentStatus, [p.id]: "done" },
              }));
            } catch {
              set((st) => ({ agentStatus: { ...st.agentStatus, [p.id]: "error" } }));
            }
          }),
        );
      },
    }),
    {
      name: "ripple-to",
      storage: createJSONStorage(() => {
        try {
          return sessionStorage;
        } catch {
          // Storage blocked (private mode / sandbox) — fall back to memory.
          const mem = new Map<string, string>();
          return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
        }
      }),
      partialize: (s) => ({ customScenarios: s.customScenarios, narratives: s.narratives, soundOn: s.soundOn, mapMode: s.mapMode }),
    },
  ),
);

/** Current period's state rows for the arm being viewed. */
export function useCurrentRow() {
  return useRipple((s) => s.sim[s.view].states[s.period - 1]);
}
