"use client";

// Keyboard controls = hardware controls.
// The Raspberry Pi Pico panel pretends to be a USB keyboard (see hardware/code.py),
// so the app only listens for ordinary key presses. Unplug the panel and the
// laptop keyboard does exactly the same thing — the hardware is fully removable.
//
//   →  / ←      next / previous period          (knob turn)
//   Space       play / pause                     (knob press)
//   A / D       arm / disarm                     (safety-cover toggle up / down)
//   E or Enter  enact the policy (must be armed) (big red button)
//   B           switch status quo ↔ policy view
//   I           interview the selected resident
//   1 2 3       switch scenario

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRipple } from "@/lib/store";
import { SCENARIOS } from "@/lib/scenarios";

export const PLAY_INTERVAL_MS = 1700;

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.tagName === "SELECT");
}

export function useControls() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useRipple.getState();
      if (s.interviewPersonaId && e.key !== "Escape") return; // interview dialog owns the keyboard
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          s.setPlaying(false);
          s.next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          s.setPlaying(false);
          s.prev();
          break;
        case " ":
          e.preventDefault();
          s.togglePlay();
          break;
        case "a":
        case "A":
          s.setArmed(true);
          break;
        case "d":
        case "D":
          s.setArmed(false);
          break;
        case "e":
        case "E":
        case "Enter":
          e.preventDefault();
          s.enact();
          break;
        case "b":
        case "B":
          s.setView(s.view === "policy" ? "baseline" : "policy");
          break;
        case "i":
        case "I":
          if (s.selectedPersonaId) s.openInterview(s.selectedPersonaId);
          else s.showToast("Click a resident first, then press I to call them");
          break;
        case "Escape":
          s.openInterview(null);
          s.selectPersona(null);
          break;
        case "1":
        case "2":
        case "3": {
          const target = SCENARIOS[Number(e.key) - 1];
          if (target) router.push(`/sim?s=${target.id}`);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Playback clock
  const playing = useRipple((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => useRipple.getState().next(), PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing]);

  // Alarm sound on enact
  const flashAt = useRipple((s) => s.flashAt);
  const soundOn = useRipple((s) => s.soundOn);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!flashAt || !soundOn) return;
    playAlarm();
  }, [flashAt, soundOn]);
}

/** A short two-tone alert made with Web Audio — no audio files needed. */
function playAlarm() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);
    [0, 0.22, 0.44].forEach((t, i) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = i % 2 ? 660 : 880;
      osc.connect(gain);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.18);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio not available — silent is fine */
  }
}
