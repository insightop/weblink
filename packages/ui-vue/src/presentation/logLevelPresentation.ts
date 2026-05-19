import type { Component } from "vue";
import {
  AlertCircleOutline,
  BugOutline,
  InformationCircleOutline,
  WarningOutline,
  PulseOutline,
} from "@vicons/ionicons5";
import type { LogLevel } from "../types/log";

export const LOG_LEVELS: readonly LogLevel[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "warning",
  "error",
] as const;

export interface LogLevelPresentation {
  level: LogLevel;
  icon: Component;
  colorVar: string;
}

const LOG_LEVEL_PRESENTATION: Record<LogLevel, LogLevelPresentation> = {
  trace: { level: "trace", icon: PulseOutline, colorVar: "var(--trace-500)" },
  debug: { level: "debug", icon: BugOutline, colorVar: "var(--debug-500)" },
  info: { level: "info", icon: InformationCircleOutline, colorVar: "var(--info-500)" },
  warn: { level: "warn", icon: WarningOutline, colorVar: "var(--warning-500)" },
  warning: { level: "warning", icon: WarningOutline, colorVar: "var(--warning-500)" },
  error: { level: "error", icon: AlertCircleOutline, colorVar: "var(--error-500)" },
};

export function getLogLevelPresentation(level: LogLevel): LogLevelPresentation {
  return LOG_LEVEL_PRESENTATION[level];
}
