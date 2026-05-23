import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { FlasherPersistenceRepository } from "../repository";

describe("FlasherPersistenceRepository", () => {
  const repository = new FlasherPersistenceRepository();

  beforeEach(async () => {
    await repository.clearLastSession();
  });

  it("saves and restores last session including firmware blob", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "application/octet-stream" });

    await repository.saveLastSession({
      version: 2,
      chipFamily: "stm32",
      flasherType: "serial",
      pluginConfigs: { "stm32-serial": { baudRate: 115200 } },
      downloadStats: { successCount: 3, failedCount: 1 },
      firmwareRows: [
        {
          rowId: "row-1",
          addressStr: "0x08000000",
          note: "",
          file: {
            name: "app.bin",
            type: "application/octet-stream",
            size: 3,
            lastModified: 123,
            blob,
          },
        },
      ],
    });

    const loaded = await repository.loadLastSession();
    expect(loaded?.chipFamily).toBe("stm32");
    expect(loaded?.flasherType).toBe("serial");
    expect(loaded?.downloadStats.successCount).toBe(3);
    expect(loaded?.downloadStats.failedCount).toBe(1);
    expect(loaded?.firmwareRows[0].file?.name).toBe("app.bin");
    expect(loaded?.firmwareRows[0].file?.size).toBe(3);
  });

  it("migrates v1 payload to include download stats", async () => {
    await repository.saveLastSession({
      version: 1,
      chipFamily: "gd32",
      flasherType: "usb-dfu",
      pluginConfigs: {},
      firmwareRows: [],
    });

    const loaded = await repository.loadLastSession();
    expect(loaded?.version).toBe(2);
    expect(loaded?.downloadStats.successCount).toBe(0);
    expect(loaded?.downloadStats.failedCount).toBe(0);
  });
});
