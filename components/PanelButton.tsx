"use client";

import { useEffect, useState } from "react";
import { connectPanel, disconnectPanel, isPanelConnected, serialSupported } from "@/lib/panelLink";
import { cx } from "@/lib/ui";

/** "Connect panel" button for the optional LCD link. Hidden in browsers without Web Serial. */
export function PanelButton() {
  const [supported, setSupported] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(serialSupported());
    setConnected(isPanelConnected()); // stays connected when moving between pages
  }, []);
  if (!supported) return null;

  return (
    <button
      onClick={async () => {
        setBusy(true);
        if (connected) {
          await disconnectPanel();
          setConnected(false);
        } else {
          setConnected(await connectPanel());
        }
        setBusy(false);
      }}
      disabled={busy}
      className={cx(
        "rounded-md border px-2 py-1",
        connected ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-line hover:bg-panel-2",
      )}
      title="Send live status to the control panel's screen (Chrome/Edge). The panel's buttons work without this."
    >
      {connected ? "● Panel screen" : "Connect panel"}
    </button>
  );
}
