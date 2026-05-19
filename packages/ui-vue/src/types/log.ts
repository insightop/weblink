export type LogLevel = "trace" | "debug" | "info" | "warn" | "warning" | "error";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  scope?: string;
  message: string;
  data?: unknown;
}

let nextId = 0;

export function createLogEntry(
  partial: Omit<LogEntry, "id" | "ts"> & { ts?: number },
): LogEntry {
  return {
    id: `${Date.now()}_${(++nextId).toString(16)}`,
    ts: partial.ts ?? Date.now(),
    level: partial.level,
    scope: partial.scope,
    message: partial.message,
    data: partial.data,
  };
}
