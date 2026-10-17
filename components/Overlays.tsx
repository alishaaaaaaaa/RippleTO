"use client";

import { useEffect, useState } from "react";
import { useRipple } from "@/lib/store";

/** Full-screen red flash + banner when the policy is enacted, and transient toasts. */
export function Overlays() {
  const flashAt = useRipple((s) => s.flashAt);
  const toast = useRipple((s) => s.toast);
  const policyName = useRipple((s) => s.scenario.policy.name);
  const [showToast, setShowToast] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setShowToast(true);
    const t = setTimeout(() => setShowToast(false), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!flashAt) return;
    setShowBanner(true);
    const t = setTimeout(() => setShowBanner(false), 1800);
    return () => clearTimeout(t);
  }, [flashAt]);

  return (
    <>
      {flashAt > 0 && <div key={flashAt} className="enact-flash pointer-events-none fixed inset-0 z-[1500] bg-danger" />}
      {showBanner && (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-[1600] flex justify-center">
          <div className="rounded-2xl border-2 border-danger bg-ink/90 px-8 py-4 text-center shadow-2xl">
            <div className="text-xs font-black tracking-[0.3em] text-danger">POLICY ENACTED</div>
            <div className="mt-1 text-2xl font-extrabold">{policyName}</div>
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
