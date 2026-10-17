"use client";

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-slate-900/25 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[85vh] w-full ${wide ? "max-w-3xl" : "max-w-xl"} overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-panel-2" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="scroll-thin max-h-[calc(85vh-52px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
