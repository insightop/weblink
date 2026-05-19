import { useFlasherStore } from "@/features/flasher/stores/flasher.store";
import type { LogEntry, LogLevel } from "@/features/flasher/types/log";
import pino from "pino";

const logger = pino({
  name: "flasher-ui",
  level: "trace",
  browser: {
    asObject: false,
  },
});

function append(level: LogLevel, message: string, context?: unknown): void {
  const store = useFlasherStore();
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };
  store.appendLog(entry);
  if (level === "trace") logger.trace({ context }, message);
  if (level === "debug") logger.debug({ context }, message);
  if (level === "info") logger.info({ context }, message);
  if (level === "warning") logger.warn({ context }, message);
  if (level === "error") logger.error({ context }, message);
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

