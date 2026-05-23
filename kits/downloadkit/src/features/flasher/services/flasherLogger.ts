import { useFlasherStore } from "../stores/flasher.store";
import type { LogEntry, LogLevel } from "../types/log";
import pino from "pino";

const logger = pino({
  name: "flasher-ui",
  level: "trace",
  browser: {
    asObject: false,
  },
});

function append(level: LogLevel, message: string, data?: unknown): void {
  const store = useFlasherStore();
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ts: Date.now(),
    level,
    message,
    data,
  };
  store.appendLog(entry);
  if (level === "trace") logger.trace({ data }, message);
  if (level === "debug") logger.debug({ data }, message);
  if (level === "info") logger.info({ data }, message);
  if (level === "warning") logger.warn({ data }, message);
  if (level === "error") logger.error({ data }, message);
}

export const flasherLogger = {
  trace(message: string, context?: unknown): void {
    append("trace", message, context);
  },
  debug(message: string, context?: unknown): void {
    append("debug", message, context);
  },
  info(message: string, context?: unknown): void {
    append("info", message, context);
  },
  warning(message: string, context?: unknown): void {
    append("warning", message, context);
  },
  error(message: string, context?: unknown): void {
    append("error", message, context);
  },
};

