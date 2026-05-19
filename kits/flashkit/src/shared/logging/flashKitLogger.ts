import pino from "pino";

export const flashKitLogger = pino({
  name: "weblink-flashkit",
  level: import.meta.env.DEV ? "debug" : "info",
  browser: { asObject: true },
});
