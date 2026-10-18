"use client";

import { useEffect, useState } from "react";
import { useRipple } from "@/lib/store";
import { rippleGeo, scheduleHits } from "@/lib/ripple";
import { RippleMark } from "./RippleMark";

/**
 * When the policy is enacted: a short banner, and the wave of "hits" that lights up
 * each resident (map pin + list avatar) as the ripple reaches their home.
 * Also shows transient toasts.
 */
export function Overlays() {
  const flashAt = useRipple((s) => s.flashAt);
  const toast = useRipple((s) => s.toast);
  const scenario = useRipple((s) => s.scenario);
  const [showToast, setShowToast] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setShowToast(true);
    const t = setTimeout(() => setShowToast(false), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!flashAt || Date.now() - flashAt > 1000) return; // ignore a stale timestamp restored on page load
    setShowBanner(true);
    const cancelHits = scheduleHits(rippleGeo(scenario));
    const t = setTimeout(() => setShowBanner(false), 2600);
    return () => {
      clearTimeout(t);
      cancelHits();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashAt]);

  return (
    <>
      {showBanner && (
        <div className="pointer-events-none fixed inset-x-0 top-[136px] z-[1600] flex justify-center">
          <div className="flex items-center gap-4 rounded-2xl bg-panel/95 py-3 pl-4 pr-6 shadow-2xl ring-1 ring-line backdrop-blur">
            <RippleMark size={44} animated />
            <div>
              <div className="text-sm text-muted">Policy enacted. Watch who it reaches.</div>
              <div className="font-display text-2xl font-bold tracking-tight text-navy">{scenario.policy.name}</div>
            </div>
          </div>
        </div>
      )}
      {showToast && toast && (
        <div className="pointer-events-none fixed bottom-28 left-1/2 z-[1600] -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold shadow-xl">
          {toast.text}
        </div>
      )}
    </>
  );
}
