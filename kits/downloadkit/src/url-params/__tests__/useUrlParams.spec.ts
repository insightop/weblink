import { describe, expect, it, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useFlasherStore } from "../../features/flasher/stores/flasher.store";
import { globalPluginRegistry } from "../../plugins/registry";
import { stm32SerialPlugin } from "../../plugins/builtin/stm32Serial.plugin";
import type { FirmwareInputPanelExpose } from "../../features/flasher/components/firmwareInputPanelExpose";

// mock useRoute from vue-router
vi.mock("vue-router", () => ({
  useRoute: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
}));

import { useRoute } from "vue-router";

// mock fetchFirmware
vi.mock("../fetchFirmware", () => ({
  fetchFirmware: vi.fn(),
}));

import { fetchFirmware } from "../fetchFirmware";
import { useUrlParams } from "../useUrlParams";

function makeMockFirmwareInput(): FirmwareInputPanelExpose {
  return {
    restoreFirmwareRows: vi.fn(),
    getInput: vi.fn(),
    firmwareFingerprint: { value: null } as any,
    firmwareTotalBytes: { value: 0 } as any,
    exportFirmwareRows: vi.fn(),
  };
}

describe("useUrlParams", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalPluginRegistry.register(stm32SerialPlugin);
    vi.clearAllMocks();
  });

  it("hasParams is false with empty query", () => {
    vi.mocked(useRoute).mockReturnValue({ query: {} } as any);

    const { hasParams } = useUrlParams();
    expect(hasParams.value).toBe(false);
  });

  it("hasParams is true with target in query", () => {
    vi.mocked(useRoute).mockReturnValue({ query: { target: "stm32" } } as any);

    const { hasParams } = useUrlParams();
    expect(hasParams.value).toBe(true);
  });

  it("apply sets chipFamily from target", async () => {
    vi.mocked(useRoute).mockReturnValue({ query: { target: "stm32" } } as any);

    const store = useFlasherStore();
    const firmwareInput = makeMockFirmwareInput();
    const { apply } = useUrlParams();

    const result = await apply({ store, firmwareInput });

    expect(store.chipFamily).toBe("stm32");
    expect(result.autoStart).toBe(false);
  });

  it("apply sets flasherType from programmer", async () => {
    vi.mocked(useRoute).mockReturnValue({
      query: { target: "stm32", programmer: "serial" },
    } as any);

    const store = useFlasherStore();
    const firmwareInput = makeMockFirmwareInput();
    const { apply } = useUrlParams();

    await apply({ store, firmwareInput });

    expect(store.chipFamily).toBe("stm32");
    expect(store.flasherType).toBe("serial");
  });

  it("apply sets pluginConfig on matched plugin", async () => {
    vi.mocked(useRoute).mockReturnValue({
      query: { target: "stm32", programmer: "serial", programmer_baudRate: "921600" },
    } as any);

    const store = useFlasherStore();
    const firmwareInput = makeMockFirmwareInput();
    const { apply } = useUrlParams();

    await apply({ store, firmwareInput });

    expect(store.getPluginConfig("stm32-serial")).toEqual({ baudRate: "921600" });
  });

  it("apply fetches firmware and calls restoreFirmwareRows", async () => {
    const mockBlob = new Blob(["test"], { type: "application/octet-stream" });
    vi.mocked(fetchFirmware).mockResolvedValue({
      name: "fw.bin",
      blob: mockBlob,
      size: 4,
    });

    vi.mocked(useRoute).mockReturnValue({
      query: {
        target: "stm32",
        programmer: "serial",
        firmware: "https://example.com/fw.bin",
        addr: "0x08000000",
      },
    } as any);

    const store = useFlasherStore();
    const firmwareInput = makeMockFirmwareInput();
    const { apply } = useUrlParams();

    await apply({ store, firmwareInput });

    expect(fetchFirmware).toHaveBeenCalledWith("https://example.com/fw.bin");
    expect(firmwareInput.restoreFirmwareRows).toHaveBeenCalledWith([
      expect.objectContaining({
        addressStr: "0x08000000",
      }),
    ]);
  });

  it("apply returns autoStart=true when auto=1 with firmware", async () => {
    vi.mocked(fetchFirmware).mockResolvedValue({
      name: "fw.bin",
      blob: new Blob(["x"]),
      size: 1,
    });

    vi.mocked(useRoute).mockReturnValue({
      query: {
        target: "stm32",
        programmer: "serial",
        firmware: "https://example.com/fw.bin",
        auto: "1",
      },
    } as any);

    const store = useFlasherStore();
    const firmwareInput = makeMockFirmwareInput();
    const { apply } = useUrlParams();

    const result = await apply({ store, firmwareInput });
    expect(result.autoStart).toBe(true);
  });

  it("apply returns autoStart=false when auto=0", async () => {
    vi.mocked(useRoute).mockReturnValue({
      query: { auto: "0" },
    } as any);

    const store = useFlasherStore();
    const firmwareInput = makeMockFirmwareInput();
    const { apply } = useUrlParams();

    const result = await apply({ store, firmwareInput });
    expect(result.autoStart).toBe(false);
  });
});
