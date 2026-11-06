import { AlertIcon, InfoIcon } from "./ui";

export function FindingsPanel({ findings }: { findings: string[] }) {
  return (
    <section aria-labelledby="findings-heading" className="rounded-xl border border-border bg-surface p-6">
      <h2 id="findings-heading" className="text-xl font-semibold tracking-tight">
        What the numbers show
      </h2>
      <ol className="mt-4 space-y-3">
        {findings.map((f, i) => (
          <li key={i} className="grid grid-cols-[2rem_1fr] gap-2 text-lg leading-relaxed">
            <span className="font-mono text-base text-text-subtle tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span className="max-w-[70ch]">{f}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LimitsPanel({ items, notes }: { items: string[]; notes: string[] }) {
  return (
    <section
      aria-labelledby="limits-heading"
      className="rounded-xl border-2 border-dashed border-border-strong bg-surface-2 p-6"
    >
      <h2 id="limits-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <InfoIcon className="size-6 text-text-muted" />
        What this data cannot tell us
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((t) => (
          <li key={t} className="flex gap-3 text-lg leading-relaxed">
            <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-text-subtle" />
            <span className="max-w-[70ch]">{t}</span>
          </li>
        ))}
      </ul>
      {notes.length > 0 && (
        <div className="mt-6 border-t border-border-strong pt-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <AlertIcon className="size-5 text-text-muted" />
            Data note{notes.length > 1 ? "s" : ""}
          </h3>
          <ul className="mt-2 space-y-2">
            {notes.map((n) => (
              <li key={n} className="max-w-[70ch] text-text-muted">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
