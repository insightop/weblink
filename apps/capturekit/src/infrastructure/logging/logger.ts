const PREFIX = "[capturekit]";

export const logger = {
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug(PREFIX, ...args);
  },
  info: (...args: unknown[]) => console.info(PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args),
};
