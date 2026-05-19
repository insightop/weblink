import { getContext } from "svelte";

export type AlertVariant = "success" | "info" | "error";
export type ShowAlertOptions = {
  title?: string;
  message?: string;
  variant?: AlertVariant;
  duration?: number; // ms; <0 => sticky
};
export type AlertHandle = { id: number; close: () => void };
export type ShowAlertFn = (opts: ShowAlertOptions) => AlertHandle;

export const ALERT_CTX = Symbol("alert-ctx");

// -------------------------
// portal-safe global fallback + queue
// -------------------------
let globalShow: ShowAlertFn | null = null;
const queue: ShowAlertOptions[] = [];

export function registerAlertShow(fn: ShowAlertFn) {
  globalShow = fn;
  while (queue.length) fn(queue.shift()!);
}
export function unregisterAlertShow(fn: ShowAlertFn) {
  if (globalShow === fn) globalShow = null;
}

function resolveShow(): ShowAlertFn {
  try {
    const ctx = getContext<ShowAlertFn>(ALERT_CTX);
    if (ctx) return ctx;
  } catch {
    // no component instance yet
  }
  if (globalShow) return globalShow;

  // Fallback that *upgrades* itself when globalShow becomes available
  return (opts: ShowAlertOptions) => {
    if (globalShow) return globalShow(opts); // <-- NEW: route immediately if ready
    queue.push(opts);
    return { id: -1, close: () => {} };
  };
}

export function useAlert() {
  const call = (opts: ShowAlertOptions) => resolveShow()(opts);
  return {
    show: call,
    success: (title?: string, message?: string, duration?: number) =>
      call({ title, message, duration, variant: "success" }),
    info: (title?: string, message?: string, duration?: number) =>
      call({ title, message, duration, variant: "info" }),
    error: (title?: string, message?: string, duration?: number) =>
      call({ title, message, duration, variant: "error" }),
  };
}
