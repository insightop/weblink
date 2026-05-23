export type LogLevel = "trace" | "debug" | "info" | "warning" | "error";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  data?: unknown;
}

