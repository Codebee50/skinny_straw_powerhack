// Presentation mode: bigger type for the projector and no helper footnotes.
// Stored as <html data-present="on"> (CSS in globals.css reads it) and remembered per browser.

const KEY = "nyg:presentation";
const listeners = new Set<() => void>();

const read = () => typeof document !== "undefined" && document.documentElement.dataset.present === "on";

function apply(on: boolean) {
  if (on) document.documentElement.dataset.present = "on";
  else delete document.documentElement.dataset.present;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // private window / blocked storage: the toggle still works for this page view
  }
  listeners.forEach((l) => l());
}

/** For React's useSyncExternalStore(presentation.subscribe, presentation.get, presentation.getServer). */
export const presentation = {
  get: read,
  getServer: () => false,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  toggle: () => apply(!read()),
  /** Restore the saved choice (call once on the client). */
  restore() {
    try {
      if (localStorage.getItem(KEY) === "on" && !read()) apply(true);
    } catch {
      // ignore
    }
  },
};
