// ─────────────────────────────────────────────────────────────────────────────
// The ripple: when a policy is enacted, a wave travels outward from where the
// policy physically happens (the bus lanes, the new cooling hubs, the affected
// blocks). Each resident is "reached" the moment the wave front passes their
// home — the map pins, the 3D beams and their row in the resident list all
// light up in that order. While the policy is in effect, the sources keep
// sending out slow, faint rings.
// ─────────────────────────────────────────────────────────────────────────────

import type { HeatParams, LatLng, Scenario } from "@/lib/types";
import { PERSONAS } from "@/lib/data/personas";

/** ms before the wave starts moving (lets the button press land first). */
export const WAVE_LEAD_MS = 250;
/** ms for the wave front to reach the furthest resident. */
export const WAVE_TRAVEL_MS = 3200;
/**
 * The wave accelerates: radius = maxD · u^EXP (u = 0→1 over WAVE_TRAVEL_MS).
 * Residents span the whole city but the camera shows a few km, so a constant
 * speed would leave the screen in a blink. Starting slow keeps the visible,
 * nearby part of the wave on screen long enough to read.
 */
const EXP = 2.6;
/** Trailing rings behind the front, ms apart. */
const ECHOES = [0, 240, 480];
/** Ambient rings while the policy is in effect. */
const AMBIENT_EVERY_MS = 3200;
const AMBIENT_LIFE_MS = 2800;

export interface RippleGeo {
  origins: LatLng[];
  /** Furthest resident distance from any origin, metres. */
  maxD: number;
  /** ms after enact when the wave reaches each resident (PERSONAS order). */
  delays: number[];
}

export function metres(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Where the policy touches the ground. */
export function rippleOrigins(s: Scenario): LatLng[] {
  if (s.kind === "heat") {
    const hubs = (s.params as HeatParams).sites?.filter((x) => x.policyOnly).map((x) => x.location) ?? [];
    if (hubs.length) return hubs;
  }
  const policy = s.overlays.filter((o) => o.arm === "policy" && !o.dashed);
  const src = policy.length ? policy : s.overlays.filter((o) => o.arm === "both");
  // Points (sites, zones) ripple individually; a corridor ripples from its middle,
  // so the waves stay clean concentric rings rather than a tangle.
  const points = src.filter((o) => o.kind === "point").map((o) => o.coords[0]);
  const linePts = src.filter((o) => o.kind === "line").flatMap((o) => o.coords);
  if (linePts.length) points.push({ lat: linePts.reduce((a, p) => a + p.lat, 0) / linePts.length, lng: linePts.reduce((a, p) => a + p.lng, 0) / linePts.length });
  return points.length ? points : [s.mapView.center];
}

export function rippleGeo(s: Scenario): RippleGeo {
  const origins = rippleOrigins(s);
  const d = PERSONAS.map((p) => Math.min(...origins.map((o) => metres(o, p.home))));
  const maxD = Math.max(800, ...d) * 1.08;
  return { origins, maxD, delays: d.map((x) => WAVE_LEAD_MS + Math.pow(x / maxD, 1 / EXP) * WAVE_TRAVEL_MS) };
}

export interface Ring {
  center: LatLng;
  /** metres */
  r: number;
  /** 0–1 */
  a: number;
  /** true for the leading edge of the enact wave */
  front: boolean;
}

/**
 * Rings to draw at time `now` (Date.now()).
 * @param enactedAt store.flashAt (0 if never)
 * @param ambient  true while the policy view is showing
 */
export function ringsAt(now: number, geo: RippleGeo, enactedAt: number, ambient: boolean): Ring[] {
  const rings: Ring[] = [];
  const since = now - enactedAt;
  if (enactedAt && since >= 0 && since < WAVE_LEAD_MS + WAVE_TRAVEL_MS + 1200) {
    ECHOES.forEach((lag, k) => {
      const t = since - WAVE_LEAD_MS - lag;
      if (t <= 0) return;
      const r = geo.maxD * Math.pow(Math.min(t / WAVE_TRAVEL_MS, 1.2), EXP);
      const fade = Math.max(0, 1 - r / (geo.maxD * 1.15));
      if (fade <= 0) return;
      geo.origins.forEach((c) => rings.push({ center: c, r, a: fade * (k === 0 ? 1 : 0.55 - k * 0.15), front: k === 0 }));
    });
  }
  if (ambient && (!enactedAt || since > WAVE_LEAD_MS + WAVE_TRAVEL_MS)) {
    const reach = Math.min(geo.maxD * 0.45, 2500);
    for (const phase of [0, AMBIENT_EVERY_MS / 2]) {
      const t = (now + phase) % AMBIENT_EVERY_MS;
      if (t > AMBIENT_LIFE_MS) continue;
      const p = t / AMBIENT_LIFE_MS;
      const ease = 1 - (1 - p) ** 2;
      geo.origins.forEach((c) => rings.push({ center: c, r: 30 + ease * reach, a: 0.35 * (1 - p), front: false }));
    }
  }
  return rings;
}

/** Is the enact wave still travelling? (maps use this to keep animating) */
export const waveActive = (now: number, enactedAt: number) => enactedAt > 0 && now - enactedAt < WAVE_LEAD_MS + WAVE_TRAVEL_MS + 1300;

/**
 * Light up every element tagged data-pid="<persona id>" (map pins, list avatars)
 * as the wave reaches that resident. Returns a cancel function.
 */
export function scheduleHits(geo: RippleGeo): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  PERSONAS.forEach((p, i) => {
    timers.push(
      setTimeout(() => {
        document.querySelectorAll<HTMLElement>(`[data-pid="${p.id}"]`).forEach((el) => {
          el.classList.remove("ripple-hit");
          void el.offsetWidth; // restart the animation
          el.classList.add("ripple-hit");
          timers.push(setTimeout(() => el.classList.remove("ripple-hit"), 1300));
        });
      }, geo.delays[i]),
    );
  });
  return () => timers.forEach(clearTimeout);
}

/** 0→1→0 pulse for a resident in the ~600 ms after the wave reaches them (for WebGL layers). */
export function hitPulse(now: number, enactedAt: number, delay: number): number {
  const t = now - enactedAt - delay;
  if (!enactedAt || t < 0 || t > 700) return 0;
  return Math.sin((t / 700) * Math.PI);
}
