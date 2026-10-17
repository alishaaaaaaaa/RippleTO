import type { MetricFormat } from "@/lib/types";

export function formatMetric(v: number | undefined, f: MetricFormat): string {
  if (v === undefined || Number.isNaN(v)) return "—";
  switch (f) {
    case "int":
      return Math.round(v).toLocaleString("en-CA");
    case "pct":
      return `${v.toFixed(1)}%`;
    case "money":
      return Math.abs(v) >= 1_000_000
        ? `$${(v / 1_000_000).toFixed(1)}M`
        : `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-CA")}`;
    case "tonnes":
      return `${v.toLocaleString("en-CA", { maximumFractionDigits: 1 })} t`;
    case "min":
      return `${v.toFixed(1)} min`;
    case "km":
      return `${v.toFixed(1)} km`;
    case "decimal":
      return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
  }
}

export function formatDelta(d: number, f: MetricFormat): string {
  const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
  const abs = Math.abs(d);
  if (f === "pct") return `${sign}${abs.toFixed(1)} pts`;
  if (f === "decimal") return `${sign}${abs.toFixed(1)}`;
  return `${sign}${formatMetric(abs, f).replace(/^[−-]/, "")}`;
}
