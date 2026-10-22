/** seconds after midnight -> "HH:MM" (hours wrap at 24) */
export function hm(sec: number): string {
  const s = ((Math.round(sec) % 86400) + 86400) % 86400;
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
}

export function hms(sec: number): string {
  const s = ((Math.round(sec) % 86400) + 86400) % 86400;
  return `${hm(s)}:${String(s % 60).padStart(2, "0")}`;
}

export function signed(min: number): string {
  return min > 0 ? `+${min}` : `${min}`;
}

export function clockHms(d: Date, timeZone?: string): string {
  return d.toLocaleTimeString("en-GB", { hour12: false, timeZone });
}

export function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
