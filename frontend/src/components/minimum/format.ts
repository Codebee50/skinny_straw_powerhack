const MINUS = "−"; // typographic minus

/** $X.XX with thousands separators and a real minus sign, e.g. "−$10.44". */
export function fmtUsd(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? MINUS : ""}$${abs}`;
}

/** Axis ticks: whole dollars, e.g. "−$20". */
export function fmtUsdTick(v: number): string {
  return `${v < 0 ? MINUS : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function fmtR(r: number | null): string {
  if (r === null) return "n/a";
  return `${r < 0 ? MINUS : ""}${Math.abs(r).toFixed(2)}`;
}

/** Plain-English strength + direction for a price↔congestion correlation. */
export function describeR(r: number | null): string {
  if (r === null) return "Not enough data";
  const a = Math.abs(r);
  if (a < 0.1) return "No clear link";
  const strength = a < 0.3 ? "Weak" : a < 0.5 ? "Moderate" : "Strong";
  // Negative r: more negative congestion (raised price) goes with higher price.
  return r < 0 ? `${strength}: heavier congestion, higher prices` : `${strength}: heavier congestion, lower prices`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtMonth(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}
