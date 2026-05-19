import { describe, expect, it } from "vitest";
import { LOG_LEVELS, getLogLevelPresentation } from "@/features/flasher/presentation/logLevelPresentation";

describe("logLevelPresentation", () => {
  it("defines all log levels in stable order", () => {
    expect(LOG_LEVELS).toEqual(["trace", "debug", "info", "warning", "error"]);
  });

  it("provides icon, i18n key and color for every level", () => {
    for (const level of LOG_LEVELS) {
      const item = getLogLevelPresentation(level);
      expect(item.level).toBe(level);
      expect(item.i18nKey).toBe(`log.level.${level}`);
      expect(item.colorVar).toBeTypeOf("string");
      expect(item.icon).toBeTruthy();
    }
  });
});
