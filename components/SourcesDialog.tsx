"use client";

import { useRipple } from "@/lib/store";
import { Modal } from "./Modal";

/** "Responsible interpretation" panel: assumptions, limits and every source, one click away. */
export function SourcesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scenario = useRipple((s) => s.scenario);
  return (
    <Modal open={open} onClose={onClose} title="Data, assumptions & limits">
      <div className="space-y-5 text-sm">
        <section>
          <h3 className="mb-1 font-semibold text-accent-deep">How to read this</h3>
          <p className="text-muted">
            Ripple simulates <b className="text-text">12 composite households</b> built from neighbourhood-level patterns. They are not real people
            and this is not a forecast. A rules-based engine computes every number; AI only writes residents&apos; voices and briefings from those
            results. We don&apos;t model race or ethnicity: outcomes come from circumstances like income, tenure, car access, age, health and building type.
          </p>
        </section>
        <section>
          <h3 className="mb-1 font-semibold text-accent-deep">Assumptions</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {scenario.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1 font-semibold text-accent-deep">Limitations</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {scenario.limitations.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1 font-semibold text-accent-deep">Sources</h3>
          <ul className="space-y-1">
            {scenario.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-info underline">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
