import { computed, ref } from "vue";
import type { LogEntry, LogLevel } from "@/domain/logs/logEntry";
import { createLogEntry } from "@/domain/logs/logEntry";
import { pushRing } from "@/shared/utils/ringBuffer";

const MAX_LOGS = 1000;

export function useLogStore() {
  const logs = ref<LogEntry[]>([]);
  const level = ref<LogLevel | "all">("all");
  const keyword = ref("");

  function push(lvl: LogLevel, message: string, detail?: unknown) {
    logs.value = pushRing(logs.value, createLogEntry(lvl, message, detail), MAX_LOGS);
  }

  function clear() {
    logs.value = [];
  }

  const filtered = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    const minLevel = level.value;
    return logs.value.filter((e) => {
      if (minLevel !== "all" && e.level !== minLevel) return false;
      if (!kw) return true;
      return e.message.toLowerCase().includes(kw);
    });
  });

  return { logs, level, keyword, filtered, push, clear };
}

