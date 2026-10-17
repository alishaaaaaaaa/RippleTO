"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SCENARIO_BY_ID } from "@/lib/scenarios";
import { useRipple } from "@/lib/store";
import { applyThemeToDocument, themeFor } from "@/lib/themes";
import { PERSONAS } from "@/lib/data/personas";
import { NEIGHBOURHOOD_BY_ID } from "@/lib/data/neighbourhoods";

const WARDS = Array.from(
  new Map(PERSONAS.map((p) => NEIGHBOURHOOD_BY_ID[p.neighbourhoodId]).map((n) => [n.ward, n.wardName])).entries(),
).sort((a, b) => a[0] - b[0]);

function BriefingInner() {
  const params = useSearchParams();
  const id = params.get("s") ?? "";
  const custom = useRipple((s) => s.customScenarios);
  const scenario = useMemo(() => SCENARIO_BY_ID[id] ?? custom.find((c) => c.id === id) ?? Object.values(SCENARIO_BY_ID)[0], [id, custom]);

  useEffect(() => applyThemeToDocument(themeFor(scenario.kind)), [scenario.kind]);
  const [ward, setWard] = useState<string>("all");
  const [audience, setAudience] = useState("residents");
  const [md, setMd] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, ward: ward === "all" ? "all" : Number(ward), audience }),
      });
      const d = await res.json();
      setMd(d.markdown ?? "Could not generate a briefing.");
      setSource(d.source ?? "");
    } catch {
      setMd("Could not reach the briefing service.");
    } finally {
      setLoading(false);
    }
  }, [scenario, ward, audience]);

  useEffect(() => {
    void generate();
    // Generate once on load; later runs are triggered by the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link href={`/sim?s=${scenario.id}`} className="text-sm text-info underline">
          ← Back to simulation
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <select value={ward} onChange={(e) => setWard(e.target.value)} className="rounded-lg border border-line bg-panel px-3 py-1.5">
            <option value="all">City-wide</option>
            {WARDS.map(([w, name]) => (
              <option key={w} value={w}>
                Ward {w} — {name}
              </option>
            ))}
          </select>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="rounded-lg border border-line bg-panel px-3 py-1.5">
            <option value="residents">For residents</option>
            <option value="journalists">For journalists</option>
            <option value="councillors">For councillors</option>
          </select>
          <button onClick={generate} disabled={loading} className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-navy disabled:opacity-50">
            {loading ? "Writing…" : "Generate"}
          </button>
          <button onClick={() => window.print()} className="rounded-lg border border-line px-3 py-1.5 hover:bg-panel-2">
            Print / PDF
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(md);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
            className="rounded-lg border border-line px-3 py-1.5 hover:bg-panel-2"
          >
            {copied ? "Copied" : "Copy markdown"}
          </button>
        </div>
      </div>

      <article className="print-sheet mt-6 rounded-2xl border border-line bg-panel p-8">
        <div className="mb-4 flex items-center justify-between text-xs text-muted">
          <span>
            Ripple<span className="text-accent-deep">TO</span> ward briefing · {scenario.shortTitle}
          </span>
          <span>{source === "gemini" ? "Written by AI from simulation results" : source === "template" ? "Template (AI offline)" : ""}</span>
        </div>
        {loading && !md ? (
          <div className="thinking text-muted">Writing briefing…</div>
        ) : (
          <div className={`prose-brief ${loading ? "opacity-50" : ""}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
          </div>
        )}
      </article>
    </div>
  );
}

export default function BriefingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading…</div>}>
      <BriefingInner />
    </Suspense>
  );
}
