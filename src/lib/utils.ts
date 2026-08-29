import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function remainingLabel(endsAt: string | Date | null | undefined) {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return "This rate is expiring";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h remaining`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function collectorTier(unlockedCount: number, hasClimax: boolean) {
  if (hasClimax) return { id: "inner", label: "Finished the set" };
  if (unlockedCount >= 6) return { id: "preferred", label: "Deep in" };
  if (unlockedCount >= 3) return { id: "chosen", label: "In deep" };
  if (unlockedCount >= 1) return { id: "granted", label: "Started" };
  return { id: "invited", label: "Looking" };
}
