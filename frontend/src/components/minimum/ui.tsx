import type { ReactNode } from "react";

/** Segmented control: one row of mutually exclusive buttons. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = "md",
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4"
            } ${active ? "bg-surface text-accent shadow-sm ring-1 ring-border" : "text-text-muted hover:text-text"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Bordered panel for a chart, with title, optional controls, and a source caption. */
export function ChartCard({
  title,
  description,
  controls,
  caption,
  children,
}: {
  title: string;
  description?: ReactNode;
  controls?: ReactNode;
  caption: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-text-muted">{description}</p>}
        </div>
        {controls}
      </header>
      <div className="min-w-0 flex-1 px-2 pt-4 pb-2 sm:px-4">{children}</div>
      <p className="border-t border-border px-5 py-3 text-sm text-text-subtle">{caption}</p>
    </section>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

export function InfoIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="10" cy="6.25" r="1" fill="currentColor" />
    </svg>
  );
}

export function AlertIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path
        d="M8.7 3.2a1.5 1.5 0 0 1 2.6 0l6.3 11.1a1.5 1.5 0 0 1-1.3 2.2H3.7a1.5 1.5 0 0 1-1.3-2.2L8.7 3.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 7.5v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}
