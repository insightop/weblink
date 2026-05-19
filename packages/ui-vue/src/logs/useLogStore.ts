import { computed, ref } from "vue";
import type { LogEntry, LogLevel } from "../types/log";
import { createLogEntry } from "../types/log";

const DEFAULT_MAX_LOGS = 2000;

export interface UseLogStoreOptions {
  maxLogs?: number;
}

export function useLogStore(options: UseLogStoreOptions = {}) {
  const { maxLogs = DEFAULT_MAX_LOGS } = options;

  const logs = ref<LogEntry[]>([]);
  const levelFilter = ref<LogLevel | "all">("all");
  const keyword = ref("");

  function push(entry: Omit<LogEntry, "id" | "ts"> & { ts?: number }): void {
    logs.value = [...logs.value, createLogEntry(entry)].slice(-maxLogs);
  }

  function clear(): void {
    logs.value = [];
  }

  const filtered = computed(() => {
    const k = keyword.value.trim().toLowerCase();
    return logs.value.filter((l) => {
      if (levelFilter.value !== "all" && l.level !== levelFilter.value) return false;
      if (!k) return true;
      return (
        l.message.toLowerCase().includes(k) ||
        (l.scope?.toLowerCase().includes(k) ?? false) ||
        JSON.stringify(l.data ?? "").toLowerCase().includes(k)
      );
    });
  });

  return { logs, filtered, levelFilter, keyword, push, clear };
}
