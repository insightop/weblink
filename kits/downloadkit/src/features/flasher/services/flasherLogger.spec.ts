import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useFlasherStore } from "@/features/flasher/stores/flasher.store";
import { flasherLogger } from "@/features/flasher/services/flasherLogger";

describe("flasherLogger", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("writes info log with timestamp", () => {
    const store = useFlasherStore();
    flasherLogger.info("Connected");
    expect(store.logs.length).toBe(1);
    expect(store.logs[0].level).toBe("info");
    expect(store.logs[0].message).toBe("Connected");
    expect(typeof store.logs[0].timestamp).toBe("string");
  });

  it("writes all level APIs", () => {
    const store = useFlasherStore();
    flasherLogger.trace("t");
    flasherLogger.debug("d");
    flasherLogger.warning("w");
    flasherLogger.error("e");
    expect(store.logs.map((i) => i.level)).toEqual(["trace", "debug", "warning", "error"]);
  });
});

