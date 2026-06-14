// Single source of truth — the countdown points to one fixed moment.
// 5:45 PM Central (CDT) on June 14, 2026.
export const TARGET = new Date("2026-06-14T17:45:00-05:00");

export const EVENT_LABEL = "Going Home";
export const ORIGIN = "Chicago";
export const DESTINATION = "New York";

// Format the TARGET for the sub-line under the countdown.
// Renders as: "New York · Sat, Jun 14 · 5:45 PM"
const FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Chicago",
});
export const TARGET_LABEL = (() => {
  const parts = FMT.formatToParts(TARGET);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("weekday")}, ${get("month")} ${get("day")}`;
  const time = `${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
  return `${DESTINATION} · ${date} · ${time}`;
})();
