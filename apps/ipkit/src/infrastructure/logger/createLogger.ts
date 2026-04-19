export type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = import.meta.env.DEV;

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
  const prefix = `[ipkit:${scope}]`;
  return {
    debug: (...args: unknown[]) => {
      if (isDev) {
        console.debug(prefix, ...args);
      }
    },
    info: (...args: unknown[]) => {
      console.info(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(prefix, ...args);
    },
  };
}
