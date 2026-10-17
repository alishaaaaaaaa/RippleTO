"use client";

// "Call a resident" — Emergent used an ElevenLabs voice agent; we use the
// browser's free built-in speech (Web Speech API) so there's no extra API key.
// Speech recognition works in Chrome/Edge; typing always works.

import { useEffect, useRef, useState } from "react";
import { useRipple } from "@/lib/store";
import { PERSONA_BY_ID } from "@/lib/data/personas";
import { NEIGHBOURHOOD_BY_ID } from "@/lib/data/neighbourhoods";
import type { ChatMessage } from "@/lib/types";
import { Modal } from "./Modal";

const SUGGESTIONS = ["Tell me about yourself", "How has this changed your week?", "Why did that happen to you?", "What would you want the City to do?"];

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

function speak(text: string, persona?: { age: number }) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = persona && persona.age >= 65 ? 0.92 : 1.02;
    u.lang = "en-CA";
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function InterviewDialog() {
  const personaId = useRipple((s) => s.interviewPersonaId);
  const close = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    useRipple.getState().openInterview(null);
  };
  const scenario = useRipple((s) => s.scenario);
  const view = useRipple((s) => s.view);
  const period = useRipple((s) => s.period);
  const persona = personaId ? PERSONA_BY_ID[personaId] : undefined;

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory([]);
    setInput("");
  }, [personaId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  async function ask(text: string) {
    if (!persona || !text.trim() || loading) return;
    const next: ChatMessage[] = [...history, { role: "user", text }];
    setHistory(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, personaId: persona.id, period, arm: view, history, message: text }),
      });
      const d = await res.json();
      const reply = d.reply ?? "Sorry, the line cut out.";
      setHistory([...next, { role: "persona", text: reply }]);
      if (voiceOn) speak(reply, persona);
    } catch {
      setHistory([...next, { role: "persona", text: "Sorry, the line cut out — can you ask again?" }]);
    } finally {
      setLoading(false);
    }
  }

  function toggleMic() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      alert("Voice input needs Chrome or Edge. You can type instead.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-CA";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      void ask(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  if (!persona) return null;
  const n = NEIGHBOURHOOD_BY_ID[persona.neighbourhoodId];

  return (
    <Modal
      open={!!persona}
      onClose={close}
      title={
        <span>
          📞 {persona.name}, {persona.age} · <span className="font-normal text-muted">{n?.name} · {scenario.periodLabels[period - 1]} · {view === "policy" ? "with policy" : "status quo"}</span>
        </span>
      }
    >
      <div className="flex h-[55vh] flex-col">
        <div className="scroll-thin flex-1 space-y-3 overflow-y-auto pr-1">
          {history.length === 0 && (
            <div className="rounded-lg border border-line bg-panel-2 p-3 text-sm text-muted">
              You&apos;re calling {persona.name}. They&apos;ll answer based on what has happened to them in the simulation so far. {persona.bio}
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-info/20 px-3 py-2 text-sm"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm bg-panel-2 px-3 py-2 text-sm"
                }
              >
                {m.text}
                {m.role === "persona" && (
                  <button onClick={() => speak(m.text, persona)} className="ml-2 text-xs text-muted hover:text-text" aria-label="Play">
                    🔈
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="thinking text-sm italic text-muted">{persona.name} is answering…</div>}
          <div ref={endRef} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:bg-panel-2 hover:text-text">
              {s}
            </button>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <button
            type="button"
            onClick={toggleMic}
            className={listening ? "rounded-lg bg-danger px-3 text-white" : "rounded-lg border border-line px-3 hover:bg-panel-2"}
            title="Hold a voice conversation (Chrome/Edge)"
          >
            {listening ? "● Listening" : "🎙"}
          </button>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${persona.name} something…`}
            className="flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-info"
          />
          <button type="submit" disabled={loading} className="rounded-lg bg-info px-4 text-sm font-semibold text-ink disabled:opacity-50">
            Ask
          </button>
          <button
            type="button"
            onClick={() => setVoiceOn(!voiceOn)}
            className="rounded-lg border border-line px-3 text-sm hover:bg-panel-2"
            title="Read answers aloud"
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
        </form>
      </div>
    </Modal>
  );
}
