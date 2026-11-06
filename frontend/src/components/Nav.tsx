"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { dataMode, getHealth, type DataMode } from "@/lib/api";
import { presentation } from "@/lib/presentation";

const LINKS = [
  { href: "/minimum", label: "Where", level: "Minimum" },
  { href: "/intermediate", label: "When", level: "Intermediate" },
  { href: "/advanced", label: "Moses South", level: "Advanced" },
  { href: "/about", label: "About", level: null },
] as const;

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
        <Link href="/minimum" className={`rounded-md py-2 font-semibold tracking-tight text-text ${focusRing}`}>
          NY grid congestion
        </Link>
        <nav aria-label="Analysis levels" className="flex flex-wrap gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 transition-colors duration-150 ${focusRing} ${
                  active
                    ? "bg-accent-subtle font-medium text-accent"
                    : "text-text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                {link.label}
                {link.level && (
                  <span className={`nav-level ${active ? "text-accent" : "text-text-subtle"}`}> ({link.level})</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <PresentationToggle />
          <ApiStatus />
        </div>
      </div>
    </header>
  );
}

/** Projector toggle: larger type, helper footnotes hidden. Remembered in this browser. */
function PresentationToggle() {
  const on = useSyncExternalStore(presentation.subscribe, presentation.get, presentation.getServer);
  useEffect(() => presentation.restore(), []);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={presentation.toggle}
      title={on ? "Leave presentation mode" : "Larger text and fewer footnotes, for the projector"}
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors duration-150 ${focusRing} ${
        on ? "border-accent bg-accent text-accent-fg" : "border-border-strong bg-surface text-text-muted hover:text-text"
      }`}
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden className="size-4">
        <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 13.5v3M7 16.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      Presentation mode
    </button>
  );
}

const MODE_DISPLAY: Record<DataMode, { text: string; title: string; dot: string; chip: string }> = {
  checking: { text: "Checking API", title: "Checking the data API", dot: "bg-text-subtle animate-pulse", chip: "" },
  live: { text: "API connected", title: "Live data from the API", dot: "bg-success", chip: "" },
  fallback: {
    text: "Offline data",
    title: "The API isn't responding, so charts show a saved snapshot of the same data",
    dot: "bg-warning",
    chip: "bg-warning-subtle font-medium text-warning hover:text-warning",
  },
  down: { text: "API offline", title: "The API isn't responding and no snapshot was found", dot: "bg-danger", chip: "" },
};

/**
 * Status dot with a text label (never color alone). Shows where the latest data came from:
 * live API, offline snapshot, or nothing. Re-checks every 30s so it recovers when the API returns.
 * Links to /status.
 */
function ApiStatus() {
  const mode = useSyncExternalStore(dataMode.subscribe, dataMode.get, dataMode.getServer);

  useEffect(() => {
    const check = () => getHealth({ cache: "no-store" }).catch(() => undefined);
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const d = MODE_DISPLAY[mode];
  return (
    <Link
      href="/status"
      title={`${d.title} — view loaded data`}
      className={`inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-subtle hover:text-text ${d.chip} ${focusRing}`}
    >
      <span aria-hidden className={`size-2.5 rounded-full ${d.dot}`} />
      <span aria-live="polite">{d.text}</span>
    </Link>
  );
}
