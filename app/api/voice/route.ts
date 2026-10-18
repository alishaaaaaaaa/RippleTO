// Text-to-speech for resident phone calls via ElevenLabs.
// The words come from /api/interview (Gemini); this route only gives them a voice.
// The API key stays on the server. With no key (or any failure) it returns 503,
// and the browser falls back to its built-in speech so the demo never breaks.

import { NextRequest, NextResponse } from "next/server";
import { PERSONA_BY_ID } from "@/lib/data/personas";
import { FALLBACK_VOICE, VOICES } from "@/lib/voices";

const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";
const BASE = process.env.ELEVENLABS_API_BASE || "https://api.elevenlabs.io";
const TIMEOUT_MS = 15000;

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 503 });
  const body = await req.json().catch(() => null);
  const persona = PERSONA_BY_ID[body?.personaId];
  // Interview replies are 2–4 sentences; the cap protects your character quota.
  const text = String(body?.text ?? "").trim().slice(0, 700);
  if (!persona || !text) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const cast = VOICES[persona.id] ?? FALLBACK_VOICE;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE}/v1/text-to-speech/${cast.voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: cast.speed },
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.warn(`[voice] ElevenLabs ${r.status}: ${detail.slice(0, 200)}`);
      return NextResponse.json({ error: `ElevenLabs returned ${r.status}` }, { status: 503 });
    }
    return new NextResponse(r.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Voice": cast.name },
    });
  } catch (e) {
    console.warn("[voice] ElevenLabs request failed:", e);
    return NextResponse.json({ error: "ElevenLabs unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
