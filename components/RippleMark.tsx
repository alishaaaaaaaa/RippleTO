// The Ripple TO mark: a drop and the rings it sends out.
export function RippleMark({ size = 28, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" opacity="0.45" className={animated ? "mark-ring mark-ring-3" : ""} />
      <circle cx="16" cy="16" r="10" fill="none" stroke="var(--color-accent-deep)" strokeWidth="2" opacity="0.8" className={animated ? "mark-ring mark-ring-2" : ""} />
      <circle cx="16" cy="16" r="4.6" fill="var(--color-accent-deep)" />
    </svg>
  );
}

export function Wordmark({ size = "text-lg" }: { size?: string }) {
  return (
    <span className={`font-display ${size} font-bold tracking-[-0.02em] text-navy`}>
      Ripple<span className="font-normal text-muted"> TO</span>
    </span>
  );
}
