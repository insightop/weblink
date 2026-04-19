import { computed, ref } from "vue";
import type { LogEntry, LogLevel } from "@/domain/logs/logEntry";
import { createLogEntry } from "@/domain/logs/logEntry";

const MAX_LOGS = 2000;

export function useLogStore() {
  const logs = ref<LogEntry[]>([]);
  const levelFilter = ref<LogLevel | "all">("all");
  const keyword = ref("");

  function push(entry: Omit<LogEntry, "id" | "ts"> & { ts?: number }): void {
    logs.value = [...logs.value, createLogEntry(entry)].slice(-MAX_LOGS);
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
        l.scope.toLowerCase().includes(k) ||
        JSON.stringify(l.data ?? "").toLowerCase().includes(k)
      );
    });
  });

  return { logs, filtered, levelFilter, keyword, push, clear };
}
