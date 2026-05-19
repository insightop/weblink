export type LogLevel = "trace" | "debug" | "info" | "warning" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: unknown;
}

