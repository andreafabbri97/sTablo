import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** URL-safe slug from an arbitrary display name. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Initials for avatars, e.g. "Andrea Rossi" -> "AR". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const DATE_FMT = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const TIME_FMT = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(date: Date | string): string {
  return DATE_FMT.format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return DATETIME_FMT.format(new Date(date));
}

/** Hour:minute only (it-IT). Stable locale → safe across server/client render. */
export function formatTime(date: Date | string): string {
  return TIME_FMT.format(new Date(date));
}

/** "2 giorni fa" style relative time in Italian. */
export function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return "adesso";
  if (min < 60) return `${min} min fa`;
  if (hr < 24) return `${hr} ${hr === 1 ? "ora" : "ore"} fa`;
  if (day < 30) return `${day} ${day === 1 ? "giorno" : "giorni"} fa`;
  return formatDate(date);
}

/** "fra 2 ore" / "fra 3 giorni" style countdown, for upcoming events. */
export function timeUntil(date: Date | string): string {
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return "ora";
  const min = Math.round(diff / 60000);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (min < 60) return `fra ${min} min`;
  if (hr < 24) return `fra ${hr} ${hr === 1 ? "ora" : "ore"}`;
  if (day < 30) return `fra ${day} ${day === 1 ? "giorno" : "giorni"}`;
  return formatDate(date);
}

/** Deterministic color index for an id/name, used for avatar gradients. */
export function colorFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % AVATAR_GRADIENTS.length;
}

export const AVATAR_GRADIENTS = [
  "from-orange-400 to-rose-500",
  "from-cyan-400 to-blue-600",
  "from-lime-400 to-emerald-600",
  "from-fuchsia-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-sky-400 to-indigo-600",
  "from-teal-400 to-cyan-600",
  "from-pink-400 to-rose-600",
];

export function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}
