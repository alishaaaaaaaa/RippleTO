"use client";

// ─────────────────────────────────────────────────────────────────────────────
// App → panel link (optional). Sends a short text line to the Pico over USB so
// its LCD shows the current period, armed state and headline number.
//
// The panel → app direction is unchanged: the Pico is still a USB keyboard.
// If this link isn't connected or fails, nothing else in the app is affected.
//
// Uses the Web Serial API: Chrome or Edge only, and the user must click
// "Connect panel" once per page load (a browser security rule).
//
// Line format the Pico expects (ASCII, ends with \n):
//   S|<line 1, 16 chars>|<line 2, 16 chars>|<r>,<g>,<b>
// ─────────────────────────────────────────────────────────────────────────────

import { useRipple } from "@/lib/store";
import { formatMetric } from "@/lib/format";

/* Minimal Web Serial types (not in TypeScript's built-in DOM types). */
interface SerialPortLike {
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
}

export const serialSupported = () => typeof navigator !== "undefined" && "serial" in navigator;

const SHORT_LABEL: Record<string, string> = {
  co2_saved_t: "CO2 SAVED",
  households_displaced: "DISPLACED",
  residents_high_risk: "HIGH RISK",
};

/** LCDs only show plain ASCII: swap or drop anything fancy. */
function ascii(s: string): string {
  return s
    .replace(/[−–—]/g, "-")
    .replace(/[·•]/g, " ")
    .replace(/₂/g, "2")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\|/g, "/");
}

function fit(left: string, right = ""): string {
  const width = 16;
  const r = ascii(right).slice(0, width);
  const l = ascii(left).slice(0, Math.max(0, width - r.length - (r ? 1 : 0)));
  return (l + " ".repeat(Math.max(0, width - l.length - r.length)) + r).slice(0, width);
}

/** Builds the line the Pico should display from the current app state. */
export function buildPanelLine(): string {
  const s = useRipple.getState();
  const sc = s.scenario;
  const N = sc.periodLabels.length;
  const raw = sc.periodLabels[s.period - 1];
  const month = raw.match(/^Month (\d+)$/);
  const day = raw.match(/^Day (\d+) · (day|night)$/);
  const label = month ? `M${month[1]}/${N}` : day ? `D${day[1]} ${day[2].toUpperCase()}` : raw.toUpperCase();

  const status = s.view === "policy" ? "ENACTED" : s.armed ? "ARMED" : "SAFE";
  const line1 = fit(label, status);

  const hero = sc.metrics.find((m) => m.id === sc.heroMetric) ?? sc.metrics[0];
  const value = s.sim[s.view].metrics[s.period - 1][hero.id];
  const clean = Math.abs(value) < 0.05 ? 0 : value; // avoid "-0"
  const line2 = fit(SHORT_LABEL[hero.id] ?? hero.label.toUpperCase().slice(0, 9), formatMetric(clean, hero.format).replace(" t", "t"));

  // Backlight: blue = status quo, red = armed, green/orange = enacted (better/worse than status quo).
  let rgb = [40, 90, 255];
  if (s.armed && s.view !== "policy") rgb = [255, 0, 0];
  if (s.view === "policy") {
    const base = s.sim.baseline.metrics[s.period - 1][hero.id];
    const better = hero.better === "up" ? value >= base : value <= base;
    rgb = better ? [0, 255, 70] : [255, 120, 0];
  }
  return `S|${line1}|${line2}|${rgb.join(",")}\n`;
}

let port: SerialPortLike | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
let unsubscribe: (() => void) | null = null;
let lastSent = "";
let timer: ReturnType<typeof setTimeout> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

async function send(line: string, force = false) {
  if (!writer || (line === lastSent && !force)) return;
  lastSent = line;
  try {
    await writer.write(new TextEncoder().encode(line));
  } catch {
    await disconnectPanel(); // cable pulled — fail quietly, the keyboard still works
  }
}

function scheduleSend() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void send(buildPanelLine());
  }, 80); // throttle bursts of state changes
}

export const isPanelConnected = () => !!writer;

export async function connectPanel(): Promise<boolean> {
  if (!serialSupported()) return false;
  try {
    port = await (navigator as unknown as { serial: SerialLike }).serial.requestPort();
    await port.open({ baudRate: 115200 });
    writer = port.writable?.getWriter() ?? null;
    if (!writer) throw new Error("Port not writable");
    lastSent = "";
    unsubscribe = useRipple.subscribe(scheduleSend);
    void send(buildPanelLine());
    // Re-send every 3 s so the Pico knows the link is alive (it falls back after 8 s of silence).
    heartbeat = setInterval(() => void send(buildPanelLine(), true), 3000);
    return true;
  } catch (e) {
    console.warn("[panel] connect failed:", e);
    await disconnectPanel();
    return false;
  }
}

export async function disconnectPanel() {
  unsubscribe?.();
  unsubscribe = null;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  try {
    writer?.releaseLock();
  } catch {}
  try {
    await port?.close();
  } catch {}
  writer = null;
  port = null;
}
