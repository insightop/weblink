import type { Component } from "vue";
import {
  AlertCircleOutline,
  BugOutline,
  InformationCircleOutline,
  WarningOutline,
  PulseOutline,
} from "@vicons/ionicons5";
import type { LogLevel } from "@/features/flasher/types/log";

export const LOG_LEVELS = ["trace", "debug", "info", "warning", "error"] as const;

export interface LogLevelPresentation {
  level: LogLevel;
  i18nKey: string;
  icon: Component;
  colorVar: string;
}

const LOG_LEVEL_PRESENTATION: Record<LogLevel, LogLevelPresentation> = {
  trace: {
    level: "trace",
    i18nKey: "log.level.trace",
    icon: PulseOutline,
    colorVar: "var(--trace-500)",
  },
  debug: {
    level: "debug",
    i18nKey: "log.level.debug",
    icon: BugOutline,
    colorVar: "var(--debug-500)",
  },
  info: {
    level: "info",
    i18nKey: "log.level.info",
    icon: InformationCircleOutline,
    colorVar: "var(--info-500)",
  },
  warning: {
    level: "warning",
    i18nKey: "log.level.warning",
    icon: WarningOutline,
    colorVar: "var(--warning-500)",
  },
  error: {
    level: "error",
    i18nKey: "log.level.error",
    icon: AlertCircleOutline,
    colorVar: "var(--error-500)",
  },
};

export function getLogLevelPresentation(level: LogLevel): LogLevelPresentation {
  return LOG_LEVEL_PRESENTATION[level];
}
