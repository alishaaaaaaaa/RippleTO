"use client";

// Landing-page hero: the Jane St bus lanes sending a ripple across the city,
// reaching the 12 residents in the real order the simulator uses (lib/ripple.ts).

import { useMemo } from "react";
import { PERSONAS } from "@/lib/data/personas";
import { rippleGeo, WAVE_LEAD_MS, WAVE_TRAVEL_MS } from "@/lib/ripple";
import type { Scenario } from "@/lib/types";

const W = 560;
const H = 440;
const PAD = 46;
const PERIOD_MS = Math.round(WAVE_TRAVEL_MS / 0.54); // ring keyframe reaches full size at 54%

/** Rough Lake Ontario shoreline along Toronto (west → east), for context. */
const SHORE: [number, number][] = [
  [43.585, -79.545], [43.598, -79.505], [43.618, -79.477], [43.630, -79.455], [43.632, -79.420], [43.636, -79.395],
  [43.641, -79.370], [43.650, -79.340], [43.660, -79.310], [43.668, -79.285], [43.682, -79.262], [43.700, -79.240],
  [43.716, -79.220], [43.735, -79.195], [43.752, -79.170], [43.770, -79.140],
];

/** Place each name right of its dot, else left, else nudged down — so clustered residents stay readable. */
function placeLabels(items: { x: number; y: number; name: string }[]) {
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = items.map(({ x, y }) => ({ x0: x - 8, x1: x + 8, y0: y - 8, y1: y + 8 }));
  const hit = (b: (typeof boxes)[number]) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  return items.map(({ x, y, name }) => {
    const w = name.length * 7.4 + 4;
    for (const dy of [0, 15, -15, 30, -30, 45]) {
      for (const side of [1, -1] as const) {
        const bx = side === 1 ? x + 11 : x - 11 - w;
        const b = { x0: bx, x1: bx + w, y0: y + dy - 9, y1: y + dy + 7 };
        if (b.x0 < 4 || b.x1 > W - 4 || hit(b)) continue;
        boxes.push(b);
        return { lx: side === 1 ? x + 11 : x - 11, ly: y + dy + 4, anchor: (side === 1 ? "start" : "end") as "start" | "end", lead: dy !== 0 };
      }
    }
    return { lx: x + 11, ly: y + 4, anchor: "start" as const, lead: false };
  });
}

export function RippleHero({ scenario }: { scenario: Scenario }) {
  const { proj, geo, rPx, corridor, dots, labels, lake, lakeLabel } = useMemo(() => {
    const geo = rippleGeo(scenario);
    const pts = [...PERSONAS.map((p) => p.home), ...geo.origins];
    const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const xs = pts.map((p) => p.lng * k);
    const ys = pts.map((p) => p.lat);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const s = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxY - minY));
    const ox = (W - (maxX - minX) * s) / 2;
    const oy = (H - (maxY - minY) * s) / 2;
    const proj = (p: { lat: number; lng: number }) => [ox + (p.lng * k - minX) * s, oy + (maxY - p.lat) * s] as const;
    // metres → px: 1° lat ≈ 111,320 m
    const rPx = (geo.maxD / 111320) * s;
    const corridor = scenario.overlays.filter((o) => o.arm === "policy" && !o.dashed).map((o) => o.coords.map(proj));
    const dots = PERSONAS.map((p) => {
      const [x, y] = proj(p.home);
      return { x, y, name: p.name };
    });
    const labels = placeLabels(dots);
    const shore = SHORE.map(([lat, lng]) => proj({ lat, lng }));
    const lake = `M ${shore.map(([x, y]) => `${x},${y}`).join(" L ")} L ${W + 400},${H + 400} L -400,${H + 400} Z`;
    const lakeLabel = proj({ lat: 43.628, lng: -79.33 });
    return { proj, geo, rPx, corridor, dots, labels, lake, lakeLabel };
  }, [scenario]);

  const vars = { ["--period" as string]: `${PERIOD_MS}ms` };

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${scenario.policy.name}: the effect spreads out to twelve residents`} style={vars}>
        <defs>
          <radialGradient id="hero-fade" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#fff" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="hero-mask">
            <rect x="0" y="0" width={W} height={H} fill="url(#hero-fade)" />
          </mask>
        </defs>
        <g mask="url(#hero-mask)">
          <path d={lake} fill="#dce9f3" />
          <text x={lakeLabel[0]} y={lakeLabel[1]} fill="#7fa3bf" fontSize={13} className="font-sans" fontStyle="italic">
            Lake Ontario
          </text>
        {/* rings from every point where the policy touches the street */}
        {[0, 300, 600].map((lag, k) =>
          geo.origins.map((o, j) => {
            const [x, y] = proj(o);
            return (
              <circle
                key={`${k}-${j}`}
                cx={x}
                cy={y}
                r={rPx}
                fill="none"
                stroke={k === 0 ? "var(--color-accent)" : "var(--color-accent-deep)"}
                strokeWidth={k === 0 ? 2.5 : 1.2}
                vectorEffect="non-scaling-stroke"
                className="hero-ring"
                style={{ animationDelay: `${WAVE_LEAD_MS + lag}ms` }}
              />
            );
          }),
        )}

        </g>

        {/* the policy itself */}
        {corridor.map((line, i) => (
          <polyline key={i} points={line.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="var(--color-accent-deep)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* residents, lit in the order the wave reaches them */}
        {dots.map(({ x, y, name }, i) => {
          const l = labels[i];
          const delay = { animationDelay: `${geo.delays[i]}ms` };
          return (
            <g key={name + i}>
              {l.lead && <line x1={x} y1={y} x2={l.anchor === "start" ? l.lx - 3 : l.lx + 3} y2={l.ly - 4} stroke="#c3ccd8" strokeWidth={1} />}
              <circle cx={x} cy={y} r={6} fill="#9aa8bb" stroke="#fff" strokeWidth={2} className="hero-dot" style={delay} />
              <text x={l.lx} y={l.ly} textAnchor={l.anchor} fill="#8a97a9" className="hero-label font-sans" fontSize={13} style={delay}>
                {name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-sm text-muted">
        The {scenario.policy.name.replace(/^Jane St /, "Jane Street ")} reaching twelve residents across the city, nearest first, just as in the simulator.
      </figcaption>
    </figure>
  );
}
